// ===================================
// Typeless Meeting App - 首頁邏輯
// ===================================

document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 App initialized');

    // 初始化認證
    await Auth.init();

    // 設定事件監聽
    setupEventListeners();
});

function setupEventListeners() {
    // Google 登入按鈕
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            Auth.signInWithGoogle();
        });
    }

    // 登出按鈕
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            Auth.signOut();
        });
    }

    // 建立會議表單
    const createForm = document.getElementById('createForm');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateMeeting);
    }
}

// 載入會議室列表
async function loadMeetingsList() {
    const meetingsList = document.getElementById('meetingsList');
    if (!meetingsList) return;

    const userEmail = Auth.getUserEmail();

    try {
        // 取得所有進行中的會議
        const { data: meetings, error } = await supabase
            .from('meetings')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!meetings || meetings.length === 0) {
            meetingsList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>目前沒有進行中的會議</p>
                    <p class="empty-hint">建立一個新會議開始吧！</p>
                </div>
            `;
            return;
        }

        // 過濾可加入的會議
        const accessibleMeetings = meetings.filter(meeting => {
            // 如果沒有設定 allowed_emails，所有人可加入
            if (!meeting.allowed_emails || meeting.allowed_emails.length === 0) {
                return true;
            }
            // 檢查使用者 email 是否在允許列表中
            return meeting.allowed_emails.includes(userEmail) || meeting.host_email === userEmail;
        });

        if (accessibleMeetings.length === 0) {
            meetingsList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔒</span>
                    <p>目前沒有你可以加入的會議</p>
                </div>
            `;
            return;
        }

        // 渲染會議列表
        meetingsList.innerHTML = accessibleMeetings.map(meeting => `
            <div class="meeting-item">
                <div class="meeting-item-info">
                    <div class="meeting-item-title">${meeting.title || '未命名會議'}</div>
                    <div class="meeting-item-meta">
                        <span class="meeting-item-host">主持人：${meeting.host_name}</span>
                        <span class="meeting-item-code">代碼：${meeting.room_code}</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-small" onclick="joinMeeting('${meeting.room_code}')">
                    加入
                </button>
            </div>
        `).join('');

    } catch (err) {
        console.error('載入會議列表失敗:', err);
        meetingsList.innerHTML = `
            <div class="error-state">
                <p>載入失敗，請重新整理頁面</p>
            </div>
        `;
    }
}

// 建立會議
async function handleCreateMeeting(e) {
    e.preventDefault();

    const meetingTitle = document.getElementById('meetingTitle').value.trim();
    const allowedEmailsText = document.getElementById('allowedEmails').value.trim();

    if (!meetingTitle) {
        alert('請輸入會議主題');
        return;
    }

    const user = Utils.getFromStorage('user');
    if (!user) {
        alert('請先登入');
        return;
    }

    // 解析允許的 email
    const allowedEmails = allowedEmailsText
        ? allowedEmailsText.split('\n').map(e => e.trim().toLowerCase()).filter(e => e)
        : [];

    try {
        const roomCode = Utils.generateRoomCode();

        // 建立會議記錄
        const { data, error } = await supabase
            .from('meetings')
            .insert({
                room_code: roomCode,
                title: meetingTitle,
                host_name: user.name,
                host_email: user.email,
                allowed_emails: allowedEmails.length > 0 ? allowedEmails : null,
                status: 'active'
            })
            .select()
            .single();

        if (error) throw error;

        // 前往會議室
        window.location.href = `meeting.html?room=${roomCode}`;

    } catch (err) {
        console.error('建立會議失敗:', err);
        alert('建立會議失敗：' + err.message);
    }
}

// 加入會議
function joinMeeting(roomCode) {
    const user = Utils.getFromStorage('user');
    if (!user) {
        alert('請先登入');
        return;
    }

    window.location.href = `meeting.html?room=${roomCode}`;
}
