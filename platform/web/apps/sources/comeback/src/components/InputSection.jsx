import React from 'react';

/**
 * 输入区域组件
 * 包含文本输入框和生成按钮
 */
export default function InputSection({
  value,
  onChange,
  onGenerate,
  loading,
  placeholder = '发生了什么？对方说/做了... 或者你想表达什么？'
}) {
  return (
    <div className="input-section">
      <label>发生了什么？</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
      />
      <button
        className="generate-btn"
        onClick={onGenerate}
        disabled={loading || !value.trim()}
      >
        {loading ? '生成中...' : '生成回复'}
      </button>
    </div>
  );
}
