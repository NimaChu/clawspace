import React, { useState, useCallback } from 'react';
import SceneSelector from './components/SceneSelector';
import StyleSelector from './components/StyleSelector';
import InputSection from './components/InputSection';
import ResultsDisplay from './components/ResultsDisplay';
import { generateResponses as defaultGenerate } from './api/aiService';

const DEFAULT_SCENES = ['职场回怼', '恋爱话术', '朋友圈文案', '亲戚应对', '社交拒绝'];
const DEFAULT_STYLES = ['温柔版', '犀利版', '高情商版', '幽默版'];

/**
 * 嵌入式应用组件
 * 用于嵌入到其他网站，支持自定义 API 和配置
 */
export function EmbedderApp({
  scenes = DEFAULT_SCENES,
  styles = DEFAULT_STYLES,
  defaultScene = '',
  defaultStyle = '高情商版',
  apiService = { generate: defaultGenerate },
  onResultGenerated,
  className = '',
  style = {}
}) {
  const [scene, setScene] = useState(defaultScene);
  const [inputText, setInputText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(defaultStyle);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!inputText.trim()) {
      setError('请输入内容');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const responses = await apiService.generate({ scene, inputText, style: selectedStyle });
      setResults(responses);

      if (onResultGenerated) {
        onResultGenerated(responses);
      }
    } catch (err) {
      setError('生成失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [inputText, scene, selectedStyle, apiService, onResultGenerated]);

  const handleRegenerate = useCallback(() => {
    if (results.length > 0) {
      handleGenerate();
    }
  }, [results.length, handleGenerate]);

  return (
    <div className={`embedder-app ${className}`} style={style}>
      <header className="header">
        <h1>🤖 AI 嘴替生成器</h1>
        <p>不会回怼？我教你</p>
      </header>

      <main className="main">
        <SceneSelector
          scenes={scenes}
          selected={scene}
          onSelect={setScene}
        />

        <InputSection
          value={inputText}
          onChange={setInputText}
          onGenerate={handleGenerate}
          loading={loading}
        />

        <StyleSelector
          styles={styles}
          selected={selectedStyle}
          onSelect={setSelectedStyle}
        />

        {error && <div className="error">{error}</div>}

        <ResultsDisplay
          results={results}
          style={selectedStyle}
          onGenerate={handleRegenerate}
        />
      </main>
    </div>
  );
}

export default EmbedderApp;
