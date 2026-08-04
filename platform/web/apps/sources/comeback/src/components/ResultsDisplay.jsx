import React, { useState } from 'react';
import ResultItem from './base/ResultItem';

/**
 * 结果展示组件
 * 整合多条结果卡片
 */
export default function ResultsDisplay({ results, style, onGenerate }) {
  const [activeResults, setActiveResults] = useState(results);

  // 更新显示结果
  React.useEffect(() => {
    if (results) {
      setActiveResults(results);
    }
  }, [results]);

  const handleRegenerate = () => {
    if (onGenerate) {
      onGenerate();
    }
  };

  return (
    <div className="results">
      {results && results.length > 0 && (
        <>
          <h2>为你生成了 {results.length} 个回复：</h2>
          <div className="results-list">
            {activeResults.map((item, idx) => (
              <ResultItem
                key={item.id || idx}
                text={item.text}
                style={item.style || style}
              />
            ))}
          </div>
          <button className="regenerate-btn" onClick={handleRegenerate}>
            🔄 换一批
          </button>
        </>
      )}
    </div>
  );
}
