// API endpoint for scraping Spotify and Apple Music
// Returns release metadata as JSON

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers });
}

// ---------- SPOTIFY SCRAPING ----------
async function fetchSpotify(url) {
  // Convert to embed URL
  let embedUrl = url;
  if (!url.includes('/embed/')) {
    embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
  }
  // Remove query params
  embedUrl = embedUrl.split('?')[0];

  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html'
    }
  });

  if (!res.ok) throw new Error('Spotify returned ' + res.status);

  const html = await res.text();

  // Find the __NEXT_DATA__ JSON
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
  if (!match) throw new Error('Could not extract Spotify data (page format changed)');

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (e) {
    throw new Error('Could not parse Spotify JSON');
  }

  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('No entity found in Spotify data');

  const isAlbum = entity.type === 'album';
  const isPlaylist = entity.type === 'playlist';

  if (isPlaylist) throw new Error('Playlists are not supported. Use a track or album link.');

  // Extract data
  const name = entity.name || entity.title || '';
  const artist = entity.artists?.[0]?.name || entity.subtitle || '';

  // Featured artists
  let featured = '';
  if (entity.artists && entity.artists.length > 1) {
    featured = entity.artists.slice(1).map(a => a.name).filter(Boolean).join(', ');
  } else if (entity.subtitle && entity.subtitle.includes(',') && !isAlbum) {
    // Sometimes featured is in subtitle
    const parts = entity.subtitle.split(',');
    if (parts.length > 1 && !entity.subtitle.toLowerCase().includes('mori')) {
      featured = parts.slice(1).map(s => s.trim()).join(', ');
    }
  }

  // Cover
  const cover = entity.coverArt?.sources?.[0]?.url
    || entity.visualIdentity?.image?.[0]?.url
    || '';

  // Release date
  let releaseDate = '';
  if (entity.releaseDate?.isoString) {
    releaseDate = entity.releaseDate.isoString.slice(0, 10);
  } else if (entity.releaseDate?.year) {
    releaseDate = entity.releaseDate.year + '-01-01';
  }

  // Type
  let type = 'single';
  const totalTracks = entity.trackList?.length || entity.totalTracks || 1;
  if (isAlbum) {
    type = totalTracks > 6 ? 'album' : 'ep';
  }

  // Tracklist
  let tracklist = [];
  if (isAlbum && entity.trackList) {
    tracklist = entity.trackList
      .map(t => t.title || t.name || '')
      .filter(Boolean);
  }

  return {
    name,
    artist: artist || 'MoriMorsels JDot',
    featured,
    cover,
    release_date: releaseDate,
    type,
    total_tracks: totalTracks,
    tracklist,
    genre: '',
    producer: '',
    label: '',
    source: 'spotify'
  };
}

// ---------- APPLE MUSIC / ITUNES ----------
async function fetchApple(url) {
  // Extract ID — iTunes lookup API gives full metadata
  const idMatch = url.match(/\/(\d+)(?:\?|$|\/)/);
  if (!idMatch) throw new Error('Could not find ID in Apple Music link');

  const id = idMatch[1];

  // Try album lookup first
  let res = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song&country=US`);
  let data = await res.json();

  // If no results, try as a song
  if (!data.results || !data.results.length) {
    res = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=US`);
    data = await res.json();
  }

  if (!data.results || !data.results.length) throw new Error('No data from Apple Music');

  const collection = data.results[0];
  const isAlbum = collection.wrapperType === 'collection';
  const trackCount = collection.trackCount || 1;

  let type = 'single';
  if (isAlbum) {
    type = trackCount > 6 ? 'album' : 'ep';
  }

  // Tracklist from all song results
  let tracklist = [];
  if (isAlbum && data.results.length > 1) {
    tracklist = data.results
      .filter(r => r.wrapperType === 'track')
      .map(r => r.trackName)
      .filter(Boolean);
  }

  // Featured artists (sometimes in trackName)
  let featured = '';
  const name = collection.collectionName || collection.trackName || '';
  const featMatch = name.match(/\(feat\.\s*(.+?)\)/i);
  if (featMatch) {
    featured = featMatch[1];
  }

  // Get hi-res artwork
  const cover = (collection.artworkUrl100 || '').replace('100x100', '600x600');

  return {
    name: name.replace(/\s*\(feat\..+?\)/i, '').trim(),
    artist: collection.artistName || 'MoriMorsels JDot',
    featured,
    cover,
    release_date: collection.releaseDate ? collection.releaseDate.slice(0, 10) : '',
    type,
    total_tracks: trackCount,
    tracklist,
    genre: collection.primaryGenreName || '',
    producer: '',
    label: '',
    source: 'apple'
  };
}

// ---------- MAIN HANDLER ----------
export async function POST(req) {
  try {
    const body = await req.json();
    const url = (body.url || '').trim();

    if (!url) {
      return new Response(JSON.stringify({ error: 'No URL provided' }), { status: 400, headers });
    }

    let result;

    if (url.includes('spotify.com')) {
      result = await fetchSpotify(url);
    } else if (url.includes('music.apple.com') || url.includes('itunes.apple.com')) {
      result = await fetchApple(url);
    } else {
      throw new Error('Unsupported link. Paste a Spotify or Apple Music link.');
    }

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}