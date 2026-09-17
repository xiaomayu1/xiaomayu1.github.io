/**
 * Cloudflare Worker — Ink Pub API
 *
 * 部署前需要配置以下环境变量：
 *   SUPABASE_URL   — Supabase 项目 URL
 *   SUPABASE_KEY   — Supabase service_role key
 *   JWT_SECRET     — JWT 签名密钥（自定义）
 *
 * 数据库初始化 SQL 见 README.md
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'moyun-jwt-change-in-production';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──
const ok = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});
const err = (msg, status = 400) => ok({ error: msg }, status);
const cors = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
});
const auth = (req) => {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET); } catch { return null; }
};

// ── CORS preflight ──
const handleOptions = () => new Response(null, { headers: cors() });

// ── Routes ──
async function api(req, url) {
  const { pathname } = url;
  const method = req.method;

  if (method === 'OPTIONS') return new Response(null, { headers: cors() });

  // ── Auth ──
  if (pathname === '/api/auth/register' && method === 'POST') {
    const { username, password, displayName } = await req.json();
    if (!username || !password) return err('请填写用户名和密码', 400);
    if (password.length < 3) return err('密码至少3个字符', 400);
    if (username.length < 2 || username.length > 20) return err('用户名2-20个字符', 400);

    const { data: dup } = await supabase.from('users').select('id').eq('username', username.trim()).single();
    if (dup) return err('用户名已存在', 409);

    const hashed = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('users')
      .insert([{ username: username.trim(), display_name: (displayName || username.trim()).trim(), password_hash: hashed }])
      .select('id, username, display_name')
      .single();
    if (error) return err(error.message, 500);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return ok({ token, user: { id: user.id, username: user.username, displayName: user.display_name } });
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const { username, password } = await req.json();
    if (!username || !password) return err('请填写用户名和密码', 400);
    const { data: user, error } = await supabase
      .from('users').select('id, username, display_name, password_hash')
      .eq('username', username.trim()).single();
    if (error || !user) return err('用户名或密码错误', 401);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return err('用户名或密码错误', 401);
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return ok({ token, user: { id: user.id, username: user.username, displayName: user.display_name } });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const u = auth(req);
    if (!u) return err('未登录', 401);
    const { data, error } = await supabase.from('users').select('id, username, display_name').eq('id', u.id).single();
    if (error || !data) return err('not found', 404);
    return ok({ id: data.id, username: data.username, displayName: data.display_name });
  }

  // ── Poems ──
  if (pathname === '/api/poems' && method === 'GET') {
    const params = Object.fromEntries(url.searchParams);
    let q = supabase.from('poems').select('*');
    if (params.category) q = q.eq('category', params.category);
    if (params.tag) q = q.filter('tags', 'cs', `{${params.tag}}`);
    if (params.q) {
      const k = `%${params.q}%`;
      q = q.or(`title.ilike.${k},content.ilike.${k},author.ilike.${k}`);
    }
    const sortBy = params.sort === 'likes' ? 'likes' : 'created_at';
    q = q.order(sortBy, { ascending: params.sort === 'oldest' }).limit(parseInt(params.limit) || 100);
    const { data, error } = await q;
    if (error) return err(error.message, 500);
    return ok(data);
  }

  if (/^\/api\/poems\/\d+$/.test(pathname) && method === 'GET') {
    const id = pathname.split('/')[3];
    const { data, error } = await supabase.from('poems').select('*').eq('id', id).single();
    if (error || !data) return err('not found', 404);
    return ok(data);
  }

  if (pathname === '/api/poems' && method === 'POST') {
    const u = auth(req);
    if (!u) return err('未登录', 401);
    const { title, content, collection, category, tags } = await req.json();
    if (!title || !content) return err('标题和正文不能为空', 400);
    const { data, error } = await supabase.from('poems').insert([{
      title: title.trim(), content: content.trim(), author: u.displayName,
      user_id: u.id, collection: (collection || '').trim(),
      category: category || '随笔', tags: tags || [],
    }]).select('*').single();
    if (error) return err(error.message, 500);
    return ok(data, 201);
  }

  if (/^\/api\/poems\/\d+$/.test(pathname) && method === 'PUT') {
    const u = auth(req);
    if (!u) return err('未登录', 401);
    const id = pathname.split('/')[3];
    const { data: existing } = await supabase.from('poems').select('user_id').eq('id', id).single();
    if (!existing) return err('not found', 404);
    if (existing.user_id !== u.id) return err('无权编辑此诗', 403);
    const { title, content, collection, category, tags } = await req.json();
    const { data, error } = await supabase.from('poems')
      .update({ title, content, collection, category, tags, updated_at: new Date().toISOString() })
      .eq('id', id).select('*').single();
    if (error) return err(error.message, 500);
    return ok(data);
  }

  if (/^\/api\/poems\/\d+$/.test(pathname) && method === 'DELETE') {
    const u = auth(req);
    if (!u) return err('未登录', 401);
    const id = pathname.split('/')[3];
    const { data: existing } = await supabase.from('poems').select('user_id').eq('id', id).single();
    if (!existing) return err('not found', 404);
    if (existing.user_id !== u.id) return err('无权删除此诗', 403);
    const { error } = await supabase.from('poems').delete().eq('id', id);
    if (error) return err(error.message, 500);
    return ok({ ok: true });
  }

  if (/^\/api\/poems\/\d+\/like$/.test(pathname) && method === 'POST') {
    const u = auth(req);
    if (!u) return err('未登录', 401);
    const id = pathname.split('/')[3];
    const { data: p, error } = await supabase.rpc('increment_poem_likes', { p_id: parseInt(id) });
    if (error) {
      // fallback
      const { data: cur } = await supabase.from('poems').select('likes').eq('id', id).single();
      const { data: updated } = await supabase.from('poems').update({ likes: (cur?.likes || 0) + 1 }).eq('id', id).select('likes').single();
      return ok({ likes: updated?.likes });
    }
    return ok({ likes: p?.likes });
  }

  if (/^\/api\/poems\/\d+\/view$/.test(pathname) && method === 'POST') {
    const id = pathname.split('/')[3];
    const { error } = await supabase.rpc('increment_poem_views', { p_id: parseInt(id) });
    if (error) {
      const { data: cur } = await supabase.from('poems').select('views').eq('id', id).single();
      await supabase.from('poems').update({ views: (cur?.views || 0) + 1 }).eq('id', id);
    }
    return ok({ ok: true });
  }

  // ── Stats & Tags ──
  if (pathname === '/api/stats' && method === 'GET') {
    const { data: poems } = await supabase.from('poems').select('category, tags, likes, views');
    const cats = {}, tags = {};
    (poems || []).forEach(p => {
      cats[p.category] = (cats[p.category] || 0) + 1;
      (p.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1);
    });
    return ok({
      total: poems?.length || 0,
      totalLikes: poems?.reduce((s, p) => s + (p.likes || 0), 0) || 0,
      totalViews: poems?.reduce((s, p) => s + (p.views || 0), 0) || 0,
      categories: cats, tags,
    });
  }

  if (pathname === '/api/tags' && method === 'GET') {
    const { data: poems } = await supabase.from('poems').select('tags');
    const tags = {};
    (poems || []).forEach(p => (p.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1));
    return ok(tags);
  }

  return err('not found', 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return await api(request, url);
    // Static assets served by Cloudflare Pages
    return env.ASSETS.fetch(request);
  },
};
