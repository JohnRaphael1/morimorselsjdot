import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers });
}

export async function GET() {
  try {
    const images = await redis.get('mmjd:gallery');
    return new Response(JSON.stringify(images || []), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    if (!body.image) {
      return new Response(
        JSON.stringify({ error: 'Image URL required' }),
        { status: 400, headers }
      );
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

export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers });
    }

    const existing = (await redis.get('mmjd:gallery')) || [];
    const filtered = existing.filter((x) => x.id !== id);
    await redis.set('mmjd:gallery', filtered);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}