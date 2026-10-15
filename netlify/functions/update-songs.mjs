// Netlify Scheduled Function
// Fetches MoriMorsels JDot's releases from iTunes / Apple Music
// No API key required
// Runs daily and writes songs-data.json

export default async () => {
  const ARTIST_ID = '1856608319'; // MoriMorsels JDot on Apple Music

  try {
    // iTunes lookup: returns all albums + singles for the artist
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

    // Format the data
    const releases = items
      .map(item => {
        // Detect singles vs albums
        const trackCount = item.trackCount || 1;
        let type = 'single';
        if (item.collectionType === 'Album') {
          type = trackCount > 6 ? 'album' : 'ep';
        }

        // Get hi-res cover art (swap 100x100 for 600x600)
        const cover =
          (item.artworkUrl100 || '').replace('100x100', '600x600');

        return {
          id: item.collectionId,
          name: item.collectionName,
          type,
          release_date: item.releaseDate
            ? item.releaseDate.slice(0, 10) // YYYY-MM-DD
            : '',
          total_tracks: trackCount,
          cover,
          spotify_url: '', // iTunes doesn't give Spotify; leave blank
          apple_url: item.collectionViewUrl || '',
          artists: item.artistName || 'MoriMorsels JDot'
        };
      })
      // Sort newest first
      .sort((a, b) =>
        (b.release_date || '').localeCompare(a.release_date || '')
      );

    // Write the JSON
    const fs = await import('fs/promises');
    const path = await import('path');

    const output = {
      lastUpdated: new Date().toISOString(),
      totalReleases: releases.length,
      releases
    };

    await fs.writeFile(
      path.join(process.cwd(), 'songs-data.json'),
      JSON.stringify(output, null, 2)
    );

    console.log(`✅ Updated ${releases.length} releases from iTunes`);
    return { statusCode: 200, body: `Updated ${releases.length} releases` };

  } catch (err) {
    console.error('❌ Function error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};

export const config = {
  schedule: '@daily'
};