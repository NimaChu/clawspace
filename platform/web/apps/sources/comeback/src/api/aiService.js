import axios from 'axios';

const BASE_URL = '/api/llm/chat';
const APP_ID = 'comeback-project';

const SCENE_MAP = {
  '职场回怼': '职场场景',
  '恋爱话术': '恋爱场景',
  '朋友圈文案': '朋友圈场景',
  '亲戚应对': '家庭场景',
  '社交拒绝': '社交场景'
};

const STYLE_MAP = {
  '温柔版': '温和委婉',
  '犀利版': '直接犀利',
  '高情商版': '高情商得体',
  '幽默版': '幽默风趣'
};

export async function generateResponses({ scene, inputText, style }) {
  const sceneDesc = SCENE_MAP[scene] || '通用场景';
  const styleDesc = STYLE_MAP[style] || '得体';

  const prompt = `你是 AI 嘴替助手，擅长帮用户生成得体的社交回应。

场景：${sceneDesc}
风格：${styleDesc}
用户输入：${inputText}

请生成 3 条不同角度的回复，要求：
1. 符合${styleDesc}的风格
2. 贴合${sceneDesc}的场景
3. 简短精炼，适合对话交流
4. 每条回复独立成行

直接返回 3 条回复，不要其他解释。`;

  try {
    const response = await axios.post(`${BASE_URL}`, {
      appId: APP_ID,
      messages: [
        { role: 'system', content: '你是 AI 嘴替助手，擅长帮用户生成得体的社交回应。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 500
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 秒超时
    });

    const content = response.data.choices[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('API 返回格式异常');
    }
    const responses = content.split('\n').map(r => r.trim()).filter(r => r.length > 0);

    return responses.map((text, idx) => ({
      id: idx,
      text,
      style
    }));
  } catch (error) {
    console.error('API 调用失败:', error.message);
    throw new Error(`AI 服务暂时不可用：${error.message}`);
  }
}
