/**
 * GitHub Webhook 处理器
 */

import { refreshChangelogByApiDiff } from '../changelog/kv';
import { verifyGitHubSignature } from '../github';
import { sendTelegramMessage } from '../telegram/api';
import { buildNotificationMessage } from '../telegram/messages';
import type { Env, GitHubReleasePayload } from '../types';

const SUPPORTED_RELEASE_ACTIONS = new Set(['published', 'released', 'prereleased']);

function logWebhookInfo(message: string, details: Record<string, unknown>): void {
  console.log(`[github-webhook] ${message}`, details);
}

function logWebhookError(message: string, details: Record<string, unknown>): void {
  console.error(`[github-webhook] ${message}`, details);
}

/**
 * 处理 GitHub Webhook 请求
 */
export async function handleGitHubWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  const signature = request.headers.get('X-Hub-Signature-256') || '';
  const eventType = request.headers.get('X-GitHub-Event') || '';

  const payload = await request.text();

  // 验证签名
  const isValid = await verifyGitHubSignature(payload, signature, env.GITHUB_WEBHOOK_SECRET);
  if (!isValid) {
    logWebhookError('signature validation failed', {
      eventType,
      hasSignatureHeader: Boolean(signature),
      signaturePrefix: signature.slice(0, 7),
    });
    return new Response('Invalid signature', { status: 401 });
  }

  // 只处理 release 事件
  if (eventType !== 'release') {
    logWebhookInfo('event ignored', { eventType });
    return new Response('Event ignored', { status: 202 });
  }

  let data: GitHubReleasePayload;
  try {
    data = JSON.parse(payload);
  } catch {
    logWebhookError('invalid json payload', { eventType });
    return new Response('Invalid JSON', { status: 400 });
  }

  const releaseId = data.release?.id;
  const tagName = data.release?.tag_name;

  // 处理指定 release action
  if (!SUPPORTED_RELEASE_ACTIONS.has(data.action)) {
    logWebhookInfo('action ignored', {
      eventType,
      action: data.action,
      releaseId,
      tagName,
    });
    return new Response('Action ignored', { status: 202 });
  }

  // 忽略草稿
  if (data.release.draft) {
    logWebhookInfo('draft release ignored', {
      eventType,
      action: data.action,
      releaseId,
      tagName,
    });
    return new Response('Draft ignored', { status: 202 });
  }

  // 构建并发送通知
  const message = buildNotificationMessage(data);
  const threadId = env.TG_THREAD_ID ? parseInt(env.TG_THREAD_ID, 10) : undefined;

  const telegramResponse = await sendTelegramMessage(
    env.TG_BOT_TOKEN,
    env.TG_CHAT_ID,
    message,
    'Markdown',
    threadId,
  );

  // 与定时任务保持一致：通过 API 扫描并对比后刷新 changelog
  const refreshResult = await refreshChangelogByApiDiff(env);

  if (!telegramResponse.ok) {
    const errorText = await telegramResponse.text();
    logWebhookError('failed to send telegram message', {
      eventType,
      action: data.action,
      releaseId,
      tagName,
      telegramStatus: telegramResponse.status,
      telegramBody: errorText,
      changelogChanged: refreshResult.changed,
      changelogReason: refreshResult.reason,
    });
    return new Response('Failed to send notification', { status: 500 });
  }

  logWebhookInfo('release processed', {
    eventType,
    action: data.action,
    releaseId,
    tagName,
    changelogChanged: refreshResult.changed,
    changelogReason: refreshResult.reason,
  });

  return new Response('OK', { status: 200 });
}
