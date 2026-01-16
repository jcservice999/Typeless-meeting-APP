// ===================================
// Typeless Meeting App - 會議室邏輯
// ===================================

// 會議狀態
const MeetingState = {
    roomCode: null,
    meetingId: null,
    meetingTitle: null,
    user: null,
    participants: new Map(),
    isHost: false,
    isMicOn: false,
    isSpeakerOn: true,
    localStream: null,
    peer: null,
    connections: new Map(),
    realtimeChannel: null
};

// DOM 元素
let elements = {};

// ===================================
// 初始化
// ===================================

document.addEventListener('DOMContentLoaded', async function () {
    console.log('🎤 Meeting page loaded');

    // 取得 DOM 元素
    elements = {
        roomCodeDisplay: document.getElementById('roomCodeDisplay'),
        meetingTitleDisplay: document.getElementById('meetingTitleDisplay'),
        copyRoomCode: document.getElementById('copyRoomCode'),
        participantList: document.getElementById('participantList'),
        participantCount: document.getElementById('participantCount'),
        subtitleDisplay: document.getElementById('subtitleDisplay'),
        subtitleInput: document.getElementById('subtitleInput'),
        sendSubtitleBtn: document.getElementById('sendSubtitleBtn'),
        fontSizeSlider: document.getElementById('fontSizeSlider'),
        fontSizeValue: document.getElementById('fontSizeValue'),
        chatMessages: document.getElementById('chatMessages'),
        chatForm: document.getElementById('chatForm'),
        chatInput: document.getElementById('chatInput'),
        micBtn: document.getElementById('micBtn'),
        speakerBtn: document.getElementById('speakerBtn'),
        endMeetingBtn: document.getElementById('endMeetingBtn'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        permissionModal: document.getElementById('permissionModal'),
        endMeetingModal: document.getElementById('endMeetingModal'),
        audioContainer: document.getElementById('audioContainer')
    };

    // 取得房間代碼
    MeetingState.roomCode = Utils.getUrlParam('room');
    if (!MeetingState.roomCode) {
        alert('無效的會議連結');
        window.location.href = 'index.html';
        return;
    }

    // 取得使用者資訊
    MeetingState.user = Utils.getFromStorage('user');
    if (!MeetingState.user) {
        alert('請先輸入你的名稱');
        window.location.href = 'index.html';
        return;
    }

    MeetingState.isHost = MeetingState.user.isHost;

    // 初始化會議
    await initMeeting();
});

async function initMeeting() {
    try {
        // 取得會議資訊
        const { data: meeting, error } = await supabase
            .from('meetings')
            .select('*')
            .eq('room_code', MeetingState.roomCode)
            .eq('status', 'active')
            .single();

        if (error || !meeting) {
            alert('會議不存在或已結束');
            window.location.href = 'index.html';
            return;
        }

        MeetingState.meetingId = meeting.id;
        MeetingState.meetingTitle = meeting.title;

        // 更新 UI
        elements.roomCodeDisplay.textContent = MeetingState.roomCode;
        elements.meetingTitleDisplay.textContent = MeetingState.meetingTitle;

        // 設定事件監聽
        setupEventListeners();

        // 初始化即時訂閱
        await setupRealtimeSubscription();

        // 加入參與者列表
        await joinAsParticipant();

        // 載入現有字幕
        await loadExistingTranscripts();

        // 隱藏載入畫面，顯示權限請求
        elements.loadingOverlay.classList.add('hidden');

        // 請求麥克風權限
        showPermissionModal();

    } catch (err) {
        console.error('初始化會議失敗:', err);
        alert('載入會議失敗');
        window.location.href = 'index.html';
    }
}

// ===================================
// 麥克風權限
// ===================================

function showPermissionModal() {
    elements.permissionModal.classList.remove('hidden');

    document.getElementById('requestMicBtn').onclick = async () => {
        await requestMicrophonePermission();
        elements.permissionModal.classList.add('hidden');
    };

    document.getElementById('skipMicBtn').onclick = () => {
        elements.permissionModal.classList.add('hidden');
        // 初始化 PeerJS 但不啟用麥克風
        initPeerJS();
    };
}

async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        MeetingState.localStream = stream;
        MeetingState.isMicOn = true;
        updateMicButton();

        console.log('✅ 麥克風權限已獲得');

        // 初始化 PeerJS
        initPeerJS();

    } catch (err) {
        console.error('無法存取麥克風:', err);
        alert('無法存取麥克風。你仍可以看到字幕和聊天訊息。');
        initPeerJS();
    }
}

