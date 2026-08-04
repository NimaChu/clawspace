# Static App Package Spec v1

应用包使用 zip 格式，根目录必须包含以下结构：

```text
manifest.json
README.md            # 可选
assets/              # 可选，放封面、图标、截图
app/                 # 必填，放静态构建产物
```

## manifest.json 最低要求

```json
{
  "schemaVersion": 1,
  "id": "your-app-id",
  "slug": "your-app-id",
  "name": "Your App",
  "description": "一句话描述",
  "version": "1.0.0",
  "entry": "app/index.html"
}
```

## 推荐字段

- `author`
- `links`
- `tags`
- `stars`
- `featured`
- `thumbnail`
- `icon`
- `screenshots`
- `features`
- `techStack`
- `usageSteps`
- `runtime`

## 约束

- 当前只支持静态前端应用
- `entry` 必须位于 `app/` 目录下
- 构建产物最好使用相对资源路径，避免写死站点 base
- 上传同 slug 应用时会自动覆盖旧版本
