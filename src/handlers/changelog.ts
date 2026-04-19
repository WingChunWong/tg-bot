/**
 * Changelog 相关路由处理器
 */

import { generateChangelogMarkdown } from '../changelog/generator';
import {
  getChangelogFromKV,
  initializeChangelog,
  refreshChangelogByApiDiff,
} from '../changelog/kv';
import { getRepoFullName } from '../config';
import type { Env } from '../types';
import { authorizeAdminRequest } from './admin';

/** CORS 响应头 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * 处理 /changelog 请求 - 获取 changelog（JSON 格式）
 */
export async function handleChangelogRequest(env: Env): Promise<Response> {
  let data = await getChangelogFromKV(env.CHANGELOG_KV);

  if (!data) {
    data = await initializeChangelog(env);
  }

  return new Response(
    JSON.stringify({
      success: true,
      repository: getRepoFullName(),
      data,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    },
  );
}

/**
 * 处理 OPTIONS 预检请求
 */
export function handleChangelogOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * 处理 /changelog.md 请求 - 获取 CHANGELOG.md 格式
 * 支持通过 secret 参数访问（用于 GitHub Actions 等自动化场景）
 */
export async function handleChangelogMdRequest(env: Env, secret?: string): Promise<Response> {
  // 如果提供了 secret，验证是否正确
  if (secret && secret !== env.CHANGELOG_SECRET) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid secret',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  }

  let data = await getChangelogFromKV(env.CHANGELOG_KV);

  if (!data) {
    data = await initializeChangelog(env);
  }

  const markdown = generateChangelogMarkdown(data, getRepoFullName());

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="CHANGELOG.md"',
      ...CORS_HEADERS,
    },
  });
}

/**
 * 处理 /changelog/refresh 请求 - 强制刷新 changelog
 */
export async function handleChangelogRefresh(request: Request, env: Env): Promise<Response> {
  if (!(await authorizeAdminRequest(request, env))) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Admin token required. Use X-Admin-Token header or legacy ?secret=YOUR_SECRET',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  }

  try {
    const result = await refreshChangelogByApiDiff(env);
    return new Response(
      JSON.stringify({
        success: true,
        message: result.changed ? 'Changelog refreshed successfully' : 'No changes detected',
        changed: result.changed,
        reason: result.reason,
        count: result.data.entries.length,
        lastUpdated: result.data.lastUpdated,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to refresh changelog',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  }
}
