const crypto = require('crypto');

function hashPW(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function createToken(userId, role, secret) {
  const payload = { uid: userId, role, exp: Date.now() + 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}

async function dbQ(url, key, path, method, body, query) {
  const full = query ? `${url}/rest/v1/${path}?${query}` : `${url}/rest/v1/${path}`;
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (method === 'POST' || method === 'PATCH') h.Prefer = 'return=representation';
  const opts = { method: method || 'GET', headers: h };
  if (body && method !== 'GET' && method !== 'DELETE') opts.body = JSON.stringify(body);
  const res = await fetch(full, opts);
  if (method === 'DELETE') return { ok: res.ok, s: res.status };
  const txt = await res.text();
  try { return { ok: res.ok, s: res.status, d: JSON.parse(txt) }; }
  catch { return { ok: res.ok, s: res.status, d: txt }; }
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const ok = (d) => ({ statusCode: 200, headers: CORS, body: JSON.stringify(d) });
const er = (c, m) => ({ statusCode: c, headers: CORS, body: JSON.stringify({ error: m }) });

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return er(405, 'Not allowed');
  const URL = process.env.VITE_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  const SEC = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !KEY) return er(500, 'Config error');

  try {
    const { action, token, params } = JSON.parse(event.body);

    // ── LOGIN ──
    if (action === 'login') {
      const { username, password } = params || {};
      if (!username || !password) return er(400, 'Missing credentials');
      const r = await dbQ(URL, KEY, 'users', 'GET', null, `username=eq.${encodeURIComponent(username)}&select=*`);
      if (!r.ok || !Array.isArray(r.d) || r.d.length === 0) return er(401, 'Invalid credentials');
      const u = r.d[0];
      const hash = hashPW(password);
      if (u.password !== hash && u.password !== password) return er(401, 'Invalid credentials');
      if (!u.active) return er(403, 'Account disabled');
      if (u.paused) return er(403, 'Account paused');
      const tk = createToken(u.id, u.role, SEC);
      dbQ(URL, KEY, 'audit_log', 'POST', { user_id: u.id, action: 'login', entity: 'users', entity_id: u.id, details: JSON.stringify({ username: u.username }) }).catch(() => {});
      const { password: _, reset_code: _r, reset_expires: _e, ...safe } = u;
      return ok({ token: tk, user: safe });
    }

    // ── PASSWORD RESET REQUEST ──
    if (action === 'pw_reset_request') {
      const { username, email } = params || {};
      if (!username || !email) return er(400, 'Missing fields');
      const r = await dbQ(URL, KEY, 'users', 'GET', null, `username=eq.${encodeURIComponent(username)}&email=eq.${encodeURIComponent(email)}&select=id,name,email`);
      if (!r.ok || !Array.isArray(r.d) || r.d.length === 0) return er(404, 'Δεν βρέθηκε χρήστης με αυτό το username και email');
      const u = r.d[0];
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await dbQ(URL, KEY, 'users', 'PATCH', { reset_code: hashPW(code), reset_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString() }, `id=eq.${u.id}`);
      const RK = process.env.RESEND_API_KEY;
      if (RK && u.email) {
        try {
          await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + RK, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'CRM Electrigon <onboarding@resend.dev>', to: [u.email], subject: 'Επαναφορά Κωδικού - CRM Electrigon',
              html: `<div style="font-family:Arial;max-width:500px;margin:0 auto"><div style="background:linear-gradient(135deg,#E60000,#FF6F00);padding:16px;border-radius:8px 8px 0 0;color:white;text-align:center"><h1 style="margin:0;font-size:1.2rem">🔑 Επαναφορά Κωδικού</h1></div><div style="background:white;padding:20px;border:1px solid #E0E0E0;border-radius:0 0 8px 8px;text-align:center"><p>Γεια σου <strong>${u.name}</strong>,</p><p>Ο προσωρινός κωδικός σου:</p><div style="font-size:2rem;font-weight:900;letter-spacing:8px;color:#E60000;padding:20px;background:#FFF3E0;border-radius:8px;margin:16px 0">${code}</div><p style="font-size:0.82rem;color:#888">Ισχύει για 15 λεπτά.</p></div></div>` }) });
          console.log('Reset email sent to:', u.email);
        } catch (e) { console.error('Email error:', e.message); }
      }
      return ok({ sent: true });
    }

    // ── PASSWORD RESET CONFIRM ──
    if (action === 'pw_reset_confirm') {
      const { username, code, newPassword } = params || {};
      if (!username || !code || !newPassword) return er(400, 'Missing fields');
      if (newPassword.length < 6) return er(400, 'Min 6 chars');
      const r = await dbQ(URL, KEY, 'users', 'GET', null, `username=eq.${encodeURIComponent(username)}&select=id,reset_code,reset_expires`);
      if (!r.ok || !Array.isArray(r.d) || r.d.length === 0) return er(400, 'Invalid');
      const u = r.d[0];
      if (!u.reset_code || u.reset_code !== hashPW(code)) return er(400, 'Wrong code');
      if (u.reset_expires && new Date(u.reset_expires) < new Date()) return er(400, 'Code expired');
      await dbQ(URL, KEY, 'users', 'PATCH', { password: hashPW(newPassword), reset_code: null, reset_expires: null, must_change_pw: false }, `id=eq.${u.id}`);
      return ok({ done: true });
    }

    // ── PROTECTED: verify token ──
    const auth = verifyToken(token, SEC);
    if (!auth) return er(401, 'Invalid token');
    const TABLES = ['users','requests','tickets','ticket_messages','afm_database','offers','audit_log','comments'];

    // ── LOAD ALL DATA ──
    if (action === 'load_data') {
      const [uR, rR, aR, tR, mR, oR] = await Promise.all([
        dbQ(URL, KEY, 'users', 'GET', null, 'select=*'),
        dbQ(URL, KEY, 'requests', 'GET', null, 'select=*&order=created_at.desc'),
        dbQ(URL, KEY, 'afm_database', 'GET', null, 'select=*'),
        dbQ(URL, KEY, 'tickets', 'GET', null, 'select=*&order=created_at.desc'),
        dbQ(URL, KEY, 'ticket_messages', 'GET', null, 'select=*&order=id.asc'),
        dbQ(URL, KEY, 'offers', 'GET', null, 'select=*'),
      ]);
      return ok({ users: uR.d || [], requests: rR.d || [], afm_database: aR.d || [], tickets: tR.d || [], ticket_messages: mR.d || [], offers: oR.d || [] });
    }

    // ── CRUD ──
    if (action === 'db') {
      const { method, table, data, match } = params || {};
      if (!TABLES.includes(table)) return er(403, 'Forbidden table');
      if (method === 'select') { const r = await dbQ(URL, KEY, table, 'GET', null, match || 'select=*'); return ok({ data: r.d }); }
      if (method === 'insert') { const r = await dbQ(URL, KEY, table, 'POST', data); return ok({ data: r.d }); }
      if (method === 'update') { const r = await dbQ(URL, KEY, table, 'PATCH', data, match); return ok({ data: r.d }); }
      if (method === 'delete') {
        if (!['admin','director'].includes(auth.role)) return er(403, 'No permission');
        await dbQ(URL, KEY, table, 'DELETE', null, match);
        return ok({ ok: true });
      }
      if (method === 'upsert') {
        const r = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(data) });
        const t = await r.text(); return { statusCode: r.status, headers: CORS, body: t };
      }
      return er(400, 'Unknown method');
    }

    // ── STORAGE ──
    if (action === 'sign_upload') {
      const { path } = params || {};
      return ok({ url: `${URL}/storage/v1/object/documents/${path}`, key: KEY });
    }
    if (action === 'sign_download') {
      const { path } = params || {};
      const r = await fetch(`${URL}/storage/v1/object/sign/documents/${path}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
      if (r.ok) { const d = await r.json(); return ok({ url: `${URL}/storage/v1${d.signedURL}` }); }
      return er(404, 'Not found');
    }

    if (action === 'logout') return ok({ ok: true });
    return er(400, 'Unknown action');
  } catch (e) {
    console.error('API error:', e.message);
    return er(500, e.message);
  }
};
