# CLAWSPACE Model API

Apps that need AI should prefer the platform model API instead of embedding third-party model keys in client code.

## Endpoint

`POST /api/llm/chat`

Base URL:

`https://www.nima-tech.space`

## Minimum request

```json
{
  "appId": "your-app-slug",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
```

## App requirements

- The uploaded app should choose the correct `modelCategory`.
- Allowed categories:
  - `text`
  - `multimodal`
  - `code`

If the app does not need AI, use `none`.

## Guidance

- Do not expose third-party API keys in client-side code.
- Route AI features through the platform API.
- Match the chosen model category to the app’s real use case.
