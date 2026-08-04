# Apple Container 部署指南

这个方案把网站程序放进 OCI 镜像，把账号、应用、封面、下载包和游戏分数继续保存在 Mac 的 `runtime/` 目录。重建镜像或删除容器不会删除这些业务数据。

## 文件关系

- 镜像内程序：`/app/dist`、`/app/node_modules`
- Mac 持久数据：`runtime/`
- 容器内挂载点：`/app/runtime`
- 本机访问地址：`http://127.0.0.1:4321`

## 第一次启动

准备容器环境配置：

```bash
cp .env.container.example .env.container
```

构建镜像并启动：

```bash
npm run container:build
npm run container:start
```

打开：

```text
http://127.0.0.1:4321
```

`scripts/apple-container.sh` 会强制使用本地文件存储，即使旧 `.env.local` 里仍保留 Neon 或 Vercel Blob 配置，也不会让容器重新连接远端存储。

## 日常管理

```bash
npm run container:status
npm run container:logs
npm run container:restart
npm run container:stop
```

代码更新后，重新执行：

```bash
npm run container:build
npm run container:restart
```

## 配置

网站原有的模型配置会从项目根目录 `.env` 注入容器。容器专用配置放在 `.env.container`，这两个文件都不会进入镜像或 Git。

接入公网域名时，把 `.env.container` 改为：

```env
SITE_URL=https://nima-tech.space
```

默认只将容器端口绑定到 Mac 的 `127.0.0.1`，适合由公网穿透程序转发。若需要让同一局域网的设备直接访问：

```bash
NIMA_CONTAINER_BIND=0.0.0.0 npm run container:start
```

可选资源配置：

```bash
NIMA_CONTAINER_CPUS=4 NIMA_CONTAINER_MEMORY=4g npm run container:start
```

构建时默认临时分配 4 CPU / 4 GB 内存，构建完成后会自动停止 BuildKit 虚拟机，只保留网站容器。可用 `NIMA_CONTAINER_BUILD_CPUS` 和 `NIMA_CONTAINER_BUILD_MEMORY` 调整。

脚本默认给构建器和网站容器使用 `223.5.5.5`，避免 macOS 代理的 Fake IP DNS 被带进 Linux 虚拟机。需要更换时可执行：

```bash
NIMA_CONTAINER_DNS=1.1.1.1 npm run container:build
```

镜像构建使用阿里云 Debian 镜像源，避免中国大陆网络直连 Debian 官方软件源时长时间停滞；它只用于安装标准 Linux 系统依赖。

## 数据备份

容器运行期间，新增账号、上传应用和游戏分数都会直接写入 Mac 的 `runtime/`。备份时只需备份该目录：

```bash
tar -czf nima-runtime-backup.tar.gz runtime
```

Apple Container 当前没有 Docker Compose 式的自动重启配置。Mac 重启后，需要先执行：

```bash
npm run container:start
```

## 代理排查

如果首次启动长时间停在 GitHub 内核或 BuildKit 镜像下载，而 Mac 正在使用本地代理，Apple Container 后台服务可能没有自动继承系统代理。可把下面端口替换成代理软件显示的实际端口后执行：

```bash
launchctl setenv HTTP_PROXY http://127.0.0.1:7897
launchctl setenv HTTPS_PROXY http://127.0.0.1:7897
launchctl setenv ALL_PROXY socks5h://127.0.0.1:7897
container system stop
container system start
```

不再需要代理时可清除：

```bash
launchctl unsetenv HTTP_PROXY
launchctl unsetenv HTTPS_PROXY
launchctl unsetenv ALL_PROXY
```
