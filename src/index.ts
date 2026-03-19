/**
 * GitHub Release Notification Bot for Telegram
 * 部署在 Cloudflare Workers 上
 */

import { Env } from './types';
import {
  handleChangelogRequest,
  handleChangelogMdRequest,
  handleChangelogRefresh,
  handleSendAll,
  handleTelegramWebhook,
  generateAdminHtml,
  handleGitHubWebhook,
} from './handlers';

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

    if (path === '/changelog') {
      return handleChangelogRequest(env);
    }

    if (path === '/changelog.md') {
      return handleChangelogMdRequest(env);
    }

    if (path === '/changelog/refresh') {
      const secret = url.searchParams.get('secret') || undefined;
      return handleChangelogRefresh(env, secret);
    }

    if (path === '/sendAll') {
      return handleSendAll(request, env);
    }

    if (path === '/' || path === '') {
      return new Response(generateAdminHtml(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};