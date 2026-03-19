/**
 * Changelog 相关路由处理器
 */

import { Env } from '../types';
import { getRepoFullName } from '../config';
import { getChangelogFromKV, initializeChangelog } from '../changelog/kv';
import { generateChangelogMarkdown } from '../changelog/generator';

/**
 * 处理 /changelog 请求 - 获取 changelog（JSON 格式）
 */
export async function handleChangelogRequest(env: Env): Promise<Response> {
  let data = await getChangelogFromKV(env.CHANGELOG_KV);

  if (!data) {
    data = await initializeChangelog(env);
  }

  return new Response(JSON.stringify({
    success: true,
    repository: getRepoFullName(),
    data
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 处理 /changelog.md 请求 - 获取 CHANGELOG.md 格式
 */
export async function handleChangelogMdRequest(env: Env): Promise<Response> {
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
    },
  });
}

/**
 * 处理 /changelog/refresh 请求 - 强制刷新 changelog
 */
export async function handleChangelogRefresh(env: Env, secret?: string): Promise<Response> {
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