# Comeback 嵌入式集成方案

> 将 comeback 从独立应用改造为可复用组件，支持嵌入到任意网站

## 📋 目标

将 comeback 改造成支持两种模式的项目：
1. **独立模式**（当前）：普通 SPA，独立运行
2. **嵌入模式**（新增）：导出 React 组件，供 embedder 调用

## 🏗️ 架构设计

### 1. 组件层级划分

```
Comeback 组件树
├── App（主应用，独立模式入口）
│   ├── SceneSelector（可复用）
│   ├── InputSection（可复用）
│   ├── StyleSelector（可复用）
│   └── ResultsDisplay（可复用）
│       └── ResultCard（可复用）
└── EmbedderApp（嵌入模式，导出组件）
    ├── EmbedderSceneSelector（定制版）
    ├── EmbedderInputSection
    ├── EmbedderStyleSelector
    └── EmbedderResultsDisplay
```

### 2. 重构策略

#### 阶段 A：提取可复用原子组件（无依赖）

```
src/components/base/
├── SceneTag.jsx        # 单个场景标签
├── StyleButton.jsx     # 单个风格按钮
└── ResultItem.jsx      # 单条结果卡片
```

#### 阶段 B：重构核心组件

```
src/components/
├── SceneSelector.jsx     # → 导出 SceneSelectorBlock
├── StyleSelector.jsx     # → 导出 StyleSelectorBlock
├── InputSection.jsx      # → 新建（整合 textarea）
├── ResultsDisplay.jsx    # → 新建（整合 results 容器）
└── ResultCard.jsx        # → 导出 ResultCard
```

#### 阶段 C：新增嵌入式组件

```
src/components/embedder/
├── EmbedderApp.jsx           # 主入口（嵌入模式）
├── EmbedderSceneSelector.jsx
├── EmbedderStyleSelector.jsx
├── EmbedderInputSection.jsx
└── EmbedderResultsDisplay.jsx
```

#### 阶段 D：新增入口点

```
src/
├── main.jsx                  # 独立模式入口
├── embedder-entry.jsx        # 嵌入模式入口（导出组件）
└── types.ts                  # TypeScript 类型定义
```

---

## 📦 导出组件 API

### EmbedderApp Props

```typescript
interface EmbedderAppProps {
  // 基础配置
  theme?: 'light' | 'dark' | 'auto';
  width?: string;
  height?: string;

  // 可选配置
  scenes?: string[];           // 自定义场景（默认 5 个）
  styles?: string[];           // 自定义风格（默认 4 种）
  defaultScene?: string;
  defaultStyle?: string;

  // API 服务
  apiService?: {
    generate: (params: GenerateParams) => Promise<GenerateResult[]>;
  };

  // 回调函数
  onResultGenerated?: (results: GenerateResult[]) => void;
  onCopy?: (text: string) => void;

  // 样式覆盖
  className?: string;
  style?: React.CSSProperties;
}
```

### 使用示例

```jsx
import { EmbedderApp } from 'comeback';

function MyWebsite() {
  const customApi = async ({ scene, inputText, style }) => {
    // 自定义 API 逻辑
    const response = await fetch('/api/comeback', {
      method: 'POST',
      body: JSON.stringify({ scene, inputText, style })
    });
    return await response.json();
  };

  return (
    <div className="my-app">
      <h1>我的网站</h1>

      {/* 嵌入 comeback 组件 */}
      <EmbedderApp
        width="100%"
        height="auto"
        defaultScene="职场回怼"
        defaultStyle="高情商版"
        apiService={{ generate: customApi }}
        onResultGenerated={(results) => console.log('生成完成', results)}
      />
    </div>
  );
}
```

---

## 🔄 向后兼容

- 保留 `main.jsx` 作为独立模式入口
- 旧的 `index.html` 不修改
- 通过 `npm run dev` 依然运行独立版本

---

## 📦 构建输出

### 独立模式（当前）
```bash
npm run build
# 输出: dist/index.html + dist/assets/
# 用途: 独立部署到 Vercel/Netlify
```

### 嵌入模式（新增）
```bash
npm run build:embedder
# 输出: lib/embedder.js + lib/embedder.css
# 用途: npm 包发布，或直接 import 使用
```

---

## 🚀 实施步骤

### Week 1: 基础重构
- [ ] 提取原子组件（Stage A）
- [ ] 重构核心组件（Stage B）
- [ ] 添加类型定义

### Week 2: 嵌入模式
- [ ] 实现嵌入式组件（Stage C）
- [ ] 新增入口点（Stage D）
- [ ] 构建配置更新

### Week 3: 测试与文档
- [ ] 单元测试
- [ ] 文档更新
- [ ] 集成测试（nima-app-embedder）

---

## ⚠️ 注意事项

1. **样式隔离**：嵌入模式使用 CSS Modules 或 CSS-in-JS
2. **API 绑定**：避免硬编码 API URL，支持自定义
3. **主题适配**：支持 light/dark 主题自动切换
4. **性能优化**：使用 React.memo 避免不必要的重渲染

---

*文档版本*: v1.0
*创建日期*: 2026-03-14
*负责人*: Steve
