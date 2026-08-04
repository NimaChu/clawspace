# GitHub OAuth 与部署说明

这份文档说明如何在本地和公网环境下启用 GitHub 快速登录，以及怎样把 GitHub 账号绑定到现有账号。

## 1. 创建 GitHub OAuth App

进入 GitHub 的 Developer settings，创建一个 **OAuth App**。

- Application name: `Nima Tech Space`
- Homepage URL:
  - 本地联调可填 `http://127.0.0.1:4321`
  - 公网部署后改成你的正式域名，比如 `https://your-domain.com`
- Authorization callback URL:
  - 本地联调: `http://127.0.0.1:4321/api/auth/github/callback`
  - 公网部署: `https://your-domain.com/api/auth/github/callback`

创建后你会拿到：

- `Client ID`
- `Client Secret`

## 2. 配置本地环境变量

在项目根目录创建 `.env` 文件，可以直接从 `.env.example` 复制：

```bash
cp .env.example .env
```

然后填入你自己的 GitHub OAuth 配置：

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

重新启动开发服务器后，`/login` 和 `/register` 页面里的 GitHub 快速登录就会生效。

## 3. 绑定规则

当前项目里的 GitHub 账号关系按下面几条处理：

1. 如果用户第一次就是通过 GitHub 注册，会自动创建账号并绑定该 GitHub 账号。
2. 如果用户原本是邮箱密码注册，但 GitHub 返回的邮箱和现有账号邮箱一致，GitHub 登录时会自动补绑到这个账号。
3. 如果用户原本是邮箱密码注册，且希望主动绑定 GitHub，可以先登录，再进入 `/account` 点击“绑定 GitHub 账号”。

## 4. 本地联调注意事项

- 当前回调地址是根据请求地址动态生成的，所以本地访问用什么 host，就要在 GitHub OAuth App 里配置对应回调地址。
- 如果你本地用的是 `127.0.0.1:4321`，就不要只配 `localhost:4321`。
- 修改 `.env` 后需要重启 `npm run dev`。

推荐本地固定用这个地址：

```text
http://127.0.0.1:4321
```

这样和当前项目默认开发地址一致。

## 5. 公网部署时要配置什么

部署到公网后，需要在部署平台里配置同样两个环境变量：

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

同时把 GitHub OAuth App 的：

- `Homepage URL`
- `Authorization callback URL`

切换成你的正式域名。

## 6. 当前部署形态限制

这个项目现在不是纯静态站点，而是需要 **Node 服务端运行**，原因有两类：

1. 登录注册会在运行时写入用户与会话数据
2. 应用导入会在运行时写入上传后的静态应用文件

当前运行时会写入这些路径：

- `runtime/data/users.json`
- `runtime/data/sessions.json`
- `runtime/data/apps-registry.json`
- `runtime/hosted-apps/`

这意味着部署环境需要：

- 可以运行 Node 服务
- 有可写磁盘
- 最好有持久化存储

## 7. 哪些平台更适合第一版

更适合：

- 自己的云服务器
- 带持久化磁盘的 Node 主机
- Docker + 挂载卷

不太适合：

- 纯静态托管
- 没有持久化文件系统的无状态部署环境

如果未来要做成正式产品，建议把下面这些再迁移出去：

- 用户数据
- 会话数据
- 应用注册表
- 上传后的应用资源

比较常见的升级方向是：

- 用户和会话放数据库
- 应用文件放对象存储 / CDN
- 应用索引和版本信息放数据库

## 8. 当前状态总结

- 本地默认可用的是邮箱注册 / 登录
- GitHub 登录 / 绑定只差环境变量与 OAuth App 配置
- 一旦配置完成，本地和公网都可以走同一套 GitHub 登录逻辑
