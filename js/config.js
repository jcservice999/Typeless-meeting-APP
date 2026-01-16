// ===================================
// Typeless Meeting App - 設定檔
// ===================================

const CONFIG = {
    // Supabase 設定 - 從 config.local.js 載入
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',

    // OpenRouter 設定 - 從 config.local.js 載入
    OPENROUTER_API_KEY: '',
    OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    // 使用免費模型
    AI_MODEL: 'google/gemma-2-9b-it:free',

    // Notion 設定 - 從 config.local.js 載入
    NOTION_API_KEY: '',
    NOTION_DATABASE_ID: '',

    // 應用設定
    APP_NAME: 'Typeless 會議',
    DEFAULT_FONT_SIZE: 28,
    MIN_FONT_SIZE: 18,
    MAX_FONT_SIZE: 48
};

// 載入本地設定（包含 API Keys）
// 這個檔案不會上傳到 GitHub
if (typeof LOCAL_CONFIG !== 'undefined') {
    Object.assign(CONFIG, LOCAL_CONFIG);
}

// 檢查必要設定
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    console.error('⚠️ 請設定 SUPABASE_URL 和 SUPABASE_ANON_KEY！');
    console.error('請複製 js/config.local.example.js 到 js/config.local.js 並填入你的 API Keys');
}

// 初始化 Supabase 客戶端
let supabase = null;
if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

// 工具函數
const Utils = {
    // 生成 6 位數房間代碼
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    // 格式化時間
    formatTime(date) {
        return new Date(date).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // 格式化日期時間
    formatDateTime(date) {
        return new Date(date).toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // 計算時長
    calculateDuration(startTime, endTime) {
        const diff = new Date(endTime) - new Date(startTime);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours > 0) {
            return `${hours} 小時 ${remainingMinutes} 分鐘`;
        }
        return `${minutes} 分鐘`;
    },

    // 顯示錯誤訊息
    showError(message) {
        alert(`錯誤：${message}`);
    },

    // 顯示成功訊息
    showSuccess(message) {
        alert(message);
    },

    // 複製到剪貼簿
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('複製失敗:', err);
            return false;
        }
    },

    // 從 URL 取得參數
    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },

    // 儲存到 localStorage
    saveToStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    // 從 localStorage 讀取
    getFromStorage(key) {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    },

    // 生成唯一 ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // 取得使用者名稱的首字母（用於頭像）
    getInitials(name) {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    }
};

console.log('✅ Config loaded');
