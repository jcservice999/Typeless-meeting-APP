// ===================================
// Typeless Meeting App - Notion 整合
// ===================================

const NotionAPI = {
    // 透過 Supabase Edge Function 呼叫 Notion API
    // Notion Keys 存在 Supabase Edge Function Secrets 裡

    /**
     * 儲存會議記錄到 Notion
     * @param {Object} meetingData - 會議資料
     * @param {string} meetingData.title - 會議主題
     * @param {string} meetingData.date - 會議日期 (ISO format)
     * @param {string} meetingData.summary - AI 生成的摘要
     * @param {string} meetingData.transcript - 完整對話記錄
     */
    async saveMeetingToNotion(meetingData) {
        try {
            // 呼叫 Supabase Edge Function（Notion Keys 存在 Edge Function Secrets）
            const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/notion-save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    meetingData: meetingData
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ 已儲存到 Notion:', result);
            return { success: true, data: result };

        } catch (err) {
            console.error('❌ 儲存到 Notion 失敗:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * 直接呼叫 Notion API（備用方案，用於有後端代理的情況）
     * 注意：這個方法無法直接從瀏覽器使用，因為 CORS 限制
     */
    async createNotionPage(title, date, summary, transcript) {
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.NOTION_API_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: CONFIG.NOTION_DATABASE_ID },
                properties: {
                    // 名稱 - Title 欄位（資料庫的第一個欄位）
                    '名稱': {
                        title: [
                            {
                                text: {
                                    content: title
                                }
                            }
                        ]
                    },
                    // 會議主題 - Text 欄位
                    '會議主題': {
                        rich_text: [
                            {
                                text: {
                                    content: title
                                }
                            }
                        ]
                    },
                    // 日期 - Date 欄位
                    '日期': {
                        date: {
                            start: date
                        }
                    },
                    // 摘要 - Text 欄位
                    '摘要': {
                        rich_text: [
                            {
                                text: {
                                    content: summary.substring(0, 2000) // Notion 限制
                                }
                            }
                        ]
                    }
                },
                // 頁面內容 - 完整對話記錄
                children: [
                    {
                        object: 'block',
                        type: 'heading_2',
                        heading_2: {
                            rich_text: [{ type: 'text', text: { content: '📝 完整對話記錄' } }]
                        }
                    },
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content: transcript.substring(0, 2000) // Notion 限制
                                    }
                                }
                            ]
                        }
                    }
                ]
            })
        });

        return response.json();
    }
};

console.log('✅ Notion API module loaded');
