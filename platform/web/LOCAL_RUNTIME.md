# Local Runtime Guide

`nima-tech-space` 已经支持本地文件运行，不依赖 Vercel 才能启动。要把原先放在 Vercel / Neon / Blob 上的内容迁回本机，可以按下面做。

## 目标目录

本地运行时数据统一落在：

- `runtime/data`
- `runtime/hosted-apps`
- `runtime/downloads`

## 1. 准备本地环境

复制环境变量模板：

```bash
cp .env.example .env.local
```

建议本地模式至少改成下面这样：

```env
SITE_URL=http://127.0.0.1:4321
DATABASE_URL=
OBJECT_STORAGE_PROVIDER=filesystem
BLOB_READ_WRITE_TOKEN=
```

说明：

- `DATABASE_URL` 留空后，站点会直接读写 `runtime/data/*`
- `OBJECT_STORAGE_PROVIDER=filesystem` 后，应用静态文件和下载包会落到本地 `runtime/`
- `.env.local` 会覆盖 `.env`，适合放本机私密配置

## 2. 从远端导回数据

如果你还拿得到旧的远端数据库连接串，可以先临时写进 `.env.local`：

```env
DATABASE_URL=postgres://...
DATABASE_SSL_MODE=require
```

然后执行：

```bash
npm run migrate:runtime
```

这个脚本会做两件事：

1. 从 `runtime_files` 表导出所有运行时数据到本地 `runtime/data`
2. 读取 `runtime/data/object-storage-index.json`，把远端对象文件下载到：
   - `runtime/hosted-apps`
   - `runtime/downloads`

迁移完成后，把 `.env.local` 里的：

```env
DATABASE_URL=
OBJECT_STORAGE_PROVIDER=filesystem
BLOB_READ_WRITE_TOKEN=
```

重新切回本地模式。

## 3. 本地启动

开发模式：

```bash
npm install
npm run dev
```

生产构建 + 本地运行：

```bash
npm run build
npm run serve
```

现在项目已经改成 Astro Node standalone 适配，不再依赖 Vercel 运行时。

如果要使用 Apple Container 隔离运行，请参阅 [APPLE_CONTAINER.md](./APPLE_CONTAINER.md)。

## 4. 公网穿透

如果你打算通过公网穿透给外部访问：

1. 先把本地站点跑在固定端口，例如 `4321`
2. 用你自己的穿透工具把该端口映射出去
3. 把 `.env.local` 里的 `SITE_URL` 改成新的公网地址
4. 如果启用了 GitHub 登录，还要同步修改 GitHub OAuth callback URL

示例：

```env
SITE_URL=https://your-public-domain.example
```

## 5. 迁移后建议检查

至少确认这些页面和能力正常：

- `/`
- `/stars`
- `/creators/<slug>`
- `/downloads/<slug>.zip`
- `/api/health`
- 登录 / 注册
- 应用上传
- 应用封面显示

## 6. 重要提醒

- `runtime/` 仍在 `.gitignore` 里，不会被提交到仓库
- 迁移脚本会覆盖同名本地运行时文件，执行前建议先备份现有 `runtime/`
- 如果旧的 Blob 链接已经失效，`migrate:runtime` 只能导回数据库部分，静态资源需要再补传一次
