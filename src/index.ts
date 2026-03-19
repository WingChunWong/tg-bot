/**
 * GitHub Release Notification Bot for Telegram
 * 部署在 Cloudflare Workers 上
 */

// 固定仓库配置
const GITHUB_OWNER = 'LanRhyme';
const GITHUB_REPO = 'MicYou';

// 环境变量类型定义
interface Env {
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  TG_THREAD_ID?: string; // 话题 ID（可选）
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_TOKEN?: string; // GitHub Personal Access Token（可选，用于提高 API 限制）
  ADMIN_USER_IDS?: string; // 管理员用户 ID 列表，逗号分隔
  ENVIRONMENT?: string;
  CHANGELOG_KV: KVNamespace; // KV namespace 用于存储 changelog
}

// Changelog 存储类型定义
interface ChangelogEntry {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string;
  author: {
    login: string;
    html_url: string;
  };
  prerelease: boolean;
}

// KV 存储的数据结构
interface ChangelogData {
  entries: ChangelogEntry[];
  lastUpdated: string;
}

// Telegram Update 类型定义
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    message_thread_id?: number; // 话题 ID
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    text?: string;
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
    }>;
  };
}

// GitHub Release Webhook Payload 类型定义
interface GitHubReleasePayload {
  action: string;
  release: {
    id: number;
    tag_name: string;
    name: string | null;
    body: string | null;
    html_url: string;
    published_at: string;
    author: {
      login: string;
      html_url: string;
    };
    prerelease: boolean;
    draft: boolean;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
    html_url: string;
  };
}

// GitHub API Release 类型定义
interface GitHubApiRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string;
  author: {
    login: string;
    html_url: string;
  };
  prerelease: boolean;
  draft: boolean;
}

/**
 * 验证 GitHub Webhook 签名
 * 使用 HMAC-SHA256 算法验证请求体
 */
async function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // 签名格式: sha256=<hex-digest>
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signature.slice(7);
  
  // 使用 Web Crypto API 进行 HMAC-SHA256 计算
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  // 转换为十六进制字符串
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // 使用时间安全比较
  return timingSafeEqual(computedSignature, expectedSignature);
}

/**
 * 时间安全的字符串比较，防止时序攻击
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * 发送 Telegram 消息
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
  messageThreadId?: number
): Promise<Response> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body: Record<string, string | number | boolean> = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode,
    disable_web_page_preview: false,
  };

  // 如果有话题 ID，添加到请求体
  if (messageThreadId) {
    body.message_thread_id = messageThreadId;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return response;
}

/**
 * 检查用户是否是群组管理员
 */