// ===================================
// PeerJS (WebRTC)
// ===================================

function initPeerJS() {
    const peerId = `${MeetingState.roomCode}-${Utils.generateId()}`;

    MeetingState.peer = new Peer(peerId, {
        debug: 1
    });

    MeetingState.peer.on('open', (id) => {
        console.log('✅ PeerJS 已連接，ID:', id);
        // 廣播自己的 Peer ID
        broadcastPeerId(id);
    });

    MeetingState.peer.on('call', (call) => {
        console.log('📞 收到通話請求');
        // 接聽來電
        call.answer(MeetingState.localStream);
        handleCall(call);
    });

    MeetingState.peer.on('error', (err) => {
        console.error('PeerJS 錯誤:', err);
    });
}

async function broadcastPeerId(peerId) {
    // 透過 Supabase Realtime 廣播 Peer ID
    if (MeetingState.realtimeChannel) {
        await MeetingState.realtimeChannel.send({
            type: 'broadcast',
            event: 'peer_joined',
            payload: {
                peerId: peerId,
                userName: MeetingState.user.name
            }
        });
    }
}

function handleCall(call) {
    MeetingState.connections.set(call.peer, call);

    call.on('stream', (remoteStream) => {
        console.log('🔊 收到遠端音訊串流');
        addRemoteAudio(call.peer, remoteStream);
    });

    call.on('close', () => {
        console.log('📴 通話結束');
        removeRemoteAudio(call.peer);
        MeetingState.connections.delete(call.peer);
    });
}

function callPeer(peerId) {
    if (!MeetingState.peer || MeetingState.connections.has(peerId)) return;

    console.log('📞 呼叫 Peer:', peerId);
    const call = MeetingState.peer.call(peerId, MeetingState.localStream);
    if (call) {
        handleCall(call);
    }
}

function addRemoteAudio(peerId, stream) {
    // 檢查是否已存在
    if (document.getElementById(`audio-${peerId}`)) return;

    const audio = document.createElement('audio');
    audio.id = `audio-${peerId}`;
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.muted = !MeetingState.isSpeakerOn;
    elements.audioContainer.appendChild(audio);
}

function removeRemoteAudio(peerId) {
    const audio = document.getElementById(`audio-${peerId}`);
    if (audio) {
        audio.remove();
    }
}

// ===================================
// Supabase Realtime
// ===================================

async function setupRealtimeSubscription() {
    const channelName = `meeting-${MeetingState.roomCode}`;

    MeetingState.realtimeChannel = supabase.channel(channelName, {
        config: {
            broadcast: { self: false }
        }
    });

    // 訂閱字幕/聊天訊息
    MeetingState.realtimeChannel
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'transcripts',
            filter: `meeting_id=eq.${MeetingState.meetingId}`
        }, (payload) => {
            handleNewTranscript(payload.new);
        })
        // 訂閱 Peer 加入事件
        .on('broadcast', { event: 'peer_joined' }, (payload) => {
            console.log('👤 新參與者加入:', payload.payload);
            const { peerId, userName } = payload.payload;

            // 新增到參與者列表
            addParticipant(peerId, userName);

            // 呼叫新加入的 Peer
            if (MeetingState.localStream) {
                callPeer(peerId);
            }
        })
        // 訂閱參與者離開事件
        .on('broadcast', { event: 'peer_left' }, (payload) => {
            console.log('👤 參與者離開:', payload.payload);
            const { peerId } = payload.payload;
            removeParticipant(peerId);
        })
        // 訂閱會議結束事件
        .on('broadcast', { event: 'meeting_ended' }, (payload) => {
            console.log('🔴 會議已結束');
            window.location.href = `summary.html?meeting=${MeetingState.meetingId}`;
        })
        .subscribe();

    console.log('✅ Realtime 訂閱已建立');
}

// ===================================
// 參與者管理
// ===================================

async function joinAsParticipant() {
    // 加入自己
    addParticipant('self', MeetingState.user.name, true);
}

