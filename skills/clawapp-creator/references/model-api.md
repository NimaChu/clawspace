# Platform Model API

Use this only when the app genuinely needs AI.

## Endpoint

```text
POST /api/llm/chat
```

## Request shape

```json
{
  "appId": "your-app-id",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello" }
  ],
  "temperature": 0.7,
  "max_tokens": 500
}
```

For multimodal apps such as OCR or image analysis, use OpenAI-compatible content arrays:

```json
{
  "appId": "online-ocr-tool",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "请识别图片中的全部文字内容。" },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,BASE64_IMAGE_DATA",
            "detail": "high"
          }
        }
      ]
    }
  ],
  "temperature": 0.1,
  "max_tokens": 1000
}
```

## Response shape

Read:

```text
choices[0].message.content
```

## Usage rules

- Match `appId` to the app `id` or `slug` in `manifest.json`.
- Choose the right `modelCategory` at upload time.
- Use `multimodal` when the app needs OCR, image understanding, chart reading, or screenshot analysis.
- For multimodal messages, each `content` item must be valid `text` or `image_url`; do not send an empty content array.
- Do not store model API keys in client code.
- If the app does not need AI, keep `modelCategory` as `none` and do not call this endpoint.
