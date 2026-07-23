# favicon-harvester

Chrome 插件（Manifest V3）：获取当前标签页站点的图标资源（favicon / apple-touch-icon / web manifest icon 等），
在多个可能的资源位置查找，去重后在面板中展示，支持逐个下载。

技术栈：[WXT](https://wxt.dev) + Vue 3（`<script setup>`）+ TypeScript + UnoCSS + Vitest。详细设计方案见 [SPEC.md](./SPEC.md)。

## 开发

```bash
pnpm install
pnpm dev      # 启动开发服务器，自动打开 Chrome 加载扩展
pnpm build    # 生产构建，产物在 .output/chrome-mv3
pnpm test     # 跑单元测试
pnpm compile  # vue-tsc 类型检查
pnpm lint     # eslint 检查
```

## 开发知识笔记

> 本项目是第一次做 Chrome 插件开发，边实现边把过程中理解的关键知识点记在这里，作为学习记录。会随着 SPEC.md 里各阶段的推进持续追加小节。

### 阶段 0：WXT 工具链

- **`wxt.config.ts` 的 `modules` 是什么**：WXT 的 module 机制类似 Vite 插件的一层封装，专门用来给"WXT 项目"这个场景扩展构建行为。`modules` 数组里的每一项（如 `@wxt-dev/module-vue`、`@wxt-dev/unocss`）在 `pnpm dev` / `pnpm build` 时会往 WXT 内部的 Vite 配置里注入对应的插件、别名或全局类型声明，而不需要自己手写 `vite.config.ts`。
- **UnoCSS 是怎么接入的**：`@wxt-dev/unocss` 模块本身不解析样式规则，它只是把 UnoCSS 官方的 Vite 插件挂到 WXT 的构建钩子上（`vite:devServer:extendConfig` / `vite:build:extendConfig`）。真正的规则配置走 UnoCSS 自己的约定——项目根目录放一个 `uno.config.ts`，UnoCSS 的 Vite 插件会自动发现并加载它，不需要在 `wxt.config.ts` 里手动指定路径。入口文件里 `import 'virtual:uno.css'` 引入的是一个"虚拟模块"：这个文件在磁盘上并不存在，是 Vite/UnoCSS 在构建时按当前项目里实际用到的 class 动态生成的 CSS 内容。开发模式下浏览器控制台可能会看到一次关于 `uno.css` 找不到的警告，可以忽略，生产构建会正常生成对应的 CSS 文件（本次 `pnpm build` 验证时确认产物里出现了 `assets/popup-*.css`）。
- **`manifest.permissions` 是"声明式"的最小权限**：MV3 要求扩展在 `manifest.json` 里显式声明要用到的能力（这里是 `activeTab` + `scripting` + `downloads`），Chrome 会在用户点击扩展图标那一刻才把 `activeTab` 权限临时授予当前标签页，而不是一直持有对所有网站的访问权——这也是为什么本项目特意不声明 `host_permissions`：不需要"随时能访问任意网站"，只需要"用户主动点开插件时能读当前这一个标签页"。
- **dev 模式的 manifest 和生产构建不完全一样**：`pnpm dev` 生成的 `manifest.json` 里会多出 `tabs` 权限和 `host_permissions: ["http://localhost/*"]`，这是 WXT 开发服务器为了实现 HMR（往扩展页面推送热更新）额外注入的，只存在于 `.output/chrome-mv3-dev`；`pnpm build` 生成的 `.output/chrome-mv3/manifest.json` 才是干净的、只含我们自己声明的三个权限，实测已确认。以后凡是要核对"权限是不是最小化"，都应该看 `pnpm build` 的产物，而不是 dev 产物。
- **Vitest 怎么"看懂"扩展 API**：普通单测环境里没有 `browser.tabs`、`browser.runtime` 这些浏览器扩展全局对象。`vitest.config.ts` 里用的 `WxtVitest()`（来自 `wxt/testing/vitest-plugin`）是一个 Vite 插件，作用是：读取项目的 `wxt.config.ts`，用 `@webext-core/fake-browser` 提供一份内存里的扩展 API 模拟实现（后续测试里可以直接 `import { fakeBrowser } from 'wxt/testing/fake-browser'` 来 mock/断言调用），同时把 `@/*` 这类路径别名也配置好，所以不需要在 `vitest.config.ts` 里手写 `resolve.alias`。
