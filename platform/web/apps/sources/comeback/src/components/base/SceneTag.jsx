import React from 'react';

/**
 * 单个场景标签（原子组件）
 * 可复用于 SceneSelector 和嵌入式组件
 */
export default function SceneTag({ scene, active, onClick }) {
  return (
    <button
      className={`scene-tag ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {scene}
    </button>
  );
}
