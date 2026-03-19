/**
 * 配置常量
 */

// 固定仓库配置
export const GITHUB_OWNER = 'LanRhyme';
export const GITHUB_REPO = 'MicYou';

// KV 存储的 key
export const CHANGELOG_KV_KEY = 'changelog_data';

// 获取完整仓库名
export function getRepoFullName(): string {
  return `${GITHUB_OWNER}/${GITHUB_REPO}`;
}

// 获取仓库 URL
export function getRepoUrl(): string {
  return `https://github.com/${getRepoFullName()}`;
}