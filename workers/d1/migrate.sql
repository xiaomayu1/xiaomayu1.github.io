-- 墨韵 · D1 数据库初始化（主建表）
-- 执行：npx wrangler d1 execute ink-pub-db --remote --file=d1/migrate.sql

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  bio          TEXT DEFAULT '',
  avatar_url   TEXT DEFAULT '',
  created_at   TEXT DEFAULT (datetime('now'))
);

-- 诗歌表
CREATE TABLE IF NOT EXISTS poems (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  author      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  category    TEXT DEFAULT '随笔',
  tags        TEXT DEFAULT '[]',
  likes       INTEGER DEFAULT 0,
  views       INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_poems_category ON poems(category);
CREATE INDEX IF NOT EXISTS idx_poems_created_at ON poems(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poems_likes ON poems(likes DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 预置示例诗歌
INSERT INTO poems (title, content, author, user_id, category, tags, likes, views)
VALUES
  ('静夜思', '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。', '李白', 'system', '古风', '["思乡","月亮","经典"]', 1289, 5621),
  ('春晓', '春眠不觉晓，\n处处闻啼鸟。\n夜来风雨声，\n花落知多少。', '孟浩然', 'system', '古风', '["春天","自然"]', 987, 4230),
  ('水调歌头·明月几时有', '明月几时有？把酒问青天。\n不知天上宫阙，今夕是何年。\n我欲乘风归去，又恐琼楼玉宇，高处不胜寒。\n起舞弄清影，何似在人间。\n\n转朱阁，低绮户，照无眠。\n不应有恨，何事长向别时圆？\n人有悲欢离合，月有阴晴圆缺，此事古难全。\n但愿人长久，千里共婵娟。', '苏轼', 'system', '古风', '["月亮","思念","经典"]', 2156, 8934),
  ('雨后', '雨后的天空格外蓝\n像洗过的绸缎\n阳光透过云层\n洒下金色的碎片', '墨韵', 'system', '现代诗', '["雨后","天空"]', 342, 1205),
  ('致橡树', '我如果爱你——\n绝不像攀援的凌霄花\n借你的高枝炫耀自己', '舒婷', 'system', '现代诗', '["爱情","经典"]', 1567, 6789),
  ('匆匆', '燕子去了，有再来的时候；杨柳枯了，有再青的时候；桃花谢了，有再开的时候。\n但是，聪明的，你告诉我，我们的日子为什么一去不复返呢？', '朱自清', 'system', '散文诗', '["时间","感悟"]', 876, 3456);