function addParticipant(peerId, name, isSelf = false) {
    if (MeetingState.participants.has(peerId)) return;

    MeetingState.participants.set(peerId, { name, isSelf });
    renderParticipants();
}

function removeParticipant(peerId) {
    MeetingState.participants.delete(peerId);
    removeRemoteAudio(peerId);
    renderParticipants();
}

function renderParticipants() {
    elements.participantList.innerHTML = '';

    MeetingState.participants.forEach((participant, peerId) => {
        const li = document.createElement('li');
        li.className = 'participant-item';
        li.innerHTML = `
            <div class="participant-avatar">${Utils.getInitials(participant.name)}</div>
            <span class="participant-name">${participant.name}${participant.isSelf ? ' (你)' : ''}</span>
            <span class="participant-status"></span>
        `;
        elements.participantList.appendChild(li);
    });

    elements.participantCount.textContent = MeetingState.participants.size;
}

// ===================================
// 字幕處理
// ===================================

async function loadExistingTranscripts() {
    const { data, error } = await supabase
        .from('transcripts')
        .select('*')
        .eq('meeting_id', MeetingState.meetingId)
        .order('timestamp', { ascending: true });

    if (data && data.length > 0) {
        // 清除佔位符
        elements.subtitleDisplay.innerHTML = '';

        data.forEach(transcript => {
            displayTranscript(transcript);
        });
    }
}

