const inputNode = document.getElementById('input-text');
const resultBox = document.getElementById('result-box');
const statusNode = document.getElementById('status');
const generateButton = document.getElementById('generate-button');
const resetButton = document.getElementById('reset-button');

const APP_ID = '__APP_SLUG__';

async function generateRewrite() {
  const draft = inputNode.value.trim();
  if (!draft) {
    statusNode.textContent = '请输入内容';
    resultBox.textContent = '先输入一句原始草稿，再点击生成。';
    return;
  }

  statusNode.textContent = '生成中';
  generateButton.disabled = true;

  try {
    const response = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appId: APP_ID,
        messages: [
          {
            role: 'system',
            content: '你是一个中文文案润色助手。请把用户输入改写成更自然、清晰、友好的表达。',
          },
          {
            role: 'user',
            content: draft,
          },
        ],
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || '生成失败');
    }

    const content = payload.choices?.[0]?.message?.content || '没有拿到模型结果。';
    resultBox.textContent = content;
    statusNode.textContent = '生成完成';
  } catch (error) {
    resultBox.textContent = error.message || '生成失败，请稍后再试。';
    statusNode.textContent = '请求失败';
  } finally {
    generateButton.disabled = false;
  }
}

generateButton.addEventListener('click', generateRewrite);
resetButton.addEventListener('click', () => {
  inputNode.value = '';
  resultBox.textContent = '生成结果会显示在这里。';
  statusNode.textContent = '准备开始';
});
