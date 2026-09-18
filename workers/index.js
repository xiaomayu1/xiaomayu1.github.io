/**
 * Cloudflare Worker — Ink Pub API
 * Database: Cloudflare D1 (SQLite)
 *
 * 部署前：
 *   1. 在 Cloudflare Dashboard 创建 D1 数据库，命名 ink-pub-db
 *   2. 在 wrangler.toml 的 [d1_databases] 绑定 DB = "ink-pub-db"
 *   3. 执行 d1/migrate.sql 建表
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'moyun-jwt-change-in-production';

// ── Helpers ──
const ok = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});
const err = (msg, status = 400) => ok({ error: msg }, status);
const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
});
const auth = (req, env) => {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), env.JWT_SECRET); } catch { return null; }
};

// ── D1 query helpers ──
async function query(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  const result = await stmt.all();
  return result;
}
async function run(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  await stmt.run();
}
async function first(env, sql, params = []) {
  const stmt = env.DB.prepare(sql).bind(...params);
  return await stmt.first();
}

// ── Routes ──
async function api(req, env) {
  const url = new URL(req.url);
  const { pathname } = url;
  const method = req.method;

  if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

  // ── Auth ──
  if (pathname === '/api/auth/register' && method === 'POST') {
    const { username, password, displayName } = await req.json();
    if (!username || !password) return err('请填写用户名和密码', 400);
    if (password.length < 3) return err('密码至少3个字符', 400);
    if (username.length < 2 || username.length > 20) return err('用户名2-20个字符', 400);

    const existing = await first(env, 'SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) return err('用户名已存在', 409);

    const hashed = await bcrypt.hash(password, 10);
    await run(env,
      'INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)',
      [username.trim(), (displayName || username.trim()).trim(), hashed]);
    const user = await first(env, 'SELECT id, username, display_name FROM users WHERE username = ?', [username.trim()]);
    const token = jwt.sign({ id: user.id, username: user.username }, env.JWT_SECRET, { expiresIn: '7d' });
    return ok({ token, user });
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const { username, password } = await req.json();
    if (!username || !password) return err('请填写用户名和密码', 400);
    const user = await first(env,
      'SELECT id, username, display_name, password_hash FROM users WHERE username = ?',
      [username.trim()]);
    if (!user) return err('用户名或密码错误', 401);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return err('用户名或密码错误', 401);
    const token = jwt.sign({ id: user.id, username: user.username }, env.JWT_SECRET, { expiresIn: '7d' });
    return ok({ token, user });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const user = await first(env, 'SELECT id, username, display_name FROM users WHERE id = ?', [u.id]);
    if (!user) return err('not found', 404);
    return ok(user);
  }

  // ── Poems ──
  if (pathname === '/api/poems' && method === 'GET') {
    const params = Object.fromEntries(url.searchParams);
    let sql = 'SELECT * FROM poems';
    const binds = [];
    const where = [];
    if (params.category) { where.push('category = ?'); binds.push(params.category); }
    if (params.tag) { where.push(`tags LIKE ?`); binds.push(`%"${params.tag}"%`); }
    if (params.q) {
      const k = `%${params.q}%`;
      where.push('(title LIKE ? OR content LIKE ? OR author LIKE ?)');
      binds.push(k, k, k);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    const sortBy = params.sort === 'likes' ? 'likes' : 'created_at';
    const sortDir = params.sort === 'oldest' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortBy} ${sortDir} LIMIT ?`;
    binds.push(parseInt(params.limit) || 100);
    const poems = await query(env, sql, binds);
    return ok(poems);
  }

  if (/^\/api\/poems\/\d+$/.test(pathname) && method === 'GET') {
    const id = parseInt(pathname.split('/')[3]);
    const poem = await first(env, 'SELECT * FROM poems WHERE id = ?', [id]);
    if (!poem) return err('not found', 404);
    return ok(poem);
  }

  if (pathname === '/api/poems' && method === 'POST') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const { title, content, collection, category, tags } = await req.json();
    if (!title || !content) return err('标题和正文不能为空', 400);
    const tagsJson = JSON.stringify(tags || []);
    await run(env,
      `INSERT INTO poems (title, content, author, user_id, collection, category, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title.trim(), content.trim(), u.displayName, u.id, (collection || '').trim(), category || '随笔', tagsJson]);
    const poem = await first(env, 'SELECT * FROM poems WHERE id = last_insert_rowid()');
    return ok(poem, 201);
  }

  if (/^\/api\/poems\/\d+$/.test(pathname) && method === 'PUT') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const id = parseInt(pathname.split('/')[3]);
    const existing = await first(env, 'SELECT user_id FROM poems WHERE id = ?', [id]);
    if (!existing) return err('not found', 404);
    if (existing.user_id !== u.id) return err('无权编辑此诗', 403);
    const { title, content, collection, category, tags } = await req.json();
    const tagsJson = JSON.stringify(tags);
    await run(env,
      `UPDATE poems SET title=?, content=?, collection=?, category=?, tags=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [title, content, collection, category, tagsJson, id]);
    const poem = await first(env, 'SELECT * FROM poems WHERE id = ?', [id]);
    return ok(poem);
  }

  if (/^\/api\/poems\/\d+$/.test(pathname) && method === 'DELETE') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const id = parseInt(pathname.split('/')[3]);
    const existing = await first(env, 'SELECT user_id FROM poems WHERE id = ?', [id]);
    if (!existing) return err('not found', 404);
    if (existing.user_id !== u.id) return err('无权删除此诗', 403);
    await run(env, 'DELETE FROM poems WHERE id = ?', [id]);
    return ok({ ok: true });
  }

  if (/^\/api\/poems\/\d+\/like$/.test(pathname) && method === 'POST') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const id = parseInt(pathname.split('/')[3]);
    await run(env, 'UPDATE poems SET likes = likes + 1 WHERE id = ?', [id]);
    const poem = await first(env, 'SELECT likes FROM poems WHERE id = ?', [id]);
    return ok({ likes: poem?.likes });
  }

  if (/^\/api\/poems\/\d+\/view$/.test(pathname) && method === 'POST') {
    const id = parseInt(pathname.split('/')[3]);
    await run(env, 'UPDATE poems SET views = views + 1 WHERE id = ?', [id]);
    return ok({ ok: true });
  }

  // ── Stats & Tags ──
  if (pathname === '/api/stats' && method === 'GET') {
    const poems = await query(env, 'SELECT category, tags, likes, views FROM poems');
    const cats = {}, tags = {};
    (poems || []).forEach(p => {
      cats[p.category] = (cats[p.category] || 0) + 1;
      try { (JSON.parse(p.tags) || []).forEach(t => tags[t] = (tags[t] || 0) + 1); } catch {}
    });
    return ok({
      total: poems?.length || 0,
      totalLikes: poems?.reduce((s, p) => s + (p.likes || 0), 0) || 0,
      totalViews: poems?.reduce((s, p) => s + (p.views || 0), 0) || 0,
      categories: cats, tags,
    });
  }

  if (pathname === '/api/tags' && method === 'GET') {
    const poems = await query(env, 'SELECT tags FROM poems');
    const tags = {};
    (poems || []).forEach(p => {
      try { (JSON.parse(p.tags) || []).forEach(t => tags[t] = (tags[t] || 0) + 1); } catch {}
    });
    return ok(tags);
  }

  return err('not found', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return await api(request, env);
    return env.ASSETS.fetch(request);
  },
};
