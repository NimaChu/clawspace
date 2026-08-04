import React from 'react';
import SceneTag from './base/SceneTag';

/**
 * 场景选择器组件
 * 支持多场景标签选择
 */
export default function SceneSelector({ scenes, selected, onSelect }) {
  return (
    <div className="scene-selector">
      <label>选择场景：</label>
      <div className="scene-tags">
        {scenes.map((scene) => (
          <SceneTag
            key={scene}
            scene={scene}
            active={selected === scene}
            onClick={() => onSelect(scene)}
          />
        ))}
      </div>
    </div>
  );
}
