# Nima Tech Space 公网上线清单

这份清单面向当前的正式平台版，不是展示版。

## 目标域名

- 生产域名: `https://nima-tech.space`

## 上线前确认

- 仓库已经推到 GitHub 同名仓库
- Vercel 项目已经绑定这个仓库
- Astro 站点地址已配置为 `https://nima-tech.space`
- 本地 `npm run build` 已通过

## Vercel 必配环境变量

### 数据库

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
# 如果数据库不需要 SSL，可选:
# DATABASE_SSL_MODE=disable
```

### 对象存储

```env
# 可选，不填也能自动识别 Vercel Blob
OBJECT_STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### GitHub 登录

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

GitHub OAuth 回调地址应配置为：

```text
https://nima-tech.space/api/auth/github/callback
```

### 平台模型

```env
DASHSCOPE_API_KEY=your_dashscope_key
DASHSCOPE_MODEL=qwen3.5-plus
DASHSCOPE_TEXT_MODEL=qwen3.5-plus
DASHSCOPE_MULTIMODAL_MODEL=qwen3-vl-plus-2025-12-19
DASHSCOPE_CODE_MODEL=qwen3-coder-next
```

## 推荐的 Vercel 配置顺序

1. 先在 Vercel 配好 `DATABASE_URL`
2. 再开通并绑定 Vercel Blob，写入 `BLOB_READ_WRITE_TOKEN`
3. 再配置 GitHub OAuth 环境变量
4. 最后配置百炼模型环境变量
5. 触发一次新的生产部署

## 上线后立即验证

先访问健康检查接口：

```text
https://nima-tech.space/api/health
```

理想返回应是：

- `databaseConfigured: true`
- `objectStorageConfigured: true`
- `githubOAuthConfigured: true`
- `dashscopeConfigured: true`

再人工验证这几条：

1. 首页能打开
2. 注册 / 登录能成功
3. `/account` 能正常打开
4. `/admin/import` 能上传一个 zip
5. 上传后应用详情页能打开
6. 点击“立即体验”能正常打开托管应用
7. 点击“下载应用包”能正常下载 zip
8. `Comeback` 能正常调用网站统一模型

## 当前架构边界

现在这版已经适合 Vercel + 数据库 + Blob 的组合：

- `runtime/data/*`:
  走数据库
- `hosted-apps/*`:
  走对象存储
- `downloads/*`:
  走对象存储

如果没配数据库或对象存储，项目仍会自动回退到本地文件系统，但这不适合正式公网环境。
