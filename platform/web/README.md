# Nima Tech Space

Nima Tech Space 现在是一个支持“静态前端应用打包、导入、自动上架”的应用站点第一版。

## 当前能力

- 首页展示应用列表
- 应用详情页按运行时注册表渲染
- `launch` 路由跳转到导入后的静态应用
- 后台页面支持上传 zip 应用包并自动上架
- `comeback` 已作为第一份标准应用包接入

## 第一版导入模型

- 仅支持静态前端应用
- 应用包格式为 `.zip`
- 单个上传包大小限制为 `25MB`
- 在 Vercel 环境中，超过 `4.5MB` 的应用包会自动改走 Blob 直传
- 上传后自动校验 `manifest.json`
- 导入后的静态文件会优先写入对象存储；未配置对象存储时回落到 `runtime/hosted-apps/`
- 应用元数据写入 `runtime/data/apps-registry.json`

详细格式见 [docs/app-package-spec.md](./docs/app-package-spec.md)。

## 统一模型 API

站点现在提供统一模型接口，供导入应用直接调用：

```text
POST /api/llm/chat
```

当前默认通过阿里云百炼北京区转发，说明见 [docs/model-gateway.md](./docs/model-gateway.md)。

## 登录与后台

- 支持邮箱注册 / 登录
- 支持 GitHub 快速登录
- 首次用 GitHub 注册时会自动绑定当前 GitHub 账号
- 如果邮箱密码账号与 GitHub 邮箱一致，GitHub 登录时会自动补绑
- 邮箱密码注册的用户登录后可在 `/account` 手动绑定 GitHub
- 后台入口是 `/admin/import`
- 未登录访问后台会自动跳转到 `/login`

GitHub 登录配置见 [docs/github-oauth-setup.md](./docs/github-oauth-setup.md)。

## 本地开发

从仓库根目录安装依赖，再进入网站目录：

```bash
npm ci
cd platform/web
```

再复制环境变量模板：

```bash
cp .env.example .env
```

本地可信开发时可以只保留默认值。公网部署至少需要设置：

```env
SITE_URL=https://example.com
HOSTED_APPS_ORIGIN=https://apps.example.com
ADMIN_EMAIL=admin@example.com
COOKIE_SECURE=true
```

`HOSTED_APPS_ORIGIN` 必须使用和主站不同的 origin，并由反向代理或隧道指向同一个服务。这样用户上传的 HTML/JavaScript 不会继承主站登录会话。首次注册用户不会自动成为管理员，只有邮箱匹配 `ADMIN_EMAIL` 的账号会获得管理员角色。

如果要启用站点统一模型，需要配置：

```env
DASHSCOPE_API_KEY=your_dashscope_key
DASHSCOPE_MODEL=qwen3.5-plus
DASHSCOPE_TEXT_MODEL=qwen3.5-plus
DASHSCOPE_MULTIMODAL_MODEL=qwen3-vl-plus-2025-12-19
DASHSCOPE_CODE_MODEL=qwen3-coder-next
```

如果你要把运行时核心数据迁到数据库，还需要配置：

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
# 如果数据库不需要 SSL:
# DATABASE_SSL_MODE=disable
```

如果你要把托管应用文件和下载包迁到对象存储，建议再配置：

```env
# 可选，显式指定对象存储实现
# OBJECT_STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token

# 可选：让可信调试客户端绕过上传限流
# IMPORT_RATE_LIMIT_BYPASS_IPS=1.2.3.4,5.6.7.8
# IMPORT_RATE_LIMIT_BYPASS_EMAILS=you@example.com,another@example.com
```

启动站点：

```bash
npm run dev
```

默认访问：

- 首页: `http://127.0.0.1:4321/`
- 登录页: `http://127.0.0.1:4321/login`
- 注册页: `http://127.0.0.1:4321/register`
- 账号设置: `http://127.0.0.1:4321/account`
- 导入后台: `http://127.0.0.1:4321/admin/import`

如果 `4321` 被占用，Astro 会自动切到其他端口。

如果你要本地测试 GitHub 登录，推荐固定使用：

- `http://127.0.0.1:4321`

这样能和 OAuth 回调地址保持一致。

## 打包与导入

把 `comeback` 打成标准应用包：

```bash
npm run package:comeback
```

把任意标准应用包导入网站：

