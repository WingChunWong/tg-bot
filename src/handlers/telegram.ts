/**
 * Telegram Webhook 处理器
 */

import { isAdminUser, isChatAdmin, sendTelegramMessage } from '../telegram/api';
import type { Env, TelegramUpdate } from '../types';
import { executeSendAll } from './sendAll';

/**
 * 处理 Telegram Bot 命令
 */
export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  if (!env.TG_WEBHOOK_SECRET) {
    return new Response('Telegram webhook secret not configured', { status: 503 });
  }

  const webhookSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (webhookSecret !== env.TG_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const message = update.message;
  if (!message?.text) {
    return new Response('OK', { status: 200 });
  }

  const chatId = message.chat.id.toString();
  const userId = message.from.id;
  const text = message.text.trim();
  const threadId = message.message_thread_id;

  if (chatId !== env.TG_CHAT_ID) {
    return new Response('OK', { status: 200 });
  }

  // 处理 /sendAll 命令
  if (text === '/sendAll' || text.startsWith('/sendAll@')) {
    const isAdmin =
      (await isChatAdmin(env.TG_BOT_TOKEN, chatId, userId)) ||
      isAdminUser(userId, env.ADMIN_USER_IDS);

    if (!isAdmin) {
      await sendTelegramMessage(
        env.TG_BOT_TOKEN,
        chatId,
        'Permission denied. Admin only. / 权限不足，仅管理员可用。',
        'Markdown',
        threadId,
      );
      return new Response('OK', { status: 200 });
    }

    await sendTelegramMessage(
      env.TG_BOT_TOKEN,
      chatId,
      'Sending all releases, please wait... / 正在发送所有发布，请稍候...',
      'Markdown',
      threadId,
    );

    const result = await executeSendAll(env, threadId);

    await sendTelegramMessage(
      env.TG_BOT_TOKEN,
      chatId,
      `Done! Sent ${result.sentCount}/${result.totalCount} releases. / 完成！已发送 ${result.sentCount}/${result.totalCount} 个发布。`,
      'Markdown',
      threadId,
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
