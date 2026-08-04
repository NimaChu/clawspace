import React from 'react';

const STYLE_ICONS = {
  '温柔版': '🌸',
  '犀利版': '⚡',
  '高情商版': '🎯',
  '幽默版': '😄'
};

/**
 * 单个风格按钮（原子组件）
 * 可复用于 StyleSelector 和嵌入式组件
 */
export default function StyleButton({ style, active, onClick }) {
  return (
    <button
      className={`style-btn ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {STYLE_ICONS[style] || '✨'} {style}
    </button>
  );
}
