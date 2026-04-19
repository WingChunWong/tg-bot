/**
 * Telegram API 相关功能
 */

/**
 * 发送 Telegram 消息
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
  messageThreadId?: number,
): Promise<Response> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body: Record<string, string | number | boolean> = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode,
    disable_web_page_preview: false,
  };

  if (messageThreadId) {
    body.message_thread_id = messageThreadId;
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * 检查用户是否是群组管理员
 */
export async function isChatAdmin(
  botToken: string,
  chatId: string,
  userId: number,
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/getChatAdministrators?chat_id=${chatId}`;

  try {
    const response = await fetch(url);
    const data = (await response.json()) as {
      ok: boolean;
      result?: Array<{ user: { id: number } }>;
    };

    if (!data.ok || !data.result) {
      return false;
    }

    return data.result.some((admin) => admin.user.id === userId);
  } catch {
    return false;
  }
}

/**
 * 检查用户是否在管理员列表中
 */
export function isAdminUser(userId: number, adminUserIds?: string): boolean {
  if (!adminUserIds) return false;
  const ids = adminUserIds.split(',').map((id) => id.trim());
  return ids.includes(userId.toString());
}