```bash
npm run import:package -- ./apps/zips/comeback-project.zip
```

一键重新打包并导入 `comeback`：

```bash
npm run seed:comeback
```

## 关键目录

```text
apps/packages/             # 应用包定义源文件
apps/sources/comeback/     # 示例 React/Vite 应用源码
apps/zips/                 # 打出来的 zip 包
runtime/data/apps-registry.json    # 运行时应用注册表
runtime/data/users.json            # 用户数据
runtime/data/sessions.json         # 登录会话
docs/app-package-spec.md   # 应用包规范
docs/github-oauth-setup.md # GitHub 登录与部署说明
docs/model-gateway.md      # 统一模型网关说明
docs/vercel-production-checklist.md # Vercel 正式上线清单
docs/scaling-roadmap.md    # 平台扩容路线图
docs/wechat-mini-program-shell-plan.md # 微信小程序壳方案
scripts/                   # 打包与导入脚本
src/pages/admin/model.astro
src/pages/admin/users.astro
src/pages/admin/import.astro
src/pages/api/admin/users.js
src/pages/api/admin/site-model.js
src/pages/api/llm/chat.js
src/pages/api/import-app.js
src/pages/apps/[slug].astro
src/pages/launch/[slug].astro
src/pages/hosted-apps/[slug]/[...path].js
runtime/hosted-apps/       # 导入后的静态应用文件
```

## 部署说明

当前版本需要 Node 服务端环境，不适合纯静态托管。

存储层已经分成两部分：

- `runtime/data/*`
  配置 `DATABASE_URL` 后，会优先写入数据库
- `hosted-apps/*` 和 `downloads/*`
  配置 `BLOB_READ_WRITE_TOKEN` 后，会优先写入对象存储；否则回落到本地文件系统

这意味着现在最适合的正式部署方式是：

- 一个支持 Node 服务端的运行环境
- 一个 PostgreSQL 数据库
- 一个对象存储
- 如果暂时不用对象存储，则仍需要可持久化文件系统或挂载卷

也就是说，这版已经可以把账号、会话、应用注册表、作者样式、限流等核心运行时数据迁到数据库，也可以把托管应用文件和下载包迁到对象存储。

如果你要启用 GitHub 快速登录，还需要在运行环境里配置：

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

详细步骤见 [docs/github-oauth-setup.md](./docs/github-oauth-setup.md)。

如果你要启用统一模型网关，还需要配置：

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_MODEL`

详细说明见 [docs/model-gateway.md](./docs/model-gateway.md)。

如果你准备使用兼容的 Vercel 发布链路，可参考历史文档 [docs/vercel-production-checklist.md](./docs/vercel-production-checklist.md)。

如果你需要让自己的 OpenClaw / 开发机不受上传频率限制影响，可以额外配置：

- `IMPORT_RATE_LIMIT_BYPASS_IPS`
  允许指定 IP 跳过 `/api/import-app` 的上传限流
- `IMPORT_RATE_LIMIT_BYPASS_EMAILS`
  允许指定账号邮箱跳过 `/api/import-app` 的上传限流
- `AUTH_RATE_LIMIT_BYPASS_IPS`
  允许指定 IP 跳过 `/api/auth/login` 和 `/api/auth/register` 的频率限制
- `AUTH_RATE_LIMIT_BYPASS_EMAILS`
  允许指定账号邮箱跳过 `/api/auth/login` 和 `/api/auth/register` 的频率限制

## 存储层现状

项目现在已经把运行时文件读写收口到统一存储层 [runtime-storage.js](./src/lib/runtime-storage.js)。

当前实现是“混合存储”：

- `runtime/data/*`
  如果配置了 `DATABASE_URL`，会写入数据库表 `runtime_files`
- `hosted-apps/*`
  如果配置了 `BLOB_READ_WRITE_TOKEN`，会写入对象存储
- `downloads/*`
  如果配置了 `BLOB_READ_WRITE_TOKEN`，会写入对象存储

这意味着：

- 现阶段本地开发和现有功能不受影响
- 账号、会话、应用注册表、站点模型配置、作者样式、限流数据已经具备数据库承接能力
- 托管静态文件和下载包已经具备对象存储承接能力
- 未配置对象存储时，仍然会自动回落到本地文件系统

也就是说，这版已经完成“运行时数据可迁库 + 托管文件可迁对象存储”的第二步。
