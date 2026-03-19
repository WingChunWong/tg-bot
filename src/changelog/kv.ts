/**
 * Changelog KV 存储操作
 */

import { Env, ChangelogData, ChangelogEntry, GitHubRelease } from '../types';
import { CHANGELOG_KV_KEY, GITHUB_OWNER, GITHUB_REPO } from '../config';
import { fetchAllReleases } from '../github';

/**
 * 从 KV 获取 changelog 数据
 */
export async function getChangelogFromKV(kv: KVNamespace): Promise<ChangelogData | null> {
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
export async function saveChangelogToKV(kv: KVNamespace, data: ChangelogData): Promise<void> {
  await kv.put(CHANGELOG_KV_KEY, JSON.stringify(data));
}

/**
 * 初始化 changelog - 从 GitHub 获取所有 releases 并存储到 KV
 */
export async function initializeChangelog(env: Env): Promise<ChangelogData> {
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

  entries.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  const data: ChangelogData = {
    entries,
    lastUpdated: new Date().toISOString(),
  };

  await saveChangelogToKV(env.CHANGELOG_KV, data);
  return data;
}

/**
 * 增量添加新 release 到 changelog
 */
export async function addReleaseToChangelog(
  env: Env,
  release: GitHubRelease
): Promise<ChangelogData> {
  let data = await getChangelogFromKV(env.CHANGELOG_KV);

  if (!data) {
    return await initializeChangelog(env);
  }

  if (data.entries.some(e => e.id === release.id)) {
    return data;
  }

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

  data.entries.unshift(newEntry);
  data.lastUpdated = new Date().toISOString();

  await saveChangelogToKV(env.CHANGELOG_KV, data);
  return data;
}