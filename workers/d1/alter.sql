-- 墨韵 · 扩展功能迁移（诗集 + 评论）
-- 执行：npx wrangler d1 execute ink-pub-db --remote --file=d1/alter.sql
-- 注意：如果列已存在会报错，可以忽略那些错误

-- 添加诗集表
CREATE TABLE IF NOT EXISTS collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  user_id     TEXT NOT NULL,
  order_idx   INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- 添加评论表
CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  poem_id     INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  parent_id   INTEGER,
  content     TEXT NOT NULL,
  likes       INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- 给 poems 表添加 collection_id 列（如果不存在）
-- SQLite 不支持 IF NOT EXISTS ALTER，用以下方式绕过
CREATE TABLE IF NOT EXISTS poems_backup AS SELECT * FROM poems LIMIT 0;
DROP TABLE poems_backup;
-- 实际上直接加列，如果已存在会报错，跳过即可
ALTER TABLE poems ADD COLUMN collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL;

-- 索引
CREATE INDEX IF NOT EXISTS idx_poems_collection ON poems(collection_id);
CREATE INDEX IF NOT EXISTS idx_poems_user ON poems(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_poem ON comments(poem_id, created_at);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id, order_idx);

-- 更新已有诗歌，分配初始集名
UPDATE poems SET collection_id = NULL WHERE collection_id IS NULL;
