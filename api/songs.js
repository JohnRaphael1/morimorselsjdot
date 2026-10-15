import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // GET — return all releases
  if (req.method === 'GET') {
    try {
      const releases = await redis.get('mmjd:releases');
      return new Response(JSON.stringify(releases || []), {
        status: 200,
        headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers,
      });
    }
  }

  // POST — add a new release
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      if (!body.name || !body.release_date) {
        return new Response(
          JSON.stringify({ error: 'Name and release date are required' }),
          { status: 400, headers }
        );
      }

      const existing = (await redis.get('mmjd:releases')) || [];

      const newRelease = {
        id: Date.now().toString(),
        name: body.name,
        artist: body.artist || 'MoriMorsels JDot',
        type: body.type || 'single',
        release_date: body.release_date,
        total_tracks: body.total_tracks || 1,
        cover: body.cover || '',
        spotify_url: body.spotify_url || '',
        added: new Date().toISOString(),
      };

      existing.push(newRelease);
      await redis.set('mmjd:releases', existing);

      return new Response(JSON.stringify(newRelease), {
        status: 201,
        headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers,
      });
    }
  }

  // DELETE — remove a release by id
  if (req.method === 'DELETE') {
    try {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400,
          headers,
        });
      }

      const existing = (await redis.get('mmjd:releases')) || [];
      const filtered = existing.filter((x) => x.id !== id);

      await redis.set('mmjd:releases', filtered);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers,
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers,
  });
}