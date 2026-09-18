/**
 * Cloudflare Worker — Ink Pub API
 * Database: Cloudflare D1 (SQLite)
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
const q = (env, sql, params = []) => env.DB.prepare(sql).bind(...params).all();
const run = (env, sql, params = []) => env.DB.prepare(sql).bind(...params).run();
const first = (env, sql, params = []) => env.DB.prepare(sql).bind(...params).first();
const parseTags = (v) => { try { return JSON.parse(v); } catch { return []; } };

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
    const user = await first(env, 'SELECT id, username, display_name, bio, avatar_url, created_at FROM users WHERE id = ?', [u.id]);
    if (!user) return err('not found', 404);
    return ok(user);
  }

  if (pathname === '/api/auth/profile' && method === 'PUT') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const { bio, avatar_url } = await req.json();
    await run(env, 'UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?',
      [(bio || '').slice(0, 200), (avatar_url || '').slice(0, 500), u.id]);
    return ok({ ok: true });
  }

  // ── Users / Profile ──
  if (/^\/api\/users\/[\w-]+$/.test(pathname) && method === 'GET') {
    const username = pathname.split('/')[3];
    const user = await first(env,
      'SELECT id, username, display_name, bio, avatar_url, created_at FROM users WHERE username = ?',
      [username]);
    if (!user) return err('not found', 404);
    const poems = await q(env,
      'SELECT id, title, content, category, tags, likes, views, created_at FROM poems WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [user.id]);
    const collections = await q(env,
      'SELECT id, name, description, order_idx FROM collections WHERE user_id = ? ORDER BY order_idx ASC',
      [user.id]);
    return ok({
      id: user.id, username: user.username, display_name: user.display_name,
      bio: user.bio, avatar_url: user.avatar_url, created_at: user.created_at,
      poem_count: poems?.length || 0,
      collection_count: collections?.length || 0,
      poems: poems || [],
      collections: collections || [],
    });
  }

  // ── Collections ──
  if (pathname === '/api/collections' && method === 'GET') {
    const { user_id } = Object.fromEntries(url.searchParams);
    let sql = 'SELECT c.*, u.display_name as author_name FROM collections c LEFT JOIN users u ON c.user_id = u.id';
    const binds = [];
    if (user_id) { sql += ' WHERE c.user_id = ?'; binds.push(user_id); }
    sql += ' ORDER BY c.order_idx ASC';
    return ok(await q(env, sql, binds));
  }

  if (pathname === '/api/collections' && method === 'POST') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const { name, description, order_idx } = await req.json();
    if (!name) return err('诗集名称不能为空', 400);
    const maxOrder = await first(env, 'SELECT MAX(order_idx) as m FROM collections WHERE user_id = ?', [u.id]);
    await run(env,
      'INSERT INTO collections (name, description, user_id, order_idx) VALUES (?, ?, ?, ?)',
      [name.trim(), (description || '').trim(), u.id, (order_idx ?? (maxOrder?.m ?? -1) + 1)]);
    const coll = await first(env, 'SELECT * FROM collections WHERE id = last_insert_rowid()');
    return ok(coll, 201);
  }

  if (/^\/api\/collections\/\d+$/.test(pathname) && method === 'PUT') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const id = parseInt(pathname.split('/')[3]);
    const existing = await first(env, 'SELECT user_id FROM collections WHERE id = ?', [id]);
    if (!existing) return err('not found', 404);
    if (existing.user_id !== u.id) return err('无权编辑', 403);
    const { name, description, order_idx } = await req.json();
    await run(env,
      'UPDATE collections SET name=?, description=?, order_idx=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [name, description, order_idx, id]);
    return ok(await first(env, 'SELECT * FROM collections WHERE id = ?', [id]));
  }

  if (/^\/api\/collections\/\d+$/.test(pathname) && method === 'DELETE') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const id = parseInt(pathname.split('/')[3]);
    const existing = await first(env, 'SELECT user_id FROM collections WHERE id = ?', [id]);
    if (!existing) return err('not found', 404);
    if (existing.user_id !== u.id) return err('无权删除', 403);
    await run(env, 'DELETE FROM collections WHERE id = ?', [id]);
    return ok({ ok: true });
  }

  // ── Poems ──
  if (pathname === '/api/poems' && method === 'GET') {
    const params = Object.fromEntries(url.searchParams);
    let sql = 'SELECT * FROM poems';
    const binds = [];
    const where = [];
    if (params.category) { where.push('category = ?'); binds.push(params.category); }
    if (params.tag) { where.push(`tags LIKE ?`); binds.push(`%"${params.tag}"%`); }
    if (params.collection_id) { where.push('collection_id = ?'); binds.push(parseInt(params.collection_id)); }
    if (params.user_id) { where.push('user_id = ?'); binds.push(params.user_id); }
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
    return ok(await q(env, sql, binds));
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
    const { title, content, collection, collection_id, category, tags } = await req.json();
    if (!title || !content) return err('标题和正文不能为空', 400);
    await run(env,
      `INSERT INTO poems (title, content, author, user_id, collection_id, category, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title.trim(), content.trim(), u.displayName, u.id, collection_id || null,
       category || '随笔', JSON.stringify(tags || [])]);
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
    const { title, content, collection_id, category, tags } = await req.json();
    await run(env,
      `UPDATE poems SET title=?, content=?, collection_id=?, category=?, tags=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [title, content, collection_id || null, category, JSON.stringify(tags), id]);
    return ok(await first(env, 'SELECT * FROM poems WHERE id = ?', [id]));
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

  // ── Comments ──
  if (pathname.startsWith('/api/poems/') && pathname.endsWith('/comments') && method === 'GET') {
    const poemId = parseInt(pathname.split('/')[3]);
    const comments = await q(env,
      `SELECT c.*, u.display_name, u.username
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.poem_id = ? AND c.parent_id IS NULL
       ORDER BY c.created_at ASC`,
      [poemId]);
    return ok(comments || []);
  }

  if (pathname.startsWith('/api/comments/') && pathname.endsWith('/replies') && method === 'GET') {
    const parentId = parseInt(pathname.split('/')[3]);
    const replies = await q(env,
      `SELECT c.*, u.display_name, u.username
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.parent_id = ? ORDER BY c.created_at ASC`,
      [parentId]);
    return ok(replies || []);
  }

  if (pathname.startsWith('/api/poems/') && pathname.endsWith('/comments') && method === 'POST') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const poemId = parseInt(pathname.split('/')[3]);
    const { content, parent_id } = await req.json();
    if (!content) return err('评论内容不能为空', 400);
    const poem = await first(env, 'SELECT id FROM poems WHERE id = ?', [poemId]);
    if (!poem) return err('诗歌不存在', 404);
    if (parent_id) {
      const parent = await first(env, 'SELECT id FROM comments WHERE id = ? AND poem_id = ?', [parent_id, poemId]);
      if (!parent) return err('回复的目标评论不存在', 400);
    }
    const comment = await first(env,
      'INSERT INTO comments (poem_id, user_id, parent_id, content) VALUES (?, ?, ?, ?) RETURNING *, u.display_name, u.username',
      [poemId, u.id, parent_id || null, content.trim()]);
    // SQLite doesn't support RETURNING with JOIN, fetch separately
    const full = await first(env,
      `SELECT c.*, u.display_name, u.username FROM comments c
       JOIN users u ON c.user_id = u.id WHERE c.id = last_insert_rowid()`, []);
    return ok(full, 201);
  }

  if (/^\/api\/comments\/\d+$/.test(pathname) && method === 'DELETE') {
    const u = auth(req, env);
    if (!u) return err('未登录', 401);
    const id = parseInt(pathname.split('/')[3]);
    const comment = await first(env, 'SELECT user_id FROM comments WHERE id = ?', [id]);
    if (!comment) return err('not found', 404);
    if (comment.user_id !== u.id) return err('无权删除', 403);
    await run(env, 'DELETE FROM comments WHERE id = ?', [id]);
    return ok({ ok: true });
  }

  // ── Stats & Tags ──
  if (pathname === '/api/stats' && method === 'GET') {
    const poems = await q(env, 'SELECT category, tags, likes, views FROM poems');
    const cats = {}, tags = {};
    (poems || []).forEach(p => {
      cats[p.category] = (cats[p.category] || 0) + 1;
      parseTags(p.tags).forEach(t => tags[t] = (tags[t] || 0) + 1);
    });
    return ok({
      total: poems?.length || 0,
      totalLikes: poems?.reduce((s, p) => s + (p.likes || 0), 0) || 0,
      totalViews: poems?.reduce((s, p) => s + (p.views || 0), 0) || 0,
      categories: cats, tags,
    });
  }

  if (pathname === '/api/tags' && method === 'GET') {
    const poems = await q(env, 'SELECT tags FROM poems');
    const tags = {};
    (poems || []).forEach(p => parseTags(p.tags).forEach(t => tags[t] = (tags[t] || 0) + 1));
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
