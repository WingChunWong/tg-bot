/**
 * 管理后台处理器
 */

import { GITHUB_OWNER, GITHUB_REPO } from '../config';

/**
 * 生成管理后台 HTML
 */
export function generateAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub Release Bot Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      border: 1px solid rgba(255,255,255,0.1);
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .subtitle {
      color: #888;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .info-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .info-row:last-child { border-bottom: none; }
    .label { color: #888; }
    .value { color: #4fc3f7; }
    .value a { color: #4fc3f7; text-decoration: none; }
    .value a:hover { text-decoration: underline; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; color: #888; font-size: 14px; }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
      color: #fff;
      font-size: 14px;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #4fc3f7;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #4fc3f7 0%, #2196f3 100%);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(79, 195, 247, 0.4);
    }
    button:disabled {
      background: #555;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .result {
      margin-top: 20px;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    .result.success { background: rgba(76, 175, 80, 0.2); border: 1px solid #4caf50; }
    .result.error { background: rgba(244, 67, 54, 0.2); border: 1px solid #f44336; }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #555;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>GitHub Release Bot</h1>
    <p class="subtitle">Admin Panel / 管理后台</p>

    <div class="info-card">
      <div class="info-row">
        <span class="label">Repository / 仓库</span>
        <span class="value"><a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" target="_blank">${GITHUB_OWNER}/${GITHUB_REPO}</a></span>
      </div>
      <div class="info-row">
        <span class="label">Status / 状态</span>
        <span class="value" style="color: #4caf50;">Online</span>
      </div>
    </div>

    <div class="form-group">
      <label for="secret">Admin Secret / 管理员密钥</label>
      <input type="password" id="secret" placeholder="Enter your secret...">
    </div>

    <button id="sendAllBtn" onclick="sendAllReleases()">
      Send All Releases / 发送所有发布
    </button>

    <div id="result" class="result"></div>

    <div class="footer">
      Powered by Cloudflare Workers
    </div>
  </div>

  <script>
    async function sendAllReleases() {
      const secret = document.getElementById('secret').value;
      const btn = document.getElementById('sendAllBtn');
      const result = document.getElementById('result');

      if (!secret) {
        showResult('error', 'Please enter admin secret / 请输入管理员密钥');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending... / 发送中...';
      result.style.display = 'none';

      try {
        const response = await fetch('/sendAll?secret=' + encodeURIComponent(secret), {
          method: 'POST'
        });
        const data = await response.json();

        if (response.ok && data.success) {
          showResult('success', 'Success! Sent ' + data.sentCount + '/' + data.totalCount + ' releases. / 成功！已发送 ' + data.sentCount + '/' + data.totalCount + ' 个发布。');
        } else {
          showResult('error', data.message || 'Failed to send releases');
        }
      } catch (err) {
        showResult('error', 'Network error: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send All Releases / 发送所有发布';
      }
    }

    function showResult(type, message) {
      const result = document.getElementById('result');
      result.className = 'result ' + type;
      result.textContent = message;
      result.style.display = 'block';
    }
  </script>
</body>
</html>`;
}