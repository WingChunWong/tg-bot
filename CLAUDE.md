# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub Release notification bot for Telegram, deployed on Cloudflare Workers. Monitors a specific GitHub repository (`LanRhyme/MicYou`) and sends release notifications to a Telegram chat.

## Commands

```bash
pnpm dev       # Local development server (wrangler dev)
pnpm deploy    # Deploy to Cloudflare Workers
pnpm tail      # View live logs from deployed worker
pnpm lint      # Biome lint check
pnpm check     # Biome lint + format check
pnpm format    # Biome auto-format
```

## Architecture

Entry point `src/index.ts` routes requests and handles scheduled cron events.

**Module structure:**
- `src/handlers/` - Route handlers (webhook endpoints, admin page, changelog API)
- `src/telegram/` - Telegram Bot API calls (sendMessage, admin checks)
- `src/github/` - GitHub API (fetch releases with pagination) and webhook handling
- `src/changelog/` - KV storage operations, changelog generation
- `src/config.ts` - Fixed repo config (`GITHUB_OWNER`, `GITHUB_REPO`, `CHANGELOG_KV_KEY`)
- `src/types.ts` - Env interface, payload types

**Key patterns:**
- KV namespace `CHANGELOG_KV` stores changelog data at key `changelog_data`
- Two update paths for changelog: (1) GitHub webhook on new release, (2) hourly cron that polls GitHub API and compares with KV
- Webhook secrets verified via HMAC (GitHub) and header token (Telegram)
- GitHub API pagination: fetches 100 per page until exhausted, filters out drafts

## Secrets (wrangler secret)

Required: `TG_BOT_TOKEN`, `TG_CHAT_ID`, `GITHUB_WEBHOOK_SECRET`
Optional: `TG_WEBHOOK_SECRET`, `TG_THREAD_ID`, `GITHUB_TOKEN`, `ADMIN_USER_IDS`, `ADMIN_PASSWORD`, `CHANGELOG_SECRET`

## Biome Configuration

Indent: 2 spaces, line width: 100, single quotes, semicolons always. Config in `biome.json`.