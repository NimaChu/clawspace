import React from 'react';
import StyleButton from './base/StyleButton';

const STYLES = ['温柔版', '犀利版', '高情商版', '幽默版'];

/**
 * 风格选择器组件
 * 支持多风格按钮选择
 */
export default function StyleSelector({ styles = STYLES, selected, onSelect }) {
  return (
    <div className="style-selector">
      <label>选择风格：</label>
      <div className="style-buttons">
        {styles.map((style) => (
          <StyleButton
            key={style}
            style={style}
            active={selected === style}
            onClick={() => onSelect(style)}
          />
        ))}
      </div>
    </div>
  );
}
