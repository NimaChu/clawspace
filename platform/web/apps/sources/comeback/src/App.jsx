import React, { useState } from 'react';
import SceneSelector from './components/SceneSelector';
import StyleSelector from './components/StyleSelector';
import InputSection from './components/InputSection';
import ResultsDisplay from './components/ResultsDisplay';
import { generateResponses } from './api/aiService';

const SCENES = ['职场回怼', '恋爱话术', '朋友圈文案', '亲戚应对', '社交拒绝'];
const STYLES = ['温柔版', '犀利版', '高情商版', '幽默版'];

function App() {
  const [scene, setScene] = useState('');
  const [inputText, setInputText] = useState('');
  const [style, setStyle] = useState('高情商版');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError('请输入内容');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const responses = await generateResponses({ scene, inputText, style });
      setResults(responses);
    } catch (err) {
      setError('生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🦾 AI 嘴替生成器</h1>
        <p>不会回怼？我教你</p>
      </header>

      <main className="main">
        <SceneSelector scenes={SCENES} selected={scene} onSelect={setScene} />

        <InputSection
          value={inputText}
          onChange={setInputText}
          onGenerate={handleGenerate}
          loading={loading}
        />

        <StyleSelector styles={STYLES} selected={style} onSelect={setStyle} />

        {error && <div className="error">{error}</div>}

        <ResultsDisplay
          results={results}
          style={style}
          onGenerate={handleGenerate}
        />
      </main>
    </div>
  );
}

export default App;
