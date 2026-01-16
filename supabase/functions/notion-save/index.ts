// Supabase Edge Function: notion-save
// 用途：作為代理呼叫 Notion API（繞過 CORS 限制）
// 
// 部署步驟：
// 1. 安裝 Supabase CLI: npm install -g supabase
// 2. 登入: supabase login
// 3. 連接專案: supabase link --project-ref ognyftdlwmuubwlvrmbz
// 4. 部署: supabase functions deploy notion-save --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // 處理 CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { notionApiKey, databaseId, meetingData } = await req.json();

        if (!notionApiKey || !databaseId || !meetingData) {
            return new Response(
                JSON.stringify({ error: '缺少必要參數' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { title, date, summary, transcript } = meetingData;

        // 呼叫 Notion API 建立頁面
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionApiKey}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: databaseId },
                properties: {
                    // 名稱 - Title 欄位
                    '名稱': {
                        title: [
                            {
                                text: {
                                    content: title || '未命名會議'
                                }
                            }
                        ]
                    },
                    // 會議主題 - Text 欄位
                    '會議主題': {
                        rich_text: [
                            {
                                text: {
                                    content: title || '未命名會議'
                                }
                            }
                        ]
                    },
                    // 日期 - Date 欄位
                    '日期': {
                        date: {
                            start: date || new Date().toISOString().split('T')[0]
                        }
                    },
                    // 摘要 - Text 欄位
                    '摘要': {
                        rich_text: [
                            {
                                text: {
                                    content: (summary || '').substring(0, 2000)
                                }
                            }
                        ]
                    }
                },
                // 頁面內容 - 完整對話記錄
                children: buildTranscriptBlocks(transcript)
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Notion API Error:', result);
            return new Response(
                JSON.stringify({ error: result.message || 'Notion API 錯誤', details: result }),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, pageId: result.id, url: result.url }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

// 將對話記錄分割成多個 block（Notion 單一文字區塊限制 2000 字元）
function buildTranscriptBlocks(transcript) {
    const blocks = [
        {
            object: 'block',
            type: 'heading_2',
            heading_2: {
                rich_text: [{ type: 'text', text: { content: '📝 完整對話記錄' } }]
            }
        }
    ];

    if (!transcript) {
        blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{ type: 'text', text: { content: '（無對話記錄）' } }]
            }
        });
        return blocks;
    }

    // 分割長文本
    const chunkSize = 1900;
    for (let i = 0; i < transcript.length; i += chunkSize) {
        const chunk = transcript.substring(i, i + chunkSize);
        blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{ type: 'text', text: { content: chunk } }]
            }
        });
    }

    return blocks;
}
