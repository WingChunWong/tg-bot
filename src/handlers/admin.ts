/**
 * 管理后台处理器
 */

import { getChangelogFromKV } from '../changelog/kv';
import { GITHUB_OWNER, GITHUB_REPO } from '../config';
import type { Env } from '../types';

const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index++) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function decodeBase64Url(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

async function issueAdminSessionToken(env: Env): Promise<string> {
  if (!env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is not configured');
  }

  const now = Date.now();
  const payload = {
    exp: now + ADMIN_SESSION_TTL_MS,
    iat: now,
    nonce: randomNonce(),
  };
  const payloadPart = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(payloadPart, env.ADMIN_PASSWORD);

  return `${payloadPart}.${signature}`;
}

async function verifyAdminSessionToken(token: string | null, env: Env): Promise<boolean> {
  if (!token || !env.ADMIN_PASSWORD) {
    return false;
  }

  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex >= token.length - 1) {
    return false;
  }

  const payloadPart = token.slice(0, separatorIndex);
  const signaturePart = token.slice(separatorIndex + 1);
  const expectedSignature = await signValue(payloadPart, env.ADMIN_PASSWORD);

  if (!timingSafeEqual(expectedSignature, signaturePart)) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart)) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function authorizeAdminRequest(request: Request, env: Env): Promise<boolean> {
  return verifyAdminSessionToken(request.headers.get('X-Admin-Token'), env);
}

/**
 * 验证登录密码
 */
function verifyPassword(password: string, env: Env): boolean {
  return env.ADMIN_PASSWORD ? timingSafeEqual(password, env.ADMIN_PASSWORD) : false;
}

/**
 * 生成管理后台 HTML
 */
export function generateAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
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
          <div class="status-item pending" id="webhookStatus">
            <div class="status-label">GitHub Webhook</div>
            <div class="status-value warning" id="webhookValue">检查中...</div>
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
          <button class="action-btn" id="sendLatestBtn" onclick="sendLatestRelease()">发送最新 Release</button>
          <button class="action-btn" id="sendAllBtn" onclick="sendAllReleases()">发送所有 Release</button>
          <button class="action-btn" onclick="refreshChangelog()">刷新 Changelog</button>
        </div>
        <div class="result-msg" id="actionResult"></div>
      </div>
    </div>
  </div>

  <script>
    const tokenKey = 'admin_token';

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
        if (res.ok && data.success && data.token) {
          setToken(data.token);
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
        if (res.status === 401) {
          logout();
          return;
        }
        const data = await res.json();

        if (data.webhook) {
          const webhookEl = document.getElementById('webhookStatus');
          const webhookValue = document.getElementById('webhookValue');
          const hasMissingConfig = Array.isArray(data.webhook.missingConfig) && data.webhook.missingConfig.length > 0;

          if (data.webhook.status === 'online' && !hasMissingConfig) {
            webhookEl.className = 'status-item online';
            webhookValue.className = 'status-value success';
            webhookValue.textContent = '配置完整';
          } else {
            webhookEl.className = 'status-item offline';
            webhookValue.className = 'status-value error';
            webhookValue.textContent = hasMissingConfig
              ? '缺失: ' + data.webhook.missingConfig.join(', ')
              : (data.webhook.message || '配置异常');
          }
        }

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

      btn.disabled = true;
      btn.textContent = '发送中...';

      try {
        const res = await fetch('/sendAll', {
          method: 'POST',
          headers: { 'X-Admin-Token': token }
        });
        if (res.status === 401) {
          logout();
          return;
        }
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

    async function sendLatestRelease() {
      const token = getToken();
      const btn = document.getElementById('sendLatestBtn');

      btn.disabled = true;
      btn.textContent = '发送中...';

      try {
        const res = await fetch('/sendLatest', {
          method: 'POST',
          headers: { 'X-Admin-Token': token }
        });
        if (res.status === 401) {
          logout();
          return;
        }
        const data = await res.json();

        if (res.ok && data.success) {
          const suffix = data.tagName ? (' (' + data.tagName + ')') : '';
          showResult('success', '已发送最新 Release' + suffix);
        } else {
          showResult('error', data.message || '发送失败');
        }
      } catch (e) {
        showResult('error', '网络错误: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '发送最新 Release';
      }
    }

    async function refreshChangelog() {
      const token = getToken();

      try {
        const res = await fetch('/changelog/refresh', {
          headers: { 'X-Admin-Token': token }
        });
        if (res.status === 401) {
          logout();
          return;
        }
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
      const token = await issueAdminSessionToken(env);
      return new Response(JSON.stringify({ success: true, token }), {
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
  if (!(await authorizeAdminRequest(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const changelogData = await getChangelogFromKV(env.CHANGELOG_KV);

  const missingConfig: string[] = [];
  if (!env.TG_BOT_TOKEN) missingConfig.push('TG_BOT_TOKEN');
  if (!env.TG_CHAT_ID) missingConfig.push('TG_CHAT_ID');
  if (!env.GITHUB_WEBHOOK_SECRET) missingConfig.push('GITHUB_WEBHOOK_SECRET');
  if (!env.TG_WEBHOOK_SECRET) missingConfig.push('TG_WEBHOOK_SECRET');
  if (!env.CHANGELOG_KV) missingConfig.push('CHANGELOG_KV');

  const webhookHealthy = missingConfig.length === 0;

  const status = {
    webhook: {
      status: webhookHealthy ? 'online' : 'offline',
      message: webhookHealthy ? 'Webhook 配置完整' : `缺少配置: ${missingConfig.join(', ')}`,
      missingConfig,
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
