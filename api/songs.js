import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// ---------- Spotify embed scraping ----------
async function fetchSpotifyData(url) {
  // Convert to embed URL
  let embedUrl = url;
  if (!url.includes('/embed/')) {
    embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
  }

  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();

  // Extract __NEXT_DATA__ JSON
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
  if (!match) throw new Error('Could not read Spotify data');

  const data = JSON.parse(match[1]);
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('No entity found in Spotify data');

  const isAlbum = entity.type === 'album';
  const isTrack = entity.type === 'track';

  // Determine type
  let releaseType = 'single';
  if (isAlbum) {
    const total = entity.trackList?.length || entity.totalTracks || 0;
    releaseType = total > 6 ? 'album' : 'ep';
  }

  // Build tracklist (for albums/EPs)
  let tracklist = [];
  if (isAlbum && entity.trackList) {
    tracklist = entity.trackList.map(t => t.title || t.name).filter(Boolean);
  }

  // Featured artists
  let featured = '';
  if (entity.artists && entity.artists.length > 1) {
    featured = entity.artists.slice(1).map(a => a.name).join(', ');
  }

  return {
    name: entity.name || entity.title || '',
    artist: entity.artists?.[0]?.name || 'MoriMorsels JDot',
    featured: featured,
    cover: entity.coverArt?.sources?.[0]?.url || '',
    release_date: entity.releaseDate?.isoString?.slice(0, 10) || '',
    type: releaseType,
    total_tracks: isAlbum ? (entity.trackList?.length || entity.totalTracks || 1) : 1,
    tracklist: tracklist,
    source: 'spotify'
  };
}

// ---------- Apple Music / iTunes ----------
async function fetchAppleData(url) {
  // Extract numeric ID from URL
  const idMatch = url.match(/\/(\d+)(?:\?|$|\/)/);
  if (!idMatch) throw new Error('Could not find ID in Apple Music link');

  const id = idMatch[1];
  const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song`);
  const data = await res.json();

  if (!data.results || !data.results.length) throw new Error('No data from Apple Music');

  // First result is the album/collection
  const collection = data.results[0];
  const isAlbum = collection.wrapperType === 'collection';
  const trackCount = collection.trackCount || 1;

  let releaseType = 'single';
  if (isAlbum) {
    releaseType = trackCount > 6 ? 'album' : 'ep';
  }

  // Build tracklist from all results
  let tracklist = [];
  if (isAlbum && data.results.length > 1) {
    tracklist = data.results
      .filter(r => r.wrapperType === 'track')
      .map(r => r.trackName)
      .filter(Boolean);
  }

  return {
    name: collection.collectionName || collection.trackName || '',
    artist: collection.artistName || 'MoriMorsels JDot',
    featured: '',
    cover: (collection.artworkUrl100 || '').replace('100x100', '600x600'),
    release_date: collection.releaseDate ? collection.releaseDate.slice(0, 10) : '',
    type: releaseType,
    total_tracks: trackCount,
    tracklist: tracklist,
    source: 'apple'
  };
}

// ---------- Main handler ----------
export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  // GET — return all saved releases
  if (req.method === 'GET') {
    try {
      const releases = await redis.get('mmjd:releases');
      return new Response(JSON.stringify(releases || []), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  // POST — either auto-fetch OR save
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // If "action" is "fetch", run the scraper
      if (body.action === 'fetch') {
        const url = body.url || '';
        if (url.includes('spotify.com')) {
          const data = await fetchSpotifyData(url);
          return new Response(JSON.stringify(data), { status: 200, headers });
        }
        if (url.includes('music.apple.com') || url.includes('itunes.apple.com')) {
          const data = await fetchAppleData(url);
          return new Response(JSON.stringify(data), { status: 200, headers });
        }
        throw new Error('Unsupported link. Paste a Spotify or Apple Music link.');
      }

      // Otherwise it's a normal save
      if (!body.name || !body.release_date) {
        return new Response(JSON.stringify({ error: 'Name and release date are required' }), { status: 400, headers });
      }

      const existing = (await redis.get('mmjd:releases')) || [];

      const newRelease = {
        id: Date.now().toString(),
        name: body.name,
        artist: body.artist || 'MoriMorsels JDot',
        featured: body.featured || '',
        type: body.type || 'single',
        release_date: body.release_date,
        total_tracks: body.total_tracks || 1,
        tracklist: Array.isArray(body.tracklist) ? body.tracklist : [],
        cover: body.cover || '',
        spotify_url: body.spotify_url || '',
        apple_url: body.apple_url || '',
        genre: body.genre || '',
        producer: body.producer || '',
        label: body.label || '',
        added: new Date().toISOString(),
      };

      existing.push(newRelease);
      await redis.set('mmjd:releases', existing);

      return new Response(JSON.stringify(newRelease), { status: 201, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  // DELETE
  if (req.method === 'DELETE') {
    try {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers });

      const existing = (await redis.get('mmjd:releases')) || [];
      const filtered = existing.filter((x) => x.id !== id);
      await redis.set('mmjd:releases', filtered);

      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}