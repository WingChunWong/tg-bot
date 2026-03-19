/**
 * GitHub Webhook 处理器
 */

import { Env, GitHubReleasePayload } from '../types';
import { verifyGitHubSignature } from '../github';
import { sendTelegramMessage } from '../telegram/api';
import { buildNotificationMessage } from '../telegram/messages';
import { addReleaseToChangelog } from '../changelog/kv';

/**
 * 处理 GitHub Webhook 请求
 */
export async function handleGitHubWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const signature = request.headers.get('X-Hub-Signature-256') || '';
  const eventType = request.headers.get('X-GitHub-Event') || '';

  const payload = await request.text();

  // 验证签名
  const isValid = await verifyGitHubSignature(payload, signature, env.GITHUB_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 只处理 release 事件
  if (eventType !== 'release') {
    return new Response('Event ignored', { status: 200 });
  }

  let data: GitHubReleasePayload;
  try {
    data = JSON.parse(payload);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // 只处理 published 事件
  if (data.action !== 'published') {
    return new Response('Action ignored', { status: 200 });
  }

  // 忽略草稿
  if (data.release.draft) {
    return new Response('Draft ignored', { status: 200 });
  }

  // 构建并发送通知
  const message = buildNotificationMessage(data);
  const threadId = env.TG_THREAD_ID ? parseInt(env.TG_THREAD_ID) : undefined;

  const telegramResponse = await sendTelegramMessage(
    env.TG_BOT_TOKEN,
    env.TG_CHAT_ID,
    message,
    'Markdown',
    threadId
  );

  // 添加到 changelog
  await addReleaseToChangelog(env, data.release);

  if (!telegramResponse.ok) {
    const errorText = await telegramResponse.text();
    console.error('Failed to send Telegram message:', errorText);
    return new Response('Failed to send notification', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}