# 站点统一模型网关

Nima Tech Space 现在提供一个站点级统一模型接口：

```text
POST /api/llm/chat
```

它的目标是让导入到站点里的应用，不再各自保存或暴露模型 API Key，而是统一通过网站服务端调用模型。

同时，站点现在还提供一个后台配置页：

```text
/admin/model
```

可以直接修改：

- 文本模型
- 多模态模型
- Code 模型
- 站点模型开关
- 每 IP 每分钟限流
- 每 IP 每天限流

## 1. 当前接入方式

站点服务端现在会把请求转发到阿里云百炼北京区的 OpenAI 兼容接口：

- 上游接口: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- 默认文本模型: `qwen3.5-plus`
- 默认多模态模型: `qwen3-vl-plus-2025-12-19`
- 默认代码模型: `qwen3-coder-next`
- 可通过环境变量覆盖默认模型

## 2. 环境变量

至少需要配置：

```env
DASHSCOPE_API_KEY=your_dashscope_key
DASHSCOPE_MODEL=qwen3.5-plus
DASHSCOPE_TEXT_MODEL=qwen3.5-plus
DASHSCOPE_MULTIMODAL_MODEL=qwen3-vl-plus-2025-12-19
DASHSCOPE_CODE_MODEL=qwen3-coder-next
```

说明：

- `DASHSCOPE_API_KEY` 必填
- `DASHSCOPE_MODEL` 可选，作为通用回退模型
- `DASHSCOPE_TEXT_MODEL` / `DASHSCOPE_MULTIMODAL_MODEL` / `DASHSCOPE_CODE_MODEL` 可分别指定三类模型

## 3. 请求格式

```json
{
  "appId": "comeback-project",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello" }
  ],
  "temperature": 0.7,
  "max_tokens": 500
}
```

## 4. 返回格式

返回的是 OpenAI 兼容的 `chat completions` JSON 结构，应用可以直接按 `choices[0].message.content` 读取。

## 5. 适合什么场景

这版统一网关适合：

- 低频调用
- MVP 测试
- 站内静态前端应用复用统一模型能力

## 6. 关于百炼模型选择

推荐默认组合：

- 文本：`qwen3.5-plus`
- 多模态：`qwen3-vl-plus-2025-12-19`
- 代码：`qwen3-coder-next`

如果你后面需要更轻量或更低成本的模型，也只需要在后台页面 `/admin/model` 修改这三项，不需要改应用前端。

## 7. 面向未来导入应用的约定

如果以后 OpenClaw 应用想复用站点模型，推荐统一按下面方式调用：

- 使用站点接口 `/api/llm/chat`
- 用 `appId` 标明应用身份
- 在应用元数据里标明 `modelCategory`
- 前端不要直接存放模型 API Key

这样后面你切换到：

- 百炼其他模型
- 其他供应商
- 站点级限流 / 审计 / 配额

都不需要每个应用分别改一遍。
