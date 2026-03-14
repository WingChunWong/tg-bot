# GitHub Release Telegram Bot

一个部署在 Cloudflare Workers 上的 GitHub Release 通知机器人，专为 [LanRhyme/MicYou](https://github.com/LanRhyme/MicYou) 仓库服务。当 GitHub 仓库有新版本发布时，自动向 Telegram 群组发送通知消息。

## 功能特性

- ✅ 接收 GitHub Release Webhook 事件
- ✅ HMAC-SHA256 签名验证，确保请求来自 GitHub
- ✅ 发送格式化的 Telegram 通知消息（中英双语）
- ✅ `/sendAll` 命令：首次启动时发送所有历史 Release
- ✅ 自动过滤草稿版本
- ✅ 零成本部署（Cloudflare Workers 免费额度）

## 项目结构

```
├── src/
│   └── index.ts        # 主入口，处理 webhook
├── wrangler.toml       # Cloudflare Workers 配置
├── package.json        # 项目依赖
├── tsconfig.json       # TypeScript 配置
└── README.md           # 本文档
```

## 前置要求

1. **Cloudflare 账号** - [注册地址](https://dash.cloudflare.com/sign-up)
2. **Telegram Bot Token** - 通过 [@BotFather](https://t.me/botfather) 创建
3. **Telegram Chat ID** - 群组或频道的 ID

## 快速开始

### 1. 克隆项目并安装依赖

```bash
cd "C:\Users\huang\git\tg bot"
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 配置环境变量（密钥）

使用 `wrangler secret` 命令设置敏感信息：

```bash
# 设置 Telegram Bot Token
npx wrangler secret put TG_BOT_TOKEN
# 输入你的 Bot Token，格式如：123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# 设置 Telegram Chat ID
npx wrangler secret put TG_CHAT_ID
# 输入群组 ID，格式如：-1001234567890

# 设置 GitHub Webhook Secret
npx wrangler secret put GITHUB_WEBHOOK_SECRET
# 输入一个自定义的密钥字符串，用于验证 Webhook 签名

# 设置 GitHub Token（可选，用于 /sendAll 命令提高 API 限制）
npx wrangler secret put GITHUB_TOKEN
# 输入 GitHub Personal Access Token，创建地址：https://github.com/settings/tokens
# 只需要 public_repo 权限即可

# 设置话题 ID（可选，发送到群组的特定话题）
npx wrangler secret put TG_THREAD_ID
# 输入话题 ID，例如：163
# 话题 URL 格式：https://t.me/群组用户名/话题ID
```

### 4. 部署到 Cloudflare Workers

```bash
npm run deploy
```

部署成功后，访问以下地址：

- **管理后台**: `https://bot.micyou.top/`
- **发送所有发布**: `https://bot.micyou.top/sendAll?secret=你的GITHUB_WEBHOOK_SECRET`

### 5. 配置 GitHub Webhook

1. 进入 [MicYou 仓库设置页面](https://github.com/LanRhyme/MicYou/settings/hooks)
2. 点击 **Settings** → **Webhooks** → **Add webhook**
3. 填写配置：
   - **Payload URL**: `https://bot.micyou.top/`
   - **Content type**: `application/json`
   - **Secret**: 你在步骤 3 设置的 `GITHUB_WEBHOOK_SECRET`
   - **Which events**: 选择 **Let me select individual events**，只勾选 **Releases**
   - **Active**: ✅ 勾选
4. 点击 **Add webhook** 保存

### 6. 配置 Telegram Bot Webhook

运行以下命令设置 Telegram Bot Webhook：

```bash
curl -F "url=https://bot.micyou.top/telegram" https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook
```

将 `<TG_BOT_TOKEN>` 替换为你的 Bot Token。

### 7. 首次启动：发送所有历史 Release

**方式一：在群组中使用命令**

在配置的 Telegram 群组中发送：
```
/sendAll
```

> 注意：只有群组管理员可以使用此命令

**方式二：通过网页 API**

访问以下 URL（需要管理员密钥）：
```
https://bot.micyou.top/sendAll?secret=你的GITHUB_WEBHOOK_SECRET
```

## 获取 Telegram Chat ID

### 方法一：使用 @userinfobot

1. 将 @userinfobot 添加到群组
2. 发送任意消息
3. 机器人会回复群组 ID

### 方法二：使用 API

1. 先向你的 Bot 发送一条消息
2. 访问：`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. 在返回的 JSON 中找到 `chat.id`

## 消息示例

当有新 Release 发布时，Telegram 会收到如下格式的消息：

```
🚀 新版本发布通知

📦 仓库: owner/repo
🏷 版本: v1.0.0
📝 标题: First Release
👤 发布者: username
📅 时间: 2024/01/15 10:30

📋 发布说明:
- 新功能 A
- 修复 Bug B
- 性能优化

🔗 查看详情
```

## 本地开发

```bash
# 启动本地开发服务器
npm run dev
```

本地开发时，可以使用 [ngrok](https://ngrok.com/) 或 [cloudflared tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/) 暴露本地端口进行测试。

## 查看日志

```bash
# 实时查看 Worker 日志
npm run tail
```

## 环境变量说明

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `TG_BOT_TOKEN` | Telegram Bot Token | [@BotFather](https://t.me/botfather) |
| `TG_CHAT_ID` | 目标群组/频道 ID | @userinfobot 或 API |
| `TG_THREAD_ID` | 话题 ID（可选） | 话题 URL 中的数字，如 `https://t.me/MicYouChannel/163` 中的 `163` |
| `GITHUB_WEBHOOK_SECRET` | Webhook 签名密钥 | 自定义字符串 |
| `GITHUB_TOKEN` | GitHub Personal Access Token | [创建 Token](https://github.com/settings/tokens)，需要 `public_repo` 权限 |
| `ADMIN_USER_IDS` | 管理员用户 ID 列表（可选） | 逗号分隔的 Telegram 用户 ID |

> 注：`/sendAll` 命令默认只允许群组管理员使用。如需额外指定管理员，可设置 `ADMIN_USER_IDS`。

## 安全特性

- **签名验证**: 使用 HMAC-SHA256 验证请求来自 GitHub
- **时间安全比较**: 防止时序攻击
- **密钥存储**: 敏感信息通过 Cloudflare Workers Secrets 加密存储
- **事件过滤**: 只处理 `release.published` 事件

## 自定义配置

### 修改消息格式

编辑 `src/index.ts` 中的 `buildNotificationMessage` 函数：

```typescript
function buildNotificationMessage(payload: GitHubReleasePayload): string {
  // 自定义消息格式
  const message = `你的自定义模板...`;
  return message;
}
```

### 包含预发布版本

默认会忽略 `prerelease` 版本，如需包含，修改 `src/index.ts`：

```typescript
// 删除或注释这段代码
if (data.release.prerelease) {
  return new Response(...);
}
```

## 故障排查

### Webhook 返回 401

- 检查 `GITHUB_WEBHOOK_SECRET` 是否正确设置
- 确保 GitHub Webhook 配置中的 Secret 与环境变量一致

### Telegram 消息发送失败

- 检查 `TG_BOT_TOKEN` 是否正确
- 检查 `TG_CHAT_ID` 是否正确（群组 ID 通常以 `-100` 开头）
- 确保 Bot 已添加到目标群组并有发送消息的权限

### 查看详细错误

```bash
npm run tail
```

## 许可证

MIT License