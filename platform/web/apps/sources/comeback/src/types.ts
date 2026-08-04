/**
 * TypeScript 类型定义（适用于组件化场景）
 */

/**
 * API 参数接口
 */
export interface GenerateParams {
  scene: string;
  inputText: string;
  style: string;
}

/**
 * API 返回结果接口
 */
export interface GenerateResult {
  id: number;
  text: string;
  style?: string;
}

/**
 * API 服务接口
 */
export interface ApiService {
  generate: (params: GenerateParams) => Promise<GenerateResult[]>;
}

/**
 * EmbedderApp 组件 Props 接口
 */
export interface EmbedderAppProps {
  // 可选配置
  scenes?: string[];
  styles?: string[];
  defaultScene?: string;
  defaultStyle?: string;

  // API 服务（可选，使用默认 API 或自定义）
  apiService?: ApiService;

  // 回调函数
  onResultGenerated?: (results: GenerateResult[]) => void;
  onCopy?: (text: string) => void;

  // 样式
  className?: string;
  style?: React.CSSProperties;
}
