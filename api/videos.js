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
    const videos = await redis.get('mmjd:videos');
    return new Response(JSON.stringify(videos || []), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    if (!body.url || !body.platform) {
      return new Response(
        JSON.stringify({ error: 'URL and platform required' }),
        { status: 400, headers }
      );
    }

    const existing = (await redis.get('mmjd:videos')) || [];

    const newVideo = {
      id: Date.now().toString(),
      title: body.title || 'Untitled',
      url: body.url,
      platform: body.platform,
      category: body.category || 'music-video',
      embed: body.embed || '',
      thumbnail: body.thumbnail || '',
      added: new Date().toISOString(),
    };

    existing.push(newVideo);
    await redis.set('mmjd:videos', existing);

    return new Response(JSON.stringify(newVideo), { status: 201, headers });
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

    const existing = (await redis.get('mmjd:videos')) || [];
    const filtered = existing.filter((x) => x.id !== id);
    await redis.set('mmjd:videos', filtered);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}