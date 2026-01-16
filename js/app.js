// ===================================
// Typeless Meeting App - 首頁邏輯
// ===================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 App initialized');

    // DOM 元素
    const createForm = document.getElementById('createForm');
    const joinForm = document.getElementById('joinForm');

    // 建立會議
    createForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const hostName = document.getElementById('hostName').value.trim();
        const meetingTitle = document.getElementById('meetingTitle').value.trim() || '未命名會議';

        if (!hostName) {
            Utils.showError('請輸入你的名稱');
            return;
        }

        try {
            const roomCode = Utils.generateRoomCode();

            // 建立會議記錄
            const { data, error } = await supabase
                .from('meetings')
                .insert({
                    room_code: roomCode,
                    title: meetingTitle,
                    host_name: hostName,
                    status: 'active'
                })
                .select()
                .single();

            if (error) throw error;

            // 儲存使用者資訊
            Utils.saveToStorage('user', {
                name: hostName,
                isHost: true
            });

            // 前往會議室
            window.location.href = `meeting.html?room=${roomCode}`;

        } catch (err) {
            console.error('建立會議失敗:', err);
            Utils.showError('建立會議失敗，請稍後再試');
        }
    });

    // 加入會議
    joinForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const participantName = document.getElementById('participantName').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();

        if (!participantName) {
            Utils.showError('請輸入你的名稱');
            return;
        }

        if (!roomCode || roomCode.length !== 6) {
            Utils.showError('請輸入正確的 6 位數房間代碼');
            return;
        }

        try {
            // 檢查會議是否存在
            const { data, error } = await supabase
                .from('meetings')
                .select('*')
                .eq('room_code', roomCode)
                .eq('status', 'active')
                .single();

            if (error || !data) {
                Utils.showError('找不到此會議，請確認房間代碼是否正確');
                return;
            }

            // 儲存使用者資訊
            Utils.saveToStorage('user', {
                name: participantName,
                isHost: false
            });

            // 前往會議室
            window.location.href = `meeting.html?room=${roomCode}`;

        } catch (err) {
            console.error('加入會議失敗:', err);
            Utils.showError('加入會議失敗，請稍後再試');
        }
    });

    // 自動大寫房間代碼
    document.getElementById('roomCode').addEventListener('input', function (e) {
        e.target.value = e.target.value.toUpperCase();
    });
});
