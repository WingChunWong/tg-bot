/**
 * Telegram 消息格式化功能
 */

import type { GitHubRelease, GitHubReleasePayload } from '../types';

/**
 * 截断文本到指定长度
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * 转义 Markdown 特殊字符
 */
export function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/([`_*[\]])/g, '\\$1');
}

/**
 * 转换发布说明中的 Markdown 格式为 Telegram 兼容格式
 */
export function convertMarkdownForTelegram(text: string): string {
  if (!text) return '';

  let result = text;

  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');
  result = result.replace(/__(.+?)__/g, '*$1*');
  result = result.replace(/~~(.+?)~~/g, '$1');
  result = result.replace(/([`_*[\]])/g, '\\$1');
  result = result.replace(/\\\*/g, '*');
  result = result.replace(/\\`/g, '`');

  return result;
}

/**
 * 格式化日期
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '未知';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 构建 Telegram 通知消息（从 Webhook Payload）
 */
export function buildNotificationMessage(payload: GitHubReleasePayload): string {
  const { release, repository, sender } = payload;

  const repoName = repository.full_name || repository.name;
  const releaseName = escapeMarkdown(release.name || release.tag_name);
  const releaseBody = convertMarkdownForTelegram(
    truncateText(release.body || '无发布说明 / No release notes', 500),
  );
  const tagUrl = `https://github.com/${repository.full_name}/releases/tag/${release.tag_name}`;

  return `*New Release / 新版本发布*

*Repository / 仓库*: [${repoName}](${repository.html_url})
*Version / 版本*: [${release.tag_name}](${tagUrl})
*Title / 标题*: ${releaseName}
*Publisher / 发布者*: [${sender.login}](${sender.html_url})
*Time / 时间*: ${formatDate(release.published_at)}

*Release Notes / 发布说明*:
${releaseBody}

[View Details / 查看详情](${tagUrl})`;
}

/**
 * 构建 Telegram 通知消息（从 GitHub API Release）
 */
export function buildApiReleaseMessage(
  release: GitHubRelease,
  repoFullName: string,
  repoUrl: string,
): string {
  const releaseName = escapeMarkdown(release.name || release.tag_name);
  const releaseBody = convertMarkdownForTelegram(
    truncateText(release.body || '无发布说明 / No release notes', 500),
  );
  const tagUrl = `https://github.com/${repoFullName}/releases/tag/${release.tag_name}`;

  return `*New Release / 新版本发布*

*Repository / 仓库*: [${repoFullName}](${repoUrl})
*Version / 版本*: [${release.tag_name}](${tagUrl})
*Title / 标题*: ${releaseName}
*Publisher / 发布者*: [${release.author.login}](${release.author.html_url})
*Time / 时间*: ${formatDate(release.published_at)}

*Release Notes / 发布说明*:
${releaseBody}

[View Details / 查看详情](${tagUrl})`;
}