async function isChatAdmin(
  botToken: string,
  chatId: string,
  userId: number
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/getChatAdministrators?chat_id=${chatId}`;

  try {
    const response = await fetch(url);
    const data = await response.json() as { ok: boolean; result?: Array<{ user: { id: number } }> };

    if (!data.ok || !data.result) {
      return false;
    }

    return data.result.some(admin => admin.user.id === userId);
  } catch {
    return false;
  }
}

/**
 * 检查用户是否在管理员列表中
 */
function isAdminUser(userId: number, adminUserIds?: string): boolean {
  if (!adminUserIds) return false;
  const ids = adminUserIds.split(',').map(id => id.trim());
  return ids.includes(userId.toString());
}

/**
 * 截断文本到指定长度
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * 转义 Markdown 特殊字符（仅转义链接文本中的字符）
 */
function escapeMarkdown(text: string): string {
  if (!text) return '';
  // Telegram Markdown 模式只需转义这些字符：` _ * [ ]
  return text.replace(/([`_*\[\]])/g, '\\$1');
}

/**
 * 转换发布说明中的 Markdown 格式为 Telegram 兼容格式
 */
function convertMarkdownForTelegram(text: string): string {
  if (!text) return '';

  let result = text;

  // 转换标题：# 标题 -> *标题*（加粗）
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // 转换粗体：**文本** 或 __文本__ -> *文本*
  result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');
  result = result.replace(/__(.+?)__/g, '*$1*');

  // 转换斜体：*文本* 或 _文本_ -> _文本_（注意避免与粗体冲突）
  // Telegram 用 _ 表示斜体，但需要转义原有的 _

  // 转换删除线：~~文本~~ -> 不支持，直接移除
  result = result.replace(/~~(.+?)~~/g, '$1');

  // 转换行内代码：`代码` 保持不变
  // 转换代码块：```代码``` 保持不变

  // 转义 Telegram Markdown 特殊字符（但保留已转换的格式）
  // 只转义不在代码块中的字符
  result = result.replace(/([`_*\[\]])/g, '\\$1');

  // 恢复我们添加的格式标记
  result = result.replace(/\\\*/g, '*');  // 恢复 *
  result = result.replace(/\\`/g, '`');   // 恢复 `

  return result;
}

/**
 * 格式化日期
 */
function formatDate(dateString: string): string {
  if (!dateString) return '未知';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 构建 Telegram 通知消息（中英双语）
 */
function buildNotificationMessage(payload: GitHubReleasePayload): string {
  const { release, repository, sender } = payload;

  // 使用仓库名或默认值
  const repoName = repository.full_name || repository.name;
  const releaseName = escapeMarkdown(release.name || release.tag_name);
  const releaseBody = convertMarkdownForTelegram(truncateText(release.body || '无发布说明 / No release notes', 500));
  const tagUrl = `https://github.com/${repository.full_name}/releases/tag/${release.tag_name}`;

  // 构建消息（使用 Markdown 格式，中英双语）
  const message = `*New Release / 新版本发布*

*Repository / 仓库*: [${repoName}](${repository.html_url})
*Version / 版本*: [${release.tag_name}](${tagUrl})
*Title / 标题*: ${releaseName}
*Publisher / 发布者*: [${sender.login}](${sender.html_url})
*Time / 时间*: ${formatDate(release.published_at)}

*Release Notes / 发布说明*:
${releaseBody}

[View Details / 查看详情](${tagUrl})`;

  return message;
}

/**
 * 构建 Telegram 通知消息（从 GitHub API Release）
 */
function buildApiReleaseMessage(release: GitHubApiRelease, repoFullName: string, repoUrl: string): string {
  const releaseName = escapeMarkdown(release.name || release.tag_name);
  const releaseBody = convertMarkdownForTelegram(truncateText(release.body || '无发布说明 / No release notes', 500));
  const tagUrl = `https://github.com/${repoFullName}/releases/tag/${release.tag_name}`;

  const message = `*New Release / 新版本发布*

*Repository / 仓库*: [${repoFullName}](${repoUrl})
*Version / 版本*: [${release.tag_name}](${tagUrl})
*Title / 标题*: ${releaseName}
*Publisher / 发布者*: [${release.author.login}](${release.author.html_url})
*Time / 时间*: ${formatDate(release.published_at)}

*Release Notes / 发布说明*:
${releaseBody}

[View Details / 查看详情](${tagUrl})`;

  return message;
}

/**
 * 获取 GitHub 仓库的所有 Releases
 */
async function fetchAllReleases(owner: string, repo: string, token?: string): Promise<GitHubApiRelease[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Release-Telegram-Bot',
  };

  // 添加 GitHub Token 认证（提高 API 限制到 5000 次/小时）
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const releases: GitHubApiRelease[] = await response.json();
  // 过滤掉草稿，按发布时间升序排列（最早的在前）
  return releases
    .filter(r => !r.draft)
    .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
}

// KV 存储的 key
const CHANGELOG_KV_KEY = 'changelog_data';

/**
 * 从 KV 获取 changelog 数据
 */
async function getChangelogFromKV(kv: KVNamespace): Promise<ChangelogData | null> {
  try {
    const data = await kv.get(CHANGELOG_KV_KEY, 'json');
    return data as ChangelogData | null;
  } catch {
    return null;
  }
}

/**
 * 保存 changelog 数据到 KV
 */
async function saveChangelogToKV(kv: KVNamespace, data: ChangelogData): Promise<void> {
  await kv.put(CHANGELOG_KV_KEY, JSON.stringify(data));
}

/**
 * 初始化 changelog - 从 GitHub 获取所有 releases 并存储到 KV
 */
async function initializeChangelog(env: Env): Promise<ChangelogData> {
  const releases = await fetchAllReleases(GITHUB_OWNER, GITHUB_REPO, env.GITHUB_TOKEN);

  const entries: ChangelogEntry[] = releases.map(release => ({
    id: release.id,
    tag_name: release.tag_name,
    name: release.name,
    body: release.body,
    html_url: release.html_url,
    published_at: release.published_at,
    author: release.author,
    prerelease: release.prerelease,
  }));

  // 按发布时间降序排列（最新的在前）
  entries.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  const data: ChangelogData = {
    entries,
    lastUpdated: new Date().toISOString(),
  };

  await saveChangelogToKV(env.CHANGELOG_KV, data);
  return data;
}

/**
 * 增量添加新 release 到 changelog（添加到最顶部）
 */
async function addReleaseToChangelog(env: Env, release: GitHubApiRelease | GitHubReleasePayload['release']): Promise<ChangelogData> {
  let data = await getChangelogFromKV(env.CHANGELOG_KV);

  if (!data) {
    // 如果 KV 中没有数据，初始化整个 changelog
    return await initializeChangelog(env);
  }

  // 检查是否已存在该 release
  if (data.entries.some(e => e.id === release.id)) {
    return data;
  }

  // 创建新的 entry
  const newEntry: ChangelogEntry = {
    id: release.id,
    tag_name: release.tag_name,
    name: release.name,
    body: release.body,
    html_url: release.html_url,
    published_at: release.published_at,
    author: release.author,
    prerelease: release.prerelease,
  };

  // 添加到最顶部
  data.entries.unshift(newEntry);
  data.lastUpdated = new Date().toISOString();

  await saveChangelogToKV(env.CHANGELOG_KV, data);
  return data;
}

/**
 * 生成 CHANGELOG.md 格式的 Markdown 内容
 */
function generateChangelogMarkdown(data: ChangelogData, repoFullName: string): string {
  const lines: string[] = [
    `# Changelog`,
    ``,
    `---`,
    ``,
  ];

  for (const entry of data.entries) {
    const releaseName = entry.name || entry.tag_name;
    const releaseDate = formatDate(entry.published_at);
    const releaseUrl = entry.html_url;

    lines.push(`## [${entry.tag_name}](${releaseUrl})`);
    lines.push(``);
    lines.push(`**${releaseName}**`);
    if (entry.prerelease) {
      lines.push(` *(Pre-release)*`);
    }
    lines.push(``);
    lines.push(`**Update Date:** ${releaseDate}`);
    lines.push(``);

    if (entry.body) {
      lines.push(entry.body);
    } else {
      lines.push(`*No release notes provided.*`);
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join('\n');
}

/**
 * 处理 /changelog 请求 - 获取 changelog（JSON 格式）
 */
async function handleChangelogRequest(env: Env): Promise<Response> {
  let data = await getChangelogFromKV(env.CHANGELOG_KV);

  if (!data) {
    // 第一次访问，从 GitHub 获取所有 releases
    data = await initializeChangelog(env);
  }

  return new Response(JSON.stringify({
    success: true,
    repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    data
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 处理 /changelog.md 请求 - 获取 CHANGELOG.md 格式
 */
async function handleChangelogMdRequest(env: Env): Promise<Response> {
  let data = await getChangelogFromKV(env.CHANGELOG_KV);

  if (!data) {
    // 第一次访问，从 GitHub 获取所有 releases
    data = await initializeChangelog(env);
  }

  const markdown = generateChangelogMarkdown(data, `${GITHUB_OWNER}/${GITHUB_REPO}`);

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="CHANGELOG.md"',
    },
  });
}

/**
 * 处理 /changelog/refresh 请求 - 强制刷新 changelog
 */
async function handleChangelogRefresh(env: Env, secret?: string): Promise<Response> {
  // 验证密钥
  if (!secret || secret !== env.GITHUB_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Admin secret required. Usage: /changelog/refresh?secret=YOUR_SECRET'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await initializeChangelog(env);
    return new Response(JSON.stringify({
      success: true,
      message: 'Changelog refreshed successfully',
      count: data.entries.length,
      lastUpdated: data.lastUpdated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to refresh changelog',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 处理 /sendAll 命令 - 发送所有历史 Release（需要管理员验证）
 */
async function handleSendAll(request: Request, env: Env): Promise<Response> {
  // 验证请求方法
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 必须验证密钥参数，仅管理员可使用
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (!secret || secret !== env.GITHUB_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ 
      error: 'Unauthorized',
      message: 'Admin secret required. Usage: /sendAll?secret=YOUR_SECRET'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 获取所有 Releases
    const releases = await fetchAllReleases(GITHUB_OWNER, GITHUB_REPO, env.GITHUB_TOKEN);

    if (releases.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No releases found',
        count: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const repoFullName = `${GITHUB_OWNER}/${GITHUB_REPO}`;
    const repoUrl = `https://github.com/${repoFullName}`;
    let sentCount = 0;
    const errors: string[] = [];

    // 逐个发送 Release 通知
    const threadId = env.TG_THREAD_ID ? parseInt(env.TG_THREAD_ID) : undefined;
    for (const release of releases) {
      const message = buildApiReleaseMessage(release, repoFullName, repoUrl);

      const telegramResponse = await sendTelegramMessage(
        env.TG_BOT_TOKEN,
        env.TG_CHAT_ID,
        message,
        'Markdown',
        threadId
      );

      if (telegramResponse.ok) {
        sentCount++;
        // 避免触发 Telegram API 限制，每个消息间隔 1 秒
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        const errorText = await telegramResponse.text();
        errors.push(`Release ${release.tag_name}: ${errorText}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Sent ${sentCount}/${releases.length} releases`,
      repository: repoFullName,
      sentCount,
      totalCount: releases.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in /sendAll:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 执行发送所有 Release 的操作
 */
async function executeSendAll(env: Env, threadId?: number): Promise<{ success: boolean; message: string; sentCount: number; totalCount: number }> {
  try {
    const releases = await fetchAllReleases(GITHUB_OWNER, GITHUB_REPO, env.GITHUB_TOKEN);

    if (releases.length === 0) {
      return { success: true, message: 'No releases found', sentCount: 0, totalCount: 0 };
    }

    const repoFullName = `${GITHUB_OWNER}/${GITHUB_REPO}`;
    const repoUrl = `https://github.com/${repoFullName}`;
    // 优先使用传入的话题 ID，否则使用环境变量中的配置
    const effectiveThreadId = threadId ?? (env.TG_THREAD_ID ? parseInt(env.TG_THREAD_ID) : undefined);
    let sentCount = 0;

    for (const release of releases) {
      const message = buildApiReleaseMessage(release, repoFullName, repoUrl);

      const telegramResponse = await sendTelegramMessage(
        env.TG_BOT_TOKEN,
        env.TG_CHAT_ID,
        message,
        'Markdown',
        effectiveThreadId
      );

      if (telegramResponse.ok) {
        sentCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success: true,
      message: `Sent ${sentCount}/${releases.length} releases`,
      sentCount,
      totalCount: releases.length
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      sentCount: 0,
      totalCount: 0
    };
  }
}

/**
 * 处理 Telegram Bot 命令
 */
async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const message = update.message;
  if (!message || !message.text) {
    return new Response('OK', { status: 200 });
  }

  const chatId = message.chat.id.toString();
  const userId = message.from.id;
  const text = message.text.trim();
  const threadId = message.message_thread_id; // 话题 ID

  // 只处理来自配置群组的消息
  if (chatId !== env.TG_CHAT_ID) {
    return new Response('OK', { status: 200 });
  }

  // 处理 /sendAll 命令
  if (text === '/sendAll' || text.startsWith('/sendAll@')) {
    // 检查是否是管理员（群组管理员或在管理员列表中）
    const isAdmin = await isChatAdmin(env.TG_BOT_TOKEN, chatId, userId) ||
                    isAdminUser(userId, env.ADMIN_USER_IDS);

    if (!isAdmin) {
      await sendTelegramMessage(
        env.TG_BOT_TOKEN,
        chatId,
        'Permission denied. Admin only. / 权限不足，仅管理员可用。',
        'Markdown',
        threadId
      );
      return new Response('OK', { status: 200 });
    }

    // 发送开始提示
    await sendTelegramMessage(
      env.TG_BOT_TOKEN,
      chatId,
      'Sending all releases, please wait... / 正在发送所有发布，请稍候...',
      'Markdown',
      threadId
    );

    // 执行发送（传入当前话题 ID）
    const result = await executeSendAll(env, threadId);

    // 发送结果
    await sendTelegramMessage(
      env.TG_BOT_TOKEN,
      chatId,
      `Done! Sent ${result.sentCount}/${result.totalCount} releases. / 完成！已发送 ${result.sentCount}/${result.totalCount} 个发布。`,
      'Markdown',
      threadId
    );

    return new Response('OK', { status: 200 });
  }

  // 处理 /help 命令
  if (text === '/help' || text.startsWith('/help@')) {
    const helpMessage = `*GitHub Release Bot Commands / 命令列表*

/sendAll - Send all releases / 发送所有发布
/help - Show this help / 显示帮助`;
    await sendTelegramMessage(env.TG_BOT_TOKEN, chatId, helpMessage, 'Markdown', threadId);
    return new Response('OK', { status: 200 });
  }

  return new Response('OK', { status: 200 });
}

/**
 * 生成管理后台 HTML
 */
function generateAdminHtml(): string {
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
        const response = await fetch('/sendAll?secret=' + encodeURIComponent(secret));
        const data = await response.json();

        if (response.ok) {
          showResult('success', 'Success! Sent ' + data.sentCount + '/' + data.totalCount + ' releases / 成功发送 ' + data.sentCount + '/' + data.totalCount + ' 个发布');
        } else {
          showResult('error', data.message || 'Request failed / 请求失败');
        }
      } catch (e) {
        showResult('error', 'Network error / 网络错误');
      }

      btn.disabled = false;
      btn.textContent = 'Send All Releases / 发送所有发布';
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

/**
 * 主请求处理函数
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 根路径返回管理后台
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(generateAdminHtml(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // 处理 Telegram Webhook（Bot 命令）
    if (url.pathname === '/telegram' && request.method === 'POST') {
      return handleTelegramWebhook(request, env);
    }

    // 处理 /sendAll 命令（网页 API）
    if (url.pathname === '/sendAll') {
      return handleSendAll(request, env);
    }

    // 处理 /changelog 请求 - 获取 changelog（JSON 格式）
    if (url.pathname === '/changelog') {
      return handleChangelogRequest(env);
    }

    // 处理 /changelog.md 请求 - 获取 CHANGELOG.md 格式
    if (url.pathname === '/changelog.md') {
      return handleChangelogMdRequest(env);
    }

    // 处理 /changelog/refresh 请求 - 强制刷新 changelog
    if (url.pathname === '/changelog/refresh') {
      const secret = url.searchParams.get('secret') || undefined;
      return handleChangelogRefresh(env, secret);
    }

    // 只接受 POST 请求
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取 GitHub 签名
    const signature = request.headers.get('X-Hub-Signature-256');
    if (!signature) {
      console.error('Missing X-Hub-Signature-256 header');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取请求体
    const payload = await request.text();

    // 验证签名
    const isValid = await verifyGitHubSignature(
      payload,
      signature,
      env.GITHUB_WEBHOOK_SECRET
    );

    if (!isValid) {
      console.error('Invalid signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 解析 JSON
    let data: GitHubReleasePayload;
    try {
      data = JSON.parse(payload);
    } catch (e) {
      console.error('Invalid JSON payload');
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 检查事件类型
    const eventType = request.headers.get('X-GitHub-Event');
    
    // 只处理 release 事件
    if (eventType !== 'release') {
      return new Response(JSON.stringify({ 
        message: 'Event ignored',
        event: eventType 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 只处理 published 动作
    if (data.action !== 'published') {
      return new Response(JSON.stringify({ 
        message: 'Release action ignored',
        action: data.action 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 忽略草稿和预发布版本（可选）
    if (data.release.draft) {
      return new Response(JSON.stringify({ 
        message: 'Draft release ignored' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 构建通知消息
    const message = buildNotificationMessage(data);
    const threadId = env.TG_THREAD_ID ? parseInt(env.TG_THREAD_ID) : undefined;

    // 发送 Telegram 消息
    try {
      const telegramResponse = await sendTelegramMessage(
        env.TG_BOT_TOKEN,
        env.TG_CHAT_ID,
        message,
        'Markdown',
        threadId
      );

      if (!telegramResponse.ok) {
        const errorText = await telegramResponse.text();
        console.error('Telegram API error:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to send Telegram message',
          details: errorText 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await telegramResponse.json();
      console.log('Telegram message sent successfully:', result);

      // 增量更新 changelog
      try {
        await addReleaseToChangelog(env, data.release);
        console.log('Changelog updated successfully');
      } catch (changelogError) {
        console.error('Failed to update changelog:', changelogError);
        // 不影响主流程，继续返回成功
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Notification sent successfully',
        release: data.release.tag_name,
        repository: data.repository.full_name 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error sending Telegram message:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};