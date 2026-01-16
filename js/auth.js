// ===================================
// Typeless Meeting App - Google 認證
// ===================================

const Auth = {
    user: null,

    // 初始化認證狀態
    async init() {
        // 監聽認證狀態變化
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            if (session?.user) {
                this.user = session.user;
                this.onLogin(session.user);
            } else {
                this.user = null;
                this.onLogout();
            }
        });

        // 檢查現有 session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            this.user = session.user;
            this.onLogin(session.user);
        }
    },

    // 使用 Google 登入
    async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });

        if (error) {
            console.error('Google 登入失敗:', error);
            alert('登入失敗：' + error.message);
        }
    },

    // 登出
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('登出失敗:', error);
        }
    },

    // 登入成功後的處理
    onLogin(user) {
        console.log('✅ 已登入:', user.email);

        // 更新 UI
        const loginSection = document.getElementById('loginSection');
        const mainContent = document.getElementById('mainContent');
        const userInfo = document.getElementById('userInfo');
        const featuresSection = document.getElementById('featuresSection');

        if (loginSection) loginSection.style.display = 'none';
        if (mainContent) mainContent.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'flex';
        if (featuresSection) featuresSection.style.display = 'grid';

        // 顯示使用者資訊
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');

        if (userAvatar && user.user_metadata?.avatar_url) {
            userAvatar.src = user.user_metadata.avatar_url;
        }
        if (userName) {
            userName.textContent = user.user_metadata?.full_name || user.email;
        }

        // 儲存使用者資訊
        Utils.saveToStorage('user', {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            avatar: user.user_metadata?.avatar_url
        });

        // 載入會議室列表
        if (typeof loadMeetingsList === 'function') {
            loadMeetingsList();
        }
    },

    // 登出後的處理
    onLogout() {
        console.log('👋 已登出');

        // 更新 UI
        const loginSection = document.getElementById('loginSection');
        const mainContent = document.getElementById('mainContent');
        const userInfo = document.getElementById('userInfo');
        const featuresSection = document.getElementById('featuresSection');

        if (loginSection) loginSection.style.display = 'flex';
        if (mainContent) mainContent.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
        if (featuresSection) featuresSection.style.display = 'none';

        // 清除儲存的使用者資訊
        localStorage.removeItem('user');
    },

    // 取得當前使用者
    getUser() {
        return this.user;
    },

    // 取得當前使用者 email
    getUserEmail() {
        return this.user?.email || null;
    },

    // 檢查是否已登入
    isLoggedIn() {
        return this.user !== null;
    }
};

console.log('✅ Auth module loaded');
