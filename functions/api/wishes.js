// Cloudflare Pages Function: /api/wishes  (binding D1: DB, biến môi trường: ADMIN_KEY)
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

// Firebase Google authentication: verify signed ID tokens on Cloudflare Workers.
async function authorized(request, env) {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_ADMIN_UID) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 10000) return false;
  const decode = value => JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/')));
  let hdr, claims;
  try { hdr = decode(parts[0]); claims = decode(parts[1]); } catch { return false; }
  const now = Math.floor(Date.now() / 1000);
  if (hdr.alg !== 'RS256' || !hdr.kid ||
      claims.aud !== env.FIREBASE_PROJECT_ID ||
      claims.iss !== 'https://securetoken.google.com/' + env.FIREBASE_PROJECT_ID ||
      claims.sub !== env.FIREBASE_ADMIN_UID ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now ||
      typeof claims.auth_time !== 'number' || claims.auth_time > now ||
      claims.firebase?.sign_in_provider !== 'google.com') return false;
  try {
    const certsResponse = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!certsResponse.ok) return false;
    const certs = await certsResponse.json();
    const pem = certs[hdr.kid];
    if (!pem) return false;
    // X.509 certificate wrapping the RSA public key; import with WebCrypto.
    // Use Google JWKS endpoint instead for direct RSA JWK verification.
    const jwksResponse = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if (!jwksResponse.ok) return false;
    const jwks = await jwksResponse.json();
    const jwk = (jwks.keys || []).find(k => k.kid === hdr.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
    const binary = atob(parts[2].replace(/-/g,'+').replace(/_/g,'/'));
    const sig = Uint8Array.from(binary, c=>c.charCodeAt(0));
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, new TextEncoder().encode(parts[0]+'.'+parts[1]));
  } catch { return false; }
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const isAdmin = await authorized(request, env);
  if (u.searchParams.has('dashboard') && !isAdmin) return J({ error: 'Không có quyền' }, 403);
  if (isAdmin) {
    const { results } = await env.DB.prepare(
      'SELECT id,name,message,attend,guests,created_at FROM wishes ORDER BY id DESC'
    ).all();
    return J({ wishes: results });
  }
  // Public-facing guestbook: do not expose private attendance responses.
  const { results } = await env.DB.prepare(
    "SELECT id,name,message,created_at FROM wishes WHERE TRIM(COALESCE(message,'')) != '' ORDER BY id DESC LIMIT 100"
  ).all();
  const stats = await env.DB.prepare(
    "SELECT COUNT(*) AS wishes FROM wishes WHERE TRIM(COALESCE(message,'')) != ''"
  ).first();
  return J({ wishes: results, totals: { wishes: stats.wishes } });
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
  if (!await authorized(request, env)) return J({ error: 'Không có quyền' }, 403);
  await env.DB.prepare('DELETE FROM wishes WHERE id=?').bind(u.searchParams.get('id')).run();
  return J({ ok: true });
}
