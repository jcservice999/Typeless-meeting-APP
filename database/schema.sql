-- ===================================
-- Typeless Meeting App - 資料庫結構
-- 在 Supabase SQL Editor 中執行此腳本
-- ===================================

-- 會議室資料表
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    title TEXT,
    host_name TEXT,
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
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON transcripts(timestamp);

-- 啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE transcripts;

-- 設定 RLS (Row Level Security) - 暫時關閉以便測試
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- 允許匿名使用者存取（開發用，正式環境應加上更嚴格的規則）
CREATE POLICY "Allow all access to meetings" ON meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to transcripts" ON transcripts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to summaries" ON summaries FOR ALL USING (true) WITH CHECK (true);
