/**
 * 管理后台处理器
 */

import { Env } from '../types';
import { GITHUB_OWNER, GITHUB_REPO } from '../config';
import { getChangelogFromKV } from '../changelog/kv';

/**
 * 验证登录密码
 */
function verifyPassword(password: string, env: Env): boolean {
  return env.ADMIN_PASSWORD ? password === env.ADMIN_PASSWORD : false;
}

/**
 * 生成管理后台 HTML
 */
export function generateAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MicYou Backend - Admin</title>
  <style>
    :root {
      --bg-primary: #f5f5f5;
      --bg-secondary: #fff;
      --bg-tertiary: #fafafa;
      --text-primary: #333;
      --text-secondary: #888;
      --border-color: #e8e8e8;
      --border-light: #f0f0f0;
      --shadow: rgba(0,0,0,0.1);
      --success-bg: #f6ffed;
      --success-border: #b7eb8f;
      --error-bg: #fff2f0;
      --error-border: #ffccc7;
    }
    
    [data-theme="dark"] {
      --bg-primary: #141414;
      --bg-secondary: #1f1f1f;
      --bg-tertiary: #2a2a2a;
      --text-primary: #e8e8e8;
      --text-secondary: #888;
      --border-color: #333;
      --border-light: #2a2a2a;
      --shadow: rgba(0,0,0,0.3);
      --success-bg: #162312;
      --success-border: #274916;
      --error-bg: #2a1215;
      --error-border: #5c2a2e;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      color: var(--text-primary);
      transition: background 0.3s, color 0.3s;
    }
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-box {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 32px;
      width: 360px;
      box-shadow: 0 2px 8px var(--shadow);
    }
    .login-box h1 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 24px;
      text-align: center;
    }
    .login-box input[type="password"] {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 16px;
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    .login-box input[type="password"]:focus {
      outline: none;
      border-color: #1890ff;
    }
    .login-box button {
      width: 100%;
      padding: 12px;
      background: #1890ff;
      border: none;
      border-radius: 4px;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
    }
    .login-box button:hover {
      background: #40a9ff;
    }
    .login-error {
      color: #f5222d;
      font-size: 12px;
      margin-bottom: 12px;
      display: none;
    }
    
    /* Theme Toggle */
    .theme-toggle {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      z-index: 100;
      transition: all 0.3s;
    }
    .theme-toggle:hover {
      border-color: #1890ff;
    }
    
    /* Dashboard */
    .dashboard { display: none; }
    .header {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .repo-link {
      color: #1890ff;
      text-decoration: none;
      font-size: 14px;
    }
    .logout-btn {
      padding: 6px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      color: var(--text-primary);
    }
    .logout-btn:hover {
      border-color: #1890ff;
      color: #1890ff;
    }

    .content {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .card {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px var(--shadow);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 600;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    @media (max-width: 600px) {
      .status-grid { grid-template-columns: 1fr; }
    }

    .status-item {
      padding: 16px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      border-left: 3px solid #ddd;
    }
    .status-item.online { border-left-color: #52c41a; }
    .status-item.offline { border-left-color: #f5222d; }
    .status-item.pending { border-left-color: #faad14; }

    .status-label {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    .status-value {
      font-size: 14px;
      font-weight: 500;
    }
    .status-value.success { color: #52c41a; }
    .status-value.error { color: #f5222d; }
    .status-value.warning { color: #faad14; }

    .action-btn {
      padding: 10px 20px;
      background: #1890ff;
      border: none;
      border-radius: 4px;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
    }
    .action-btn:hover { background: #40a9ff; }
    .action-btn:disabled {
      background: #d9d9d9;
      cursor: not-allowed;
    }
    .action-btn.danger {
      background: #f5222d;
    }
    .action-btn.danger:hover {
      background: #ff4d4f;
    }

    .result-msg {
      margin-top: 12px;
      padding: 10px;
      border-radius: 4px;
      font-size: 13px;
      display: none;
    }
    .result-msg.success {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: #52c41a;
    }
    .result-msg.error {
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      color: #f5222d;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-light);
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: var(--text-secondary); font-size: 13px; }
    .info-value { font-size: 13px; }
  </style>
</head>
<body>
  <button class="theme-toggle" onclick="toggleTheme()" title="切换主题">🌙</button>
  
  <!-- Login -->
  <div class="login-container" id="loginPage">
    <div class="login-box">
      <h1>MicYou Backend</h1>
      <div class="login-error" id="loginError">密码错误</div>
      <input type="password" id="password" placeholder="请输入管理密码" onkeypress="if(event.key==='Enter')login()">
      <button onclick="login()">登录</button>
    </div>
  </div>

  <!-- Dashboard -->
  <div class="dashboard" id="dashboard">
    <div class="header">
      <h1>MicYou Backend</h1>
      <div class="header-right">
        <a class="repo-link" href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" target="_blank">${GITHUB_OWNER}/${GITHUB_REPO}</a>
        <button class="logout-btn" onclick="logout()">退出</button>
      </div>
    </div>

    <div class="content">
      <!-- Status Cards -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">服务状态</span>
          <button class="action-btn" onclick="refreshStatus()">刷新</button>
        </div>
        <div class="status-grid">
          <div class="status-item online" id="webhookStatus">
            <div class="status-label">GitHub Webhook</div>
            <div class="status-value success" id="webhookValue">正常</div>
          </div>
          <div class="status-item" id="changelogStatus">
            <div class="status-label">Changelog</div>
            <div class="status-value" id="changelogValue">加载中...</div>
          </div>
          <div class="status-item online">
            <div class="status-label">Bot 状态</div>
            <div class="status-value success">在线</div>
          </div>
          <div class="status-item">
            <div class="status-label">最后更新</div>
            <div class="status-value" id="lastUpdate">-</div>
          </div>
        </div>
      </div>

      <!-- Changelog Info -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Changelog 详情</span>
        </div>
        <div class="info-row">
          <span class="info-label">Release 数量</span>
          <span class="info-value" id="releaseCount">-</span>
        </div>
        <div class="info-row">
          <span class="info-label">最新版本</span>
          <span class="info-value" id="latestVersion">-</span>
        </div>
        <div class="info-row">
          <span class="info-label">数据更新时间</span>
          <span class="info-value" id="dataUpdateTime">-</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">操作</span>
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button class="action-btn" id="sendAllBtn" onclick="sendAllReleases()">发送所有 Release</button>
          <button class="action-btn" onclick="refreshChangelog()">刷新 Changelog</button>
        </div>
        <div class="result-msg" id="actionResult"></div>
      </div>
    </div>
  </div>

  <script>
    const tokenKey = 'admin_token';
    const themeKey = 'admin_theme';
    
    // Theme management
    function getTheme() {
      const saved = localStorage.getItem(themeKey);
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(themeKey, theme);
      updateThemeIcon(theme);
    }
    
    function updateThemeIcon(theme) {
      const btn = document.querySelector('.theme-toggle');
      if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    
    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
    }
    
    // Initialize theme
    setTheme(getTheme());

    function getToken() {
      return sessionStorage.getItem(tokenKey);
    }

    function setToken(token) {
      sessionStorage.setItem(tokenKey, token);
    }

    function clearToken() {
      sessionStorage.removeItem(tokenKey);
    }

    async function login() {
      const pwd = document.getElementById('password').value;
      if (!pwd) return;

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setToken(pwd);
          showDashboard();
        } else {
          document.getElementById('loginError').style.display = 'block';
        }
      } catch (e) {
        document.getElementById('loginError').textContent = '网络错误';
        document.getElementById('loginError').style.display = 'block';
      }
    }

    function logout() {
      clearToken();
      document.getElementById('loginPage').style.display = 'flex';
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('password').value = '';
    }

    function showDashboard() {
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      document.getElementById('loginError').style.display = 'none';
      refreshStatus();
    }

    async function refreshStatus() {
      const token = getToken();

      try {
        const res = await fetch('/api/status', {
          headers: { 'X-Admin-Token': token }
        });
        const data = await res.json();

        if (data.changelog) {
          const el = document.getElementById('changelogStatus');
          const val = document.getElementById('changelogValue');
          if (data.changelog.count > 0) {
            el.className = 'status-item online';
            val.className = 'status-value success';
            val.textContent = data.changelog.count + ' 条记录';
          } else {
            el.className = 'status-item pending';
            val.className = 'status-value warning';
            val.textContent = '暂无数据';
          }

          document.getElementById('releaseCount').textContent = data.changelog.count || 0;
          document.getElementById('latestVersion').textContent = data.changelog.latestVersion || '-';
          document.getElementById('dataUpdateTime').textContent = formatTime(data.changelog.lastUpdated);
          document.getElementById('lastUpdate').textContent = formatTime(data.changelog.lastUpdated);
        }
      } catch (e) {
        console.error('Failed to fetch status:', e);
      }
    }

    async function sendAllReleases() {
      const token = getToken();
      const btn = document.getElementById('sendAllBtn');
      const result = document.getElementById('actionResult');

      btn.disabled = true;
      btn.textContent = '发送中...';

      try {
        const res = await fetch('/sendAll?secret=' + encodeURIComponent(token), { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.success) {
          showResult('success', '成功发送 ' + data.sentCount + '/' + data.totalCount + ' 个 Release');
        } else {
          showResult('error', data.message || '发送失败');
        }
      } catch (e) {
        showResult('error', '网络错误: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '发送所有 Release';
      }
    }

    async function refreshChangelog() {
      const token = getToken();

      try {
        const res = await fetch('/changelog/refresh?secret=' + encodeURIComponent(token));
        const data = await res.json();

        if (res.ok && data.success) {
          showResult('success', 'Changelog 已刷新，共 ' + data.count + ' 条记录');
          refreshStatus();
        } else {
          showResult('error', data.message || '刷新失败');
        }
      } catch (e) {
        showResult('error', '网络错误');
      }
    }

    function showResult(type, msg) {
      const el = document.getElementById('actionResult');
      el.className = 'result-msg ' + type;
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }

    function formatTime(iso) {
      if (!iso) return '-';
      const d = new Date(iso);
      return d.toLocaleString('zh-CN');
    }

    // Check if already logged in
    if (getToken()) {
      showDashboard();
    }
  </script>
</body>
</html>`;
}

/**
 * 处理登录请求
 */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const { password } = body as { password: string };

    if (verifyPassword(password, env)) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, message: '密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false, message: '请求格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 处理状态查询请求
 */
export async function handleStatusRequest(request: Request, env: Env): Promise<Response> {
  const token = request.headers.get('X-Admin-Token');

  if (!token || !verifyPassword(token, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let changelogData = await getChangelogFromKV(env.CHANGELOG_KV);

  const status = {
    webhook: {
      status: 'online',
      message: 'Webhook 端点正常',
    },
    changelog: {
      count: changelogData?.entries?.length || 0,
      latestVersion: changelogData?.entries?.[0]?.tag_name || null,
      lastUpdated: changelogData?.lastUpdated || null,
    },
    bot: {
      status: 'online',
    },
  };

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}