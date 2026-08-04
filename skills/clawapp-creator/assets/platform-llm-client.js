export async function chatWithPlatformModel({ appId, messages, temperature = 0.7, max_tokens = 500 }) {
  const response = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId,
      messages,
      temperature,
      max_tokens,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || '模型请求失败');
  }

  return payload?.choices?.[0]?.message?.content || '';
}
