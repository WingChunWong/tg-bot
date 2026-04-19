/**
 * GitHub API 相关功能
 */

import { GITHUB_OWNER, GITHUB_REPO } from '../config';
import type { GitHubApiRelease } from '../types';

/**
 * 获取 GitHub 仓库的所有 Releases
 */
export async function fetchAllReleases(
  owner: string = GITHUB_OWNER,
  repo: string = GITHUB_REPO,
  token?: string,
): Promise<GitHubApiRelease[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Release-Telegram-Bot',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const releases: GitHubApiRelease[] = [];
  const perPage = 100;

  for (let page = 1; ; page++) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/releases`);
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const pageReleases = (await response.json()) as GitHubApiRelease[];
    releases.push(...pageReleases.filter((release) => !release.draft));

    if (pageReleases.length < perPage) {
      break;
    }
  }

  return releases.sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
  );
}
