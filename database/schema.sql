-- ===================================
-- Typeless Meeting App - 資料庫結構 (v2)
-- 在 Supabase SQL Editor 中執行此腳本
-- ===================================

-- 會議室資料表
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    title TEXT,
    host_name TEXT,
    host_email TEXT,
    allowed_emails TEXT[],  -- 允許加入的 email 陣列
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active'
);

-- 字幕/轉錄記錄
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    speaker_name TEXT,
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type TEXT DEFAULT 'subtitle' -- 'subtitle' | 'chat'
);

-- 會議總結
CREATE TABLE IF NOT EXISTS summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    summary TEXT,
    action_items TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_meetings_room_code ON meetings(room_code);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_host_email ON meetings(host_email);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON transcripts(timestamp);

-- 啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE transcripts;

-- 設定 RLS (Row Level Security)
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- 允許已認證使用者存取
CREATE POLICY "Allow authenticated access to meetings" ON meetings 
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon') 
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow authenticated access to transcripts" ON transcripts 
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon') 
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Allow authenticated access to summaries" ON summaries 
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon') 
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- ===================================
-- 更新現有資料表（如果已存在）
-- ===================================
-- 執行這些語句來添加新欄位到現有資料表：
-- ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_email TEXT;
-- ALTER TABLE meetings ADD COLUMN IF NOT EXISTS allowed_emails TEXT[];
