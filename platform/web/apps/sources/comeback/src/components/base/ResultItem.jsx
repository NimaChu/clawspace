import React, { useState } from 'react';

/**
 * 单条结果卡片（原子组件）
 * 包含复制功能和样式展示
 */
export default function ResultItem({ text, style, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (onCopy) {
        onCopy(text);
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('复制失败，请手动复制');
    }
  };

  return (
    <div className="result-card">
      <div className="result-header">
        <span className="style-badge">{style}</span>
        <button
          className={`copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
        >
          {copied ? '✓ 已复制' : '📋 复制'}
        </button>
      </div>
      <p className="result-text">{typeof text === 'string' ? text : '数据格式异常'}</p>
    </div>
  );
}
