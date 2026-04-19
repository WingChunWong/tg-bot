/**
 * Changelog KV 存储操作
 */

import { CHANGELOG_KV_KEY, GITHUB_OWNER, GITHUB_REPO } from '../config';
import { fetchAllReleases } from '../github';
import type { ChangelogData, ChangelogEntry, Env, GitHubRelease } from '../types';

export interface ChangelogRefreshResult {
  changed: boolean;
  data: ChangelogData;
  reason: 'initialized' | 'updated' | 'no_changes';
}

function mapReleaseToEntry(release: GitHubRelease): ChangelogEntry {
  return {
    id: release.id,
    tag_name: release.tag_name,
    name: release.name,
    body: release.body,
    html_url: release.html_url,
    published_at: release.published_at,
    author: release.author,
    prerelease: release.prerelease,
  };
}

function toEntriesSnapshot(entries: ChangelogEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => ({
      id: entry.id,
      tag_name: entry.tag_name,
      name: entry.name,
      body: entry.body,
      html_url: entry.html_url,
      published_at: entry.published_at,
      author_login: entry.author.login,
      author_url: entry.author.html_url,
      prerelease: entry.prerelease,
    })),
  );
}

function hasChangelogChanged(current: ChangelogEntry[], incoming: ChangelogEntry[]): boolean {
  if (current.length !== incoming.length) {
    return true;
  }

  return toEntriesSnapshot(current) !== toEntriesSnapshot(incoming);
}

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

  const entries: ChangelogEntry[] = releases.map(mapReleaseToEntry);

  entries.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  const data: ChangelogData = {
    entries,
    lastUpdated: new Date().toISOString(),
  };

  await saveChangelogToKV(env.CHANGELOG_KV, data);
  return data;
}

/**
 * 从 GitHub API 刷新 changelog，仅在内容有变化时写入 KV
 */
export async function refreshChangelogByApiDiff(env: Env): Promise<ChangelogRefreshResult> {
  const releases = await fetchAllReleases(GITHUB_OWNER, GITHUB_REPO, env.GITHUB_TOKEN);
  const incomingEntries = releases.map(mapReleaseToEntry);

  incomingEntries.sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );

  const currentData = await getChangelogFromKV(env.CHANGELOG_KV);
  if (!currentData) {
    const initialized: ChangelogData = {
      entries: incomingEntries,
      lastUpdated: new Date().toISOString(),
    };
    await saveChangelogToKV(env.CHANGELOG_KV, initialized);
    return {
      changed: true,
      data: initialized,
      reason: 'initialized',
    };
  }

  if (!hasChangelogChanged(currentData.entries, incomingEntries)) {
    return {
      changed: false,
      data: currentData,
      reason: 'no_changes',
    };
  }

  const updatedData: ChangelogData = {
    entries: incomingEntries,
    lastUpdated: new Date().toISOString(),
  };
  await saveChangelogToKV(env.CHANGELOG_KV, updatedData);

  return {
    changed: true,
    data: updatedData,
    reason: 'updated',
  };
}

/**
 * 增量添加新 release 到 changelog
 */
export async function addReleaseToChangelog(
  env: Env,
  release: GitHubRelease,
): Promise<ChangelogData> {
  const data = await getChangelogFromKV(env.CHANGELOG_KV);

  if (!data) {
    return await initializeChangelog(env);
  }

  if (data.entries.some((e) => e.id === release.id)) {
    return data;
  }

  const newEntry: ChangelogEntry = {
    ...mapReleaseToEntry(release),
  };

  data.entries.unshift(newEntry);
  data.lastUpdated = new Date().toISOString();

  await saveChangelogToKV(env.CHANGELOG_KV, data);
  return data;
}
