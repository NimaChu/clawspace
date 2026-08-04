import React, { useState } from 'react';

export default function ResultCard({ text, style }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('复制失败，请手动复制');
    }
  };

  return (
    <div className="result-card">
      <div className="result-header">
        <span className="style-badge">{style}</span>
        <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? '✓ 已复制' : '📋 复制'}
        </button>
      </div>
      <p className="result-text">{typeof text === 'string' ? text : '数据格式异常'}</p>
    </div>
  );
}
