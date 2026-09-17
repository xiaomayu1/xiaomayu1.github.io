-- ============================================
-- 墨韵 · Supabase 数据库初始化 SQL
-- ============================================
-- 在 Supabase Dashboard → SQL Editor 中粘贴执行
-- ============================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. 诗歌表
CREATE TABLE IF NOT EXISTS poems (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  author      TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  collection  TEXT DEFAULT '',
  category    TEXT DEFAULT '随笔',
  tags        JSONB DEFAULT '[]',
  likes       INTEGER DEFAULT 0,
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_poems_category ON poems(category);
CREATE INDEX IF NOT EXISTS idx_poems_created_at ON poems(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poems_likes ON poems(likes DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 4. 启用 RLS（行级安全）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE poems ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略：用户可查自己的信息，诗歌公开可读
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id OR auth.uid() IS NULL);

CREATE POLICY "poems_select_all" ON poems
  FOR SELECT USING (true);

CREATE POLICY "poems_insert_own" ON poems
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "poems_update_own" ON poems
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "poems_delete_own" ON poems
  FOR DELETE USING (auth.uid() = user_id);

-- 6. 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER poems_updated_at
  BEFORE UPDATE ON poems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. 点赞自增函数
CREATE OR REPLACE FUNCTION increment_poem_likes(p_id BIGINT)
RETURNS poems AS $$
DECLARE result poems;
BEGIN
  UPDATE poems SET likes = likes + 1 WHERE id = p_id RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 浏览自增函数
CREATE OR REPLACE FUNCTION increment_poem_views(p_id BIGINT)
RETURNS poems AS $$
DECLARE result poems;
BEGIN
  UPDATE poems SET views = views + 1 WHERE id = p_id RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 预置示例诗歌（system 用户，user_id 为 null）
INSERT INTO poems (title, content, author, user_id, category, tags, likes, views)
VALUES
  ('静夜思', '床前明月光，
疑是地上霜。
举头望明月，
低头思故乡。', '李白', NULL, '古风', '["思乡","月亮","经典"]'::jsonb, 1289, 5621),
  ('春晓', '春眠不觉晓，
处处闻啼鸟。
夜来风雨声，
花落知多少。', '孟浩然', NULL, '古风', '["春天","自然"]'::jsonb, 987, 4230),
  ('水调歌头·明月几时有', '明月几时有？把酒问青天。
不知天上宫阙，今夕是何年。
我欲乘风归去，又恐琼楼玉宇，高处不胜寒。
起舞弄清影，何似在人间。

转朱阁，低绮户，照无眠。
不应有恨，何事长向别时圆？
人有悲欢离合，月有阴晴圆缺，此事古难全。
但愿人长久，千里共婵娟。', '苏轼', NULL, '古风', '["月亮","思念","经典"]'::jsonb, 2156, 8934),
  ('雨后', '雨后的天空格外蓝
像洗过的绸缎
阳光透过云层
洒下金色的碎片', '墨韵', NULL, '现代诗', '["雨后","天空"]'::jsonb, 342, 1205),
  ('致橡树', '我如果爱你——
绝不像攀援的凌霄花
借你的高枝炫耀自己', '舒婷', NULL, '现代诗', '["爱情","经典"]'::jsonb, 1567, 6789),
  ('匆匆', '燕子去了，有再来的时候；杨柳枯了，有再青的时候；桃花谢了，有再开的时候。
但是，聪明的，你告诉我，我们的日子为什么一去不复返呢？', '朱自清', NULL, '散文诗', '["时间","感悟"]'::jsonb, 876, 3456)
ON CONFLICT DO NOTHING;
