/**
 * SendAll 路由处理器
 */

import { Env } from '../types';
import { GITHUB_OWNER, GITHUB_REPO, getRepoFullName, getRepoUrl } from '../config';
import { fetchAllReleases } from '../github';
import { sendTelegramMessage } from '../telegram/api';
import { buildApiReleaseMessage } from '../telegram/messages';

/**
 * 执行发送所有 Release 的操作
 */
export async function executeSendAll(
  env: Env,
  threadId?: number
): Promise<{ success: boolean; message: string; sentCount: number; totalCount: number }> {
  try {
    const releases = await fetchAllReleases(GITHUB_OWNER, GITHUB_REPO, env.GITHUB_TOKEN);

    if (releases.length === 0) {
      return { success: true, message: 'No releases found', sentCount: 0, totalCount: 0 };
    }

    const repoFullName = getRepoFullName();
    const repoUrl = getRepoUrl();
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
 * 处理 /sendAll 命令 - 发送所有历史 Release（需要管理员验证）
 */
export async function handleSendAll(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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

    const repoFullName = getRepoFullName();
    const repoUrl = getRepoUrl();
    let sentCount = 0;
    const errors: string[] = [];

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