// Netlify Function — fetches MoriMorsels JDot's releases from iTunes / Apple Music
// No API key required. Returns data directly.

export default async () => {
  const ARTIST_ID = '1856608319'; // MoriMorsels JDot on Apple Music

  try {
    const url =
      `https://itunes.apple.com/lookup?id=${ARTIST_ID}` +
      `&entity=album&limit=200&country=US`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('iTunes request failed: ' + res.status);

    const data = await res.json();

    // First result is the artist, the rest are albums/singles
    const items = (data.results || []).filter(
      r => r.wrapperType === 'collection'
    );

    const releases = items
      .map(item => {
        const trackCount = item.trackCount || 1;
        let type = 'single';
        if (item.collectionType === 'Album') {
          type = trackCount > 6 ? 'album' : 'ep';
        }

        const cover = (item.artworkUrl100 || '').replace('100x100', '600x600');

        return {
          id: item.collectionId,
          name: item.collectionName,
          type,
          release_date: item.releaseDate ? item.releaseDate.slice(0, 10) : '',
          total_tracks: trackCount,
          cover,
          apple_url: item.collectionViewUrl || '',
          artists: item.artistName || 'MoriMorsels JDot'
        };
      })
      .sort((a, b) =>
        (b.release_date || '').localeCompare(a.release_date || '')
      );

    const output = {
      lastUpdated: new Date().toISOString(),
      totalReleases: releases.length,
      releases
    };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (err) {
    console.error('Function error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  schedule: '@daily'
};