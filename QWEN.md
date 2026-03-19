# QWEN.md - MicYou-Backend 项目上下文

## 项目概述

MicYou-Backend 是一个部署在 Cloudflare Workers 上的 GitHub Release 通知机器人。它监听 GitHub 仓库的 Release 事件，并通过 Telegram Bot 向指定群组发送通知消息。

### 核心功能
- GitHub Webhook 接收 Release 事件
- Telegram Bot 消息推送
- Changelog 页面展示（存储在 Cloudflare KV）
- 管理后台页面
- 支持话题（Thread）消息发送

### 技术栈
- **运行时**: Cloudflare Workers
- **语言**: TypeScript
- **存储**: Cloudflare KV Namespace
- **外部 API**: GitHub API、Telegram Bot API

## 项目结构

```
src/
├── index.ts          # 入口文件，路由分发
├── types.ts          # 类型定义
├── config.ts         # 配置常量（仓库信息）
├── changelog/        # Changelog 生成模块
│   └── generator.ts
├── github/           # GitHub 相关模块
│   ├── api.ts        # GitHub API 调用
│   ├── index.ts      # 模块导出
│   └── webhook.ts    # Webhook 处理
├── handlers/         # 请求处理器
│   ├── index.ts      # 模块导出
│   ├── admin.ts      # 管理后台
│   ├── changelog.ts  # Changelog 页面
│   ├── github.ts     # GitHub Webhook
│   ├── sendAll.ts    # 批量发送
│   └── telegram.ts   # Telegram Webhook
└── telegram/         # Telegram 相关模块
    ├── api.ts        # Telegram API 调用
    ├── index.ts      # 模块导出
    └── messages.ts   # 消息模板
```

## 构建与运行命令

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 查看实时日志
npm run tail
```

> **部署**: 已绑定 Git 仓库，推送代码后自动部署到 Cloudflare Workers。

## 环境变量配置

通过 `wrangler secret put` 设置以下密钥：

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `TG_BOT_TOKEN` | ✅ | Telegram Bot Token |
| `TG_CHAT_ID` | ✅ | 目标群组 ID |
| `GITHUB_WEBHOOK_SECRET` | ✅ | GitHub Webhook 密钥 |
| `GITHUB_TOKEN` | ❌ | GitHub Token（提高 API 限额） |
| `TG_THREAD_ID` | ❌ | 话题 ID |
| `ADMIN_USER_IDS` | ❌ | 管理员用户 ID（逗号分隔） |
| `ADMIN_PASSWORD` | ❌ | 管理后台登录密码 |

## API 路由

| 路径 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 管理后台页面 |
| `/telegram/webhook` | POST | Telegram Webhook 入口 |
| `/github/webhook` | POST | GitHub Webhook 入口 |
| `/changelog` | GET | Changelog HTML 页面 |
| `/changelog.md` | GET | Changelog 原始 Markdown |
| `/changelog/refresh` | GET | 刷新 Changelog（可选 secret 参数） |
| `/sendAll` | POST | 发送所有历史 Release |
| `/api/login` | POST | 管理后台登录 |
| `/api/status` | GET | 获取系统状态 |

## 开发规范

### TypeScript 配置
- 目标: ES2022
- 模块: ES2022
- 严格模式已启用
- 使用 `@cloudflare/workers-types` 类型定义

### 代码风格
- 使用 ES 模块语法
- 函数和变量使用 camelCase
- 类型/接口使用 PascalCase
- 常量使用 UPPER_SNAKE_CASE

### 模块组织
- 每个功能模块独立目录
- `index.ts` 作为模块导出入口
- API 调用与业务逻辑分离

## 目标仓库配置

当前监听的 GitHub 仓库在 `src/config.ts` 中配置：
- Owner: `LanRhyme`
- Repo: `MicYou`

## 部署注意事项

1. 确保 Cloudflare KV Namespace 已创建并绑定
2. 自定义域名配置在 `wrangler.toml` 的 `routes` 中
3. 部署前需完成 `wrangler login` 认证