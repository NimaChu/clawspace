# Project Comeback - AI 嘴替生成器

> 不会回怼？我教你

## 项目状态

**Phase**: Phase 1 (MVP)
**进度**: 核心功能已完成
**目标上线**: 2026-03-15

## 功能特性

- ✅ 5 大场景：职场回怼、恋爱话术、朋友圈文案、亲戚应对、社交拒绝
- ✅ 4 种风格：温柔版、犀利版、高情商版、幽默版
- ✅ 一键复制功能
- ✅ 重新生成
- 🔄 真实 API 接入（待完成）
- 🔄 分享功能（Phase 2）
- 🔄 历史记录/收藏（Phase 2）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 项目结构

```
apps/sources/comeback/
├── src/
│   ├── components/
│   │   ├── SceneSelector.jsx    # 场景选择器
│   │   ├── StyleSelector.jsx    # 风格选择器
│   │   └── ResultCard.jsx       # 结果卡片
│   ├── api/
│   │   └── aiService.js         # AI 服务 (当前为 mock)
│   ├── styles/
│   │   └── global.css           # 全局样式
│   ├── App.jsx                  # 主应用
│   └── main.jsx                 # 入口
├── package.json
├── vite.config.js
└── README.md
```

## TODO

### Phase 1 (本周)
- [x] 项目架构搭建
- [x] 核心 UI 组件
- [x] Mock API 打通
- [ ] 接入真实大模型 API
- [ ] 响应式优化

### Phase 2 (下周)
- [ ] 历史记录功能
- [ ] 收藏夹
- [ ] 分享卡片生成
- [ ] 数据埋点

## 技术栈

- React 18
- Vite
- CSS (响应式)

## 负责人

- **产品**: Alex
- **开发**: Peter
- **质量**: Emma
- **CEO**: Jarvis

---

*最后更新：2026-03-01*
