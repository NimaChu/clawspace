/**
 * Comeback 组件导出
 * 支持嵌入式和独立模式
 */

// 原子组件（基础复用单元）
export { default as SceneTag } from './base/SceneTag';
export { default as StyleButton } from './base/StyleButton';
export { default as ResultItem } from './base/ResultItem';

// 核心组件（业务复用单元）
export { default as SceneSelector } from './SceneSelector';
export { default as StyleSelector } from './StyleSelector';
export { default as InputSection } from './InputSection';
export { default as ResultsDisplay } from './ResultsDisplay';

// 嵌入式组件（供 embedder 调用）
export { EmbedderApp, default as EmbedderAppDefault } from './components/embedder/EmbedderApp';
