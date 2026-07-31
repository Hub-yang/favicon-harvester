# favicon-harvester

Chrome 插件（Manifest V3）：获取当前标签页站点的图标资源（favicon / apple-touch-icon / web manifest icon 等），
在多个可能的资源位置查找，去重后在面板中展示，支持逐个下载。

技术栈：[WXT](https://wxt.dev) + Vue 3（`<script setup>`）+ TypeScript + UnoCSS + Vitest。

## 功能特性

- **多来源图标发现**：DOM `<link>` 标签、web app manifest、常见 well-known 路径（`/favicon.ico` 等）、`tab.favIconUrl` 兜底，四路来源并行收集。
- **全量展示，不做自动筛选**：去重后的所有候选图标都会展示出来，各自独立可下载，不会替你"猜"哪个最好。
- **原始格式下载**：下载时保留图标本身的格式（PNG/SVG/ICO/JPEG/GIF/WEBP），不做任何转码。
- **最小权限设计**：manifest 仅声明 `activeTab` + `scripting` + `downloads`，不声明 `host_permissions`，不常驻访问任何网站。
- **不依赖第三方服务**：图标发现只使用目标站点自身暴露的资源，不接入 Google S2 等第三方图标兜底服务。

## 快速开始

```bash
pnpm install
pnpm dev
```

`pnpm dev` 启动后会自动打开一个装好扩展的 Chrome 实例。如果需要手动加载：

1. Chrome 地址栏打开 `chrome://extensions`，右上角开启「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择 `.output/chrome-mv3-dev`（生产构建对应 `.output/chrome-mv3`）。
3. 打开任意网站，点击工具栏里的插件图标即可看到扫描到的图标列表。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器（Chrome），支持 HMR |
| `pnpm dev:firefox` | 启动开发服务器（Firefox） |
| `pnpm build` | 生产构建，产物在 `.output/chrome-mv3` |
| `pnpm build:firefox` | 生产构建（Firefox） |
| `pnpm zip` / `pnpm zip:firefox` | 打包为可分发的 zip |
| `pnpm compile` | `vue-tsc --noEmit` 类型检查 |
| `pnpm lint` / `pnpm lint:fix` | ESLint 检查 / 自动修复 |
| `pnpm test` | 跑一次单元测试 |
| `pnpm test:watch` | 监听模式跑测试 |
| `pnpm test:coverage` | 跑测试并输出覆盖率报告 |

## 项目结构

```
entrypoints/
  background/       # MV3 service worker：接收消息、编排扫描与下载
  scan-dom-icons/   # 注入到页面里的只读 DOM 扫描脚本（unlisted script）
  popup/            # 弹出面板 UI（Vue3 组件 + 组合式函数）
utils/
  candidate-sources/  # 四类图标候选来源（link / manifest / well-known / tab）
  *.ts                # 去重、探测、尺寸测量、MIME 嗅探、命名、下载等核心逻辑
```

每个 `.ts`/`.vue` 模块都配有同名 `*.test.ts`，职责单一、可独立测试。

## 相关文档

- [PUBLISHING.md](./PUBLISHING.md)：Chrome 网上应用店首次提交上架、后续版本迭代发布、审核被打回的排查流程。
- [study.md](./study.md)：本项目的开发学习笔记，按知识主题整理（Manifest V3、WXT、消息传递、图标发现算法、测试策略等），适合复习或第一次接触 Chrome 插件开发时系统学习。

## 测试

单元测试用 [Vitest](https://vitest.dev) + `happy-dom` 环境，并通过 `wxt/testing/vitest-plugin` 的 `WxtVitest()` 插件在内存中模拟 `browser.*` 扩展 API（无需真实浏览器环境即可测试消息处理、`tabs`/`scripting`/`downloads` 调用）。

```bash
pnpm test           # 跑一次
pnpm test:coverage  # 附带覆盖率报告，阈值见 vitest.config.ts
```
