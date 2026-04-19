/**
 * GitHub Release Notification Bot for Telegram
 * 部署在 Cloudflare Workers 上
 */

import { refreshChangelogByApiDiff } from './changelog';
import {
  generateAdminHtml,
  handleChangelogMdRequest,
  handleChangelogOptions,
  handleChangelogRefresh,
  handleChangelogRequest,
  handleGitHubWebhook,
  handleLogin,
  handleSendAll,
  handleSendLatest,
  handleStatusRequest,
  handleTelegramWebhook,
} from './handlers';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 路由分发
    if (path === '/telegram/webhook') {
      return handleTelegramWebhook(request, env);
    }

    if (path === '/github/webhook') {
      return handleGitHubWebhook(request, env);
    }

    if (path === '/api/login') {
      return handleLogin(request, env);
    }

    if (path === '/api/status') {
      return handleStatusRequest(request, env);
    }

    if (path === '/changelog') {
      if (request.method === 'OPTIONS') {
        return handleChangelogOptions();
      }
      return handleChangelogRequest(env);
    }

    if (path === '/changelog.md') {
      if (request.method === 'OPTIONS') {
        return handleChangelogOptions();
      }
      const secret = url.searchParams.get('secret') || undefined;
      return handleChangelogMdRequest(env, secret);
    }

    if (path === '/changelog/refresh') {
      if (request.method === 'OPTIONS') {
        return handleChangelogOptions();
      }
      return handleChangelogRefresh(request, env);
    }

    if (path === '/sendAll') {
      return handleSendAll(request, env);
    }

    if (path === '/sendLatest') {
      return handleSendLatest(request, env);
    }

    if (path === '/' || path === '') {
      return new Response(generateAdminHtml(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const result = await refreshChangelogByApiDiff(env);
          console.log('[changelog-cron] refresh completed', {
            cron: event.cron,
            changed: result.changed,
            reason: result.reason,
            count: result.data.entries.length,
            lastUpdated: result.data.lastUpdated,
          });
        } catch (error) {
          console.error('[changelog-cron] refresh failed', {
            cron: event.cron,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })(),
    );
  },
};
