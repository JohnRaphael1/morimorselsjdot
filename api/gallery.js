import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  if (req.method === 'GET') {
    try {
      const images = await redis.get('mmjd:gallery');
      return new Response(JSON.stringify(images || []), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (!body.image) {
        return new Response(JSON.stringify({ error: 'Image URL required' }), { status: 400, headers });
      }

      const existing = (await redis.get('mmjd:gallery')) || [];

      const newImage = {
        id: Date.now().toString(),
        image: body.image,
        caption: body.caption || '',
        added: new Date().toISOString(),
      };

      existing.push(newImage);
      await redis.set('mmjd:gallery', existing);

      return new Response(JSON.stringify(newImage), { status: 201, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers });

      const existing = (await redis.get('mmjd:gallery')) || [];
      const filtered = existing.filter((x) => x.id !== id);
      await redis.set('mmjd:gallery', filtered);

      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}