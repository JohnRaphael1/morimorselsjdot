import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN,
});

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
    const releases = await redis.get('mmjd:releases');
    return new Response(JSON.stringify(releases || []), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    if (!body.name || !body.release_date) {
      return new Response(
        JSON.stringify({ error: 'Name and release date required' }),
        { status: 400, headers }
      );
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

export async function DELETE(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers });
    }

    const existing = (await redis.get('mmjd:releases')) || [];
    const filtered = existing.filter((x) => x.id !== id);
    await redis.set('mmjd:releases', filtered);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}