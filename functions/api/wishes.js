// Cloudflare Pages Function: /api/wishes  (binding D1: DB, biến môi trường: ADMIN_KEY)
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id,name,message,attend,guests,created_at FROM wishes ORDER BY id DESC LIMIT 500'
  ).all();
  return J({ wishes: results });
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return J({ error: 'Dữ liệu không hợp lệ' }, 400); }
  if (b.hp) return J({ ok: true });
  const name = String(b.name || '').trim().slice(0, 60);
  const message = String(b.message || '').trim().slice(0, 500);
  const attend = b.attend === 'yes' ? 'yes' : b.attend === 'no' ? 'no' : '';
  const guests = attend === 'yes' ? Math.min(10, Math.max(1, parseInt(b.guests) || 1)) : 0;
  if (name.length < 2) return J({ error: 'Bạn nhập tên giúp mình nha' }, 400);
  if (!attend) return J({ error: 'Bạn chọn giúp mình có đến được không nha' }, 400);
  await env.DB.prepare('INSERT INTO wishes (name,message,attend,guests,created_at) VALUES (?,?,?,?,?)')
    .bind(name, message, attend, guests, new Date().toISOString()).run();
  return J({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const u = new URL(request.url);
  if (!env.ADMIN_KEY || u.searchParams.get('admin') !== env.ADMIN_KEY) return J({ error: 'Không có quyền' }, 403);
  await env.DB.prepare('DELETE FROM wishes WHERE id=?').bind(u.searchParams.get('id')).run();
  return J({ ok: true });
}
