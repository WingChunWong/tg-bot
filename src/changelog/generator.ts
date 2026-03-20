/**
 * Changelog Markdown 生成器
 */

import { ChangelogData } from '../types';
import { formatDate } from '../telegram/messages';

/**
 * 生成 CHANGELOG.md 格式的 Markdown 内容
 */
export function generateChangelogMarkdown(data: ChangelogData, _repoFullName: string): string {
  const lines: string[] = [
    `# Changelog`,
    ``,
  ];

  for (const entry of data.entries) {
    const releaseDate = formatDate(entry.published_at);
    const releaseUrl = entry.html_url;

    lines.push(`## [${entry.tag_name}](${releaseUrl})`);
    lines.push(``);
    if (entry.prerelease) {
      lines.push(` *(Pre-release)*`);
    }
    lines.push(``);
    lines.push(`**Update Date:** ${releaseDate}`);
    lines.push(``);

    if (entry.body) {
      lines.push(entry.body);
    } else {
      lines.push(`*No release notes provided.*`);
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join('\n');
}