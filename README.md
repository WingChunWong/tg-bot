# MicYou-Backend

部署在 Cloudflare Workers 上的 GitHub Release 通知机器人。

## 部署

```bash
pnpm install
pnpm wrangler login
pnpm deploy
```

## 环境变量

```bash
pnpm wrangler secret put TG_BOT_TOKEN          # Telegram Bot Token
pnpm wrangler secret put TG_CHAT_ID            # 群组 ID
pnpm wrangler secret put TG_WEBHOOK_SECRET     # Telegram Webhook Secret Token
pnpm wrangler secret put GITHUB_WEBHOOK_SECRET # Webhook 密钥
pnpm wrangler secret put GITHUB_TOKEN          # GitHub Token（可选）
pnpm wrangler secret put TG_THREAD_ID          # 话题 ID（可选）
pnpm wrangler secret put ADMIN_USER_IDS        # 管理员 ID（可选）
```

## 路由

| 路径 | 说明 |
|------|------|
| `/` | 管理页面 |
| `/telegram/webhook` | Telegram Webhook |
| `/github/webhook` | GitHub Webhook |
| `/changelog` | Changelog 页面 |
| `/changelog.md` | Changelog 原始文件 |
| `/sendAll` | 发送所有历史 Release |
| `/sendLatest` | 发送最新 Release |

## 自动刷新

- Worker 已配置每小时 Cron（`0 * * * *`）自动刷新 changelog。
- 刷新逻辑会扫描 GitHub Releases API 并与 KV 现有数据对比，只有检测到变化才写入 KV。
- 可通过 `pnpm tail` 查看日志关键字：`[changelog-cron]`。

## Telegram Webhook 设置

`TG_WEBHOOK_SECRET` 需要你自己生成，并在设置 Telegram webhook 时同时配置到 Telegram 和 Worker。

生成 secret：

```powershell
[guid]::NewGuid().ToString('N')
```

设置 webhook 时，把下面两个值替换成你自己的：

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
	-H "Content-Type: application/json" \
	-d '{
		"url": "https://<YOUR_WORKER_DOMAIN>/telegram/webhook",
		"secret_token": "<YOUR_TG_WEBHOOK_SECRET>"
	}'
```

同时把同一个 secret 写入 Worker：

```bash
pnpm wrangler secret put TG_WEBHOOK_SECRET
```

之后 Telegram 会在回调请求头里带上 `X-Telegram-Bot-Api-Secret-Token`，Worker 会据此校验来源。

## 常用命令

```bash
pnpm dev      # 本地开发
pnpm deploy   # 部署
pnpm tail     # 查看日志
pnpm lint     # Biome lint
pnpm check    # Biome lint + format 检查
pnpm format   # Biome 自动格式化
```

## 代码规范

- 本项目使用 Biome 进行格式化和 lint。
- 配置文件位于 [biome.json](biome.json)。

## 包管理器说明

项目使用 pnpm 作为默认包管理器。请避免混用 npm/yarn，以免产生冲突锁文件。