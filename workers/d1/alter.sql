-- 墨韵 · 扩展功能迁移（评论表 + 诗集表）
-- 执行：npx wrangler d1 execute ink-pub-db --remote --file=d1/alter.sql
-- 部分语句可能因重复执行报错，可忽略

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  poem_id     INTEGER NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  likes       INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- 诗集表
CREATE TABLE IF NOT EXISTS collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  user_id     TEXT NOT NULL REFERENCES users(id),
  order_idx   INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_comments_poem ON comments(poem_id, created_at);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id, order_idx);
