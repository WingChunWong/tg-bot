/**
 * 类型定义
 */

// 环境变量类型定义
export interface Env {
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  TG_THREAD_ID?: string;
  TG_WEBHOOK_SECRET?: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_TOKEN?: string;
  ADMIN_USER_IDS?: string;
  ADMIN_PASSWORD?: string; // 管理后台登录密码
  CHANGELOG_SECRET?: string; // Changelog API 访问密钥
  ENVIRONMENT?: string;
  CHANGELOG_KV: KVNamespace;
}

// Changelog 存储类型定义
export interface ChangelogEntry {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string;
  author: {
    login: string;
    html_url: string;
  };
  prerelease: boolean;
}

// KV 存储的数据结构
export interface ChangelogData {
  entries: ChangelogEntry[];
  lastUpdated: string;
}

// Telegram Update 类型定义
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    message_thread_id?: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    text?: string;
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
    }>;
  };
}

// GitHub Release Webhook Payload 类型定义
export interface GitHubReleasePayload {
  action: string;
  release: GitHubRelease;
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
    html_url: string;
  };
}

// GitHub Release 类型定义
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string;
  author: {
    login: string;
    html_url: string;
  };
  prerelease: boolean;
  draft: boolean;
}

// GitHub API Release 类型别名
export type GitHubApiRelease = GitHubRelease;
