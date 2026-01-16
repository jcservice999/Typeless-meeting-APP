// ===================================
// Typeless Meeting App - 會議總結邏輯
// ===================================

// 狀態
let meetingId = null;
let meetingData = null;
let transcripts = [];

// DOM 元素
let elements = {};

document.addEventListener('DOMContentLoaded', async function () {
    console.log('📊 Summary page loaded');

    elements = {
        meetingTitle: document.getElementById('meetingTitle'),
        meetingDate: document.getElementById('meetingDate'),
        meetingDuration: document.getElementById('meetingDuration'),
        aiSummary: document.getElementById('aiSummary'),
        actionItems: document.getElementById('actionItems'),
        fullTranscript: document.getElementById('fullTranscript'),
        toggleTranscript: document.getElementById('toggleTranscript'),
        regenerateBtn: document.getElementById('regenerateBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        copyBtn: document.getElementById('copyBtn')
    };

    // 取得會議 ID
    meetingId = Utils.getUrlParam('meeting');
    if (!meetingId) {
        alert('無效的會議連結');
        window.location.href = 'index.html';
        return;
    }

    await loadMeetingData();
    setupEventListeners();
});

async function loadMeetingData() {
    try {
        // 取得會議資訊
        const { data: meeting, error: meetingError } = await supabase
            .from('meetings')
            .select('*')
            .eq('id', meetingId)
            .single();

        if (meetingError || !meeting) {
            throw new Error('找不到會議');
        }

        meetingData = meeting;

        // 更新標題
        elements.meetingTitle.textContent = meeting.title || '會議總結';
        elements.meetingDate.textContent = Utils.formatDateTime(meeting.created_at);

        if (meeting.ended_at) {
            elements.meetingDuration.textContent = Utils.calculateDuration(meeting.created_at, meeting.ended_at);
        } else {
            elements.meetingDuration.textContent = '進行中';
        }

        // 取得對話記錄
        const { data: transcriptData, error: transcriptError } = await supabase
            .from('transcripts')
            .select('*')
            .eq('meeting_id', meetingId)
            .order('timestamp', { ascending: true });

        if (transcriptData) {
            transcripts = transcriptData;
            displayFullTranscript();
        }

        // 檢查是否已有總結
        const { data: existingSummary } = await supabase
            .from('summaries')
            .select('*')
            .eq('meeting_id', meetingId)
            .single();

        if (existingSummary) {
            displaySummary(existingSummary);
        } else {
            // 生成新總結
            await generateSummary();
        }

    } catch (err) {
        console.error('載入會議資料失敗:', err);
        elements.aiSummary.innerHTML = '<p class="placeholder">載入失敗</p>';
    }
}

function displayFullTranscript() {
    if (transcripts.length === 0) {
        elements.fullTranscript.innerHTML = '<p class="placeholder">沒有對話記錄</p>';
        return;
    }

    let html = '';
    transcripts.forEach(t => {
        const time = Utils.formatTime(t.timestamp);
        const typeLabel = t.type === 'chat' ? '[聊天]' : '';
        html += `<div class="transcript-line">
            <span class="transcript-time">${time}</span>
            <span class="transcript-speaker">${t.speaker_name}${typeLabel}：</span>
            <span class="transcript-content">${t.content}</span>
        </div>`;
    });

    elements.fullTranscript.innerHTML = html;
}

async function generateSummary() {
    elements.aiSummary.innerHTML = `
        <div class="loading-inline">
            <span class="loading-dots"></span>
            <span>AI 正在分析會議內容...</span>
        </div>
    `;
    elements.actionItems.innerHTML = '<p class="placeholder">分析中...</p>';

    if (transcripts.length === 0) {
        elements.aiSummary.innerHTML = '<p class="placeholder">沒有足夠的對話內容可供分析</p>';
        elements.actionItems.innerHTML = '<p class="placeholder">沒有待辦事項</p>';
        return;
    }

    // 準備對話文本
    const conversationText = transcripts.map(t => {
        return `${t.speaker_name}：${t.content}`;
    }).join('\n');

    const prompt = `你是一位專業的會議記錄助理。請分析以下會議對話，並提供：

1. **會議摘要**：用 3-5 句話概述會議的主要討論內容和結論。

2. **重點決議**：列出會議中做出的重要決定。

3. **待辦事項**：列出會議中提到需要後續跟進的事項，並標註負責人（如果有提到的話）。

會議對話：
${conversationText}

請用繁體中文回覆，格式清晰易讀。`;

    try {
        const response = await fetch(CONFIG.OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Typeless Meeting App'
            },
            body: JSON.stringify({
                model: CONFIG.AI_MODEL,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }

        const data = await response.json();
        const summaryText = data.choices[0]?.message?.content || '無法生成總結';

        // 解析總結內容
        displayGeneratedSummary(summaryText);

        // 儲存總結
        await saveSummary(summaryText);

    } catch (err) {
        console.error('生成總結失敗:', err);
        elements.aiSummary.innerHTML = `<p class="placeholder">生成總結失敗：${err.message}</p>`;
    }
}

function displayGeneratedSummary(summaryText) {
    // 顯示完整總結
    elements.aiSummary.innerHTML = `<div class="summary-text">${formatSummaryText(summaryText)}</div>`;

    // 嘗試提取待辦事項
    const actionItems = extractActionItems(summaryText);
    if (actionItems.length > 0) {
        elements.actionItems.innerHTML = `<ul>${actionItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
    } else {
        elements.actionItems.innerHTML = '<p class="placeholder">沒有明確的待辦事項</p>';
    }
}

function displaySummary(summary) {
    elements.aiSummary.innerHTML = `<div class="summary-text">${formatSummaryText(summary.summary)}</div>`;

    if (summary.action_items) {
        const items = summary.action_items.split('\n').filter(item => item.trim());
        if (items.length > 0) {
            elements.actionItems.innerHTML = `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
        } else {
            elements.actionItems.innerHTML = '<p class="placeholder">沒有待辦事項</p>';
        }
    }
}

function formatSummaryText(text) {
    // 將 Markdown 風格的文本轉換為 HTML
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function extractActionItems(summaryText) {
    const items = [];
    const lines = summaryText.split('\n');
    let inActionSection = false;

    for (const line of lines) {
        if (line.includes('待辦') || line.includes('行動項目') || line.includes('後續跟進')) {
            inActionSection = true;
            continue;
        }

        if (inActionSection) {
            // 檢查是否是列表項目
            const match = line.match(/^[\s]*[-•*\d.]+[\s]*(.+)/);
            if (match) {
                items.push(match[1].trim());
            } else if (line.match(/^[\s]*[#*]+/)) {
                // 新的標題，結束待辦事項區域
                inActionSection = false;
            }
        }
    }

    return items;
}

async function saveSummary(summaryText) {
    try {
        const actionItems = extractActionItems(summaryText).join('\n');

        await supabase
            .from('summaries')
            .upsert({
                meeting_id: meetingId,
                summary: summaryText,
                action_items: actionItems
            });

    } catch (err) {
        console.error('儲存總結失敗:', err);
    }
}

function setupEventListeners() {
    // 展開/收合完整記錄
    elements.toggleTranscript.addEventListener('click', () => {
        const isCollapsed = elements.fullTranscript.classList.contains('collapsed');
        elements.fullTranscript.classList.toggle('collapsed');
        elements.toggleTranscript.textContent = isCollapsed ? '收合' : '展開';
    });

    // 重新生成
    elements.regenerateBtn.addEventListener('click', async () => {
        await generateSummary();
    });

    // 下載會議記錄
    elements.downloadBtn.addEventListener('click', () => {
        downloadMeetingRecord();
    });

    // 複製摘要
    elements.copyBtn.addEventListener('click', async () => {
        const summaryText = elements.aiSummary.innerText;
        const success = await Utils.copyToClipboard(summaryText);
        if (success) {
            elements.copyBtn.innerHTML = '<span>✅</span> 已複製';
            setTimeout(() => {
                elements.copyBtn.innerHTML = '<span>📋</span> 複製摘要';
            }, 2000);
        }
    });
}

function downloadMeetingRecord() {
    const title = meetingData?.title || '會議記錄';
    const date = Utils.formatDateTime(meetingData?.created_at || new Date());

    let content = `# ${title}\n\n`;
    content += `日期：${date}\n\n`;

    // 加入 AI 總結
    content += `## AI 會議摘要\n\n`;
    content += elements.aiSummary.innerText + '\n\n';

    // 加入待辦事項
    content += `## 待辦事項\n\n`;
    content += elements.actionItems.innerText + '\n\n';

    // 加入完整對話記錄
    content += `## 完整對話記錄\n\n`;
    transcripts.forEach(t => {
        const time = Utils.formatTime(t.timestamp);
        content += `[${time}] ${t.speaker_name}：${t.content}\n`;
    });

    // 下載
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

console.log('✅ Summary.js loaded');
