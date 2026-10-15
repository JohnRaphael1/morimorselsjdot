// Netlify Scheduled Function
// Runs daily, fetches MoriMorsels JDot's releases from Spotify,
// saves to songs-data.json

export default async () => {
  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
  const ARTIST_ID = '72RLZjzQjhCvtMraxrqVtO';

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing Spotify credentials');
    return { statusCode: 500, body: 'Missing credentials' };
  }

  try {
    // STEP 1: Get access token (Client Credentials flow)
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenRes.ok) throw new Error('Token request failed: ' + tokenRes.status);
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // STEP 2: Get all albums/singles for the artist
    const albumsRes = await fetch(
      `https://api.spotify.com/v1/artists/${ARTIST_ID}/albums?include_groups=album,single,compilation&limit=50&market=US`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!albumsRes.ok) throw new Error('Albums request failed: ' + albumsRes.status);
    const albumsData = await albumsRes.json();

    // STEP 3: Format the data
    const releases = (albumsData.items || []).map(item => ({
      id: item.id,
      name: item.name,
      type: item.album_type,           // "single" | "album" | "compilation"
      release_date: item.release_date,
      total_tracks: item.total_tracks,
      cover: item.images?.[0]?.url || '',
      spotify_url: item.external_urls?.spotify || '',
      artists: (item.artists || []).map(a => a.name).join(', ')
    }));

    // STEP 4: Save to songs-data.json
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

    console.log(`✅ Updated ${releases.length} releases`);
    return { statusCode: 200, body: `Updated ${releases.length} releases` };

  } catch (err) {
    console.error('❌ Function error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};

export const config = {
  schedule: '@daily'   // runs every day at midnight UTC [citation:7]
};