function handleNewTranscript(transcript) {
    // 清除佔位符（如果存在）
    const placeholder = elements.subtitleDisplay.querySelector('.subtitle-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    displayTranscript(transcript);
}

function displayTranscript(transcript) {
    const div = document.createElement('div');
    div.className = `subtitle-item ${transcript.type === 'chat' ? 'chat-type' : ''}`;

    const fontSize = elements.fontSizeSlider.value;

    div.innerHTML = `
        <div class="subtitle-speaker">${transcript.speaker_name}</div>
        <div class="subtitle-text" style="font-size: ${fontSize}px">${transcript.content}</div>
        <div class="subtitle-time">${Utils.formatTime(transcript.timestamp)}</div>
    `;

    elements.subtitleDisplay.appendChild(div);

    // 自動捲動到底部
    elements.subtitleDisplay.scrollTop = elements.subtitleDisplay.scrollHeight;
}

async function sendSubtitle() {
    const content = elements.subtitleInput.value.trim();
    if (!content) return;

    try {
        await supabase
            .from('transcripts')
            .insert({
                meeting_id: MeetingState.meetingId,
                speaker_name: MeetingState.user.name,
                content: content,
                type: 'subtitle'
            });

        elements.subtitleInput.value = '';
    } catch (err) {
        console.error('送出字幕失敗:', err);
    }
}

// 即時發送字幕（當 Typeless 輸入時）
let subtitleDebounceTimer = null;
function setupTypelessInput() {
    elements.subtitleInput.addEventListener('input', () => {
        // 使用防抖，避免太頻繁送出
        clearTimeout(subtitleDebounceTimer);
        subtitleDebounceTimer = setTimeout(() => {
            const content = elements.subtitleInput.value.trim();
            if (content && content.length > 10) { // 至少 10 個字才送出
                sendSubtitle();
            }
        }, 1500); // 1.5 秒沒有新輸入就送出
    });
}

// ===================================
// 聊天功能
// ===================================

async function sendChatMessage() {
    const content = elements.chatInput.value.trim();
    if (!content) return;

    try {
        await supabase
            .from('transcripts')
            .insert({
                meeting_id: MeetingState.meetingId,
                speaker_name: MeetingState.user.name,
                content: content,
                type: 'chat'
            });

        elements.chatInput.value = '';
    } catch (err) {
        console.error('送出訊息失敗:', err);
    }
}

function displayChatMessage(transcript) {
    const div = document.createElement('div');
    div.className = 'chat-message';
    div.innerHTML = `
        <div class="chat-message-sender">${transcript.speaker_name}</div>
        <div class="chat-message-text">${transcript.content}</div>
    `;
    elements.chatMessages.appendChild(div);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// ===================================
// 媒體控制
// ===================================

function toggleMic() {
    if (!MeetingState.localStream) {
        requestMicrophonePermission();
        return;
    }

    MeetingState.isMicOn = !MeetingState.isMicOn;

    MeetingState.localStream.getAudioTracks().forEach(track => {
        track.enabled = MeetingState.isMicOn;
    });

    updateMicButton();
}

function updateMicButton() {
    if (MeetingState.isMicOn) {
        elements.micBtn.classList.add('active');
        elements.micBtn.classList.remove('muted');
    } else {
        elements.micBtn.classList.remove('active');
        elements.micBtn.classList.add('muted');
    }
}

function toggleSpeaker() {
    MeetingState.isSpeakerOn = !MeetingState.isSpeakerOn;

    // 更新所有遠端音訊
    const audios = elements.audioContainer.querySelectorAll('audio');
    audios.forEach(audio => {
        audio.muted = !MeetingState.isSpeakerOn;
    });

    if (MeetingState.isSpeakerOn) {
        elements.speakerBtn.classList.add('active');
    } else {
        elements.speakerBtn.classList.remove('active');
    }
}

// ===================================
// 結束會議
// ===================================

function showEndMeetingModal() {
    elements.endMeetingModal.classList.remove('hidden');
}

function hideEndMeetingModal() {
    elements.endMeetingModal.classList.add('hidden');
}

async function endMeeting(generateSummary = false) {
    try {
        // 更新會議狀態
        await supabase
            .from('meetings')
            .update({
                status: 'ended',
                ended_at: new Date().toISOString()
            })
            .eq('id', MeetingState.meetingId);

        // 廣播會議結束
        if (MeetingState.realtimeChannel) {
            await MeetingState.realtimeChannel.send({
                type: 'broadcast',
                event: 'meeting_ended',
                payload: {}
            });
        }

        // 清理資源
        cleanup();

        // 導向總結頁面
        if (generateSummary) {
            window.location.href = `summary.html?meeting=${MeetingState.meetingId}`;
        } else {
            window.location.href = 'index.html';
        }

    } catch (err) {
        console.error('結束會議失敗:', err);
        alert('結束會議失敗');
    }
}

function cleanup() {
    // 停止本地串流
    if (MeetingState.localStream) {
        MeetingState.localStream.getTracks().forEach(track => track.stop());
    }

    // 關閉 PeerJS
    if (MeetingState.peer) {
        MeetingState.peer.destroy();
    }

    // 取消訂閱
    if (MeetingState.realtimeChannel) {
        supabase.removeChannel(MeetingState.realtimeChannel);
    }
}

// ===================================
// 事件監聽
// ===================================

function setupEventListeners() {
    // 複製房間代碼
    elements.copyRoomCode.addEventListener('click', async () => {
        const success = await Utils.copyToClipboard(MeetingState.roomCode);
        if (success) {
            elements.copyRoomCode.textContent = '✅';
            setTimeout(() => {
                elements.copyRoomCode.textContent = '📋';
            }, 2000);
        }
    });

    // 字體大小調整
    elements.fontSizeSlider.addEventListener('input', (e) => {
        const size = e.target.value;
        elements.fontSizeValue.textContent = `${size}px`;

        // 更新所有字幕的字體大小
        document.querySelectorAll('.subtitle-text').forEach(el => {
            el.style.fontSize = `${size}px`;
        });
    });

    // 送出字幕
    elements.sendSubtitleBtn.addEventListener('click', sendSubtitle);
    elements.subtitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendSubtitle();
        }
    });

    // 設定 Typeless 即時輸入
    setupTypelessInput();

    // 聊天
    elements.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendChatMessage();
    });

    // 媒體控制
    elements.micBtn.addEventListener('click', toggleMic);
    elements.speakerBtn.addEventListener('click', toggleSpeaker);

    // 結束會議
    elements.endMeetingBtn.addEventListener('click', showEndMeetingModal);
    document.getElementById('generateSummaryBtn').addEventListener('click', () => endMeeting(true));
    document.getElementById('endWithoutSummaryBtn').addEventListener('click', () => endMeeting(false));
    document.getElementById('cancelEndBtn').addEventListener('click', hideEndMeetingModal);

    // 頁面關閉前清理
    window.addEventListener('beforeunload', () => {
        cleanup();
    });
}

console.log('✅ Meeting.js loaded');
