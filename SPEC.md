# 站点图标提取与下载 Chrome 插件 — 实现工作清单

## Context

项目已完成 WXT + Vue3 + TS 脚手架初始化（技术栈：WXT + Vue3 `<script setup>` + TypeScript + UnoCSS + @antfu/eslint-config + vitest + vueuse，包管理器 pnpm，Manifest V3 only）。本文件是把设计方案转成的可执行工程任务清单，按工程化思路把"受限页面判定 / 候选收集 / 去重 / 网络验证 / 尺寸测量 / 命名"六大块拆成职责单一、可独立单测的模块，保持 TS 严格模式与完整类型提示，并确认现有的 pre-commit TS 校验（lint-staged 已配置 `vue-tsc --noEmit`）在功能完成后依然生效。

**已确认的关键决策（来自需求确认，不要在后续会话中重新讨论变更）**：

1. 图标发现只使用当前站点自身资源（DOM link 标签、web manifest、常见 well-known 路径、`tab.favIconUrl`），**不引入任何第三方图标兜底服务**（如 Google S2）。
2. 下载保留图标原始格式，不做格式转换；文件名规则见下方"命名规则"。
3. 面板展示**所有**去重后的候选图标，各自独立可下载，不做"只保留最佳一个"的自动筛选。
4. manifest 权限最小化：只用 `activeTab` + `scripting` + `downloads`，不声明 `host_permissions`，不声明 `content_scripts`。
5. **已确认的执行顺序**：先实现全部 utils 核心模块，再统一集中补单元测试（非严格 TDD）。
6. 本轮跳过 `@wxt-dev/auto-icons`（插件工具栏图标生成），继续用脚手架自带占位图标；不影响核心的"网站 favicon 抓取"功能。

**关键设计判断（实现时直接采用，不再讨论变更）**：

1. **DOM 扫描脚本注入方式用 `files:` 而非 `func:`**。`defineUnlistedScript` 会被 WXT 编译成独立产物文件，`entrypoints/scan-dom-icons.ts` 通过 `browser.scripting.executeScript({ files: [...] })` 注入，这样可以正常 `import type` 共享 `utils/types.ts` 类型。脚本本身的实现风格约束是：不能依赖 background 闭包变量/运行时状态，只能读当前页面 DOM，不做任何网络请求（避免受页面 CSP `connect-src` 限制）。构建产物的实际文件名/路径必须在 `pnpm build` 和 `pnpm dev` 后分别用 `find`/`ls` 核实，不能凭猜测硬编码到 `files: [...]` 里。
2. **SVG 尺寸解析必须是纯文本正则解析**，不能用 `DOMParser`——`background.ts` 跑在 Service Worker 里没有 `document`/`DOMParser`。
3. **命名规则**：有尺寸时 `${domain}-${category}-${W}x${H}.${ext}`；无尺寸且来源是 `well-known` 时直接用猜测阶段记录的、已含扩展名的文件名（如 `favicon.ico`）拼成 `${domain}-favicon.ico`，**不再重复拼接扩展名**（避免 `well-known` 猜测列表里 `apple-touch-icon.png` 和 `apple-touch-icon-precomposed.png` 因退化成统一 label 而文件名冲突）；无尺寸且其他来源时 `${domain}-${category}.${ext}`。
4. 依赖版本一律用 `pnpm add <pkg>` 让 pnpm 自动解析最新稳定版，不硬编码具体版本号。
5. `chrome://`、扩展商店页、`file://` 未授权、PDF viewer 等场景下 content script 无法正常获取有效 DOM：预判命中已知模式或 `executeScript` 抛错 → 标记 `restricted: true`，UI 显示提示条，但仍展示基于 `tab.favIconUrl` 的兜底候选（若也为空则显示"未找到任何图标"，不报错崩溃）。`file://` 本身**不**在预判名单里（由 `executeScript` 实际抛错兜底，避免误判已授权的 file:// 场景）。

---

## 阶段 0：依赖与工具链补全

- 安装依赖：
  - `dependencies`：`@webext-core/messaging`、`@vueuse/core`
  - `devDependencies`：`unocss`、`@wxt-dev/unocss`、`vitest`、`@vue/test-utils`、`happy-dom`
  - 不需要单独装 `@webext-core/fake-browser`：`wxt` 已依赖它，测试里从 `wxt/testing/fake-browser` 导入 `fakeBrowser` 即可。
- `wxt.config.ts`：`modules` 加入 `@wxt-dev/unocss`；`manifest.permissions` 设为 `['activeTab', 'scripting', 'downloads']`，不声明 `host_permissions`、不声明 `content_scripts`。
- 新建 `uno.config.ts`（最小配置）。
- `entrypoints/popup/main.ts` 引入 UnoCSS 虚拟样式入口。
- 新建 `vitest.config.ts`，用 `wxt/testing/vitest-plugin` 的 `WxtVitest()` 插件 + `environment: 'happy-dom'`（自动注入路径别名，无需手配 `resolve.alias`）。
- `package.json` 新增脚本 `test: vitest run`、`test:watch: vitest`。
- 清理脚手架残留：删除 `entrypoints/content.ts`（默认模板，与本项目设计无关）、删除 `components/HelloWorld.vue`（`App.vue` 会在阶段5重写，届时一并去掉对它的引用）。
- **验证**：`pnpm install` 无报错 → `pnpm exec wxt prepare` 成功（刷新 `.wxt/eslint-auto-imports.mjs`）→ `pnpm compile` 通过 → `pnpm lint` 通过 → `pnpm dev` 能起服务，Chrome 加载 `.output/chrome-mv3-dev` 无 manifest 报错、能看到工具栏图标。

## 阶段 1：类型与消息协议基座

- 新建 `utils/types.ts`：`IconSourceCategory`、`IconCandidate`、`ScanResult`、`DownloadResult`、`DomScanResult` 等集中类型定义，全程避免 `any`。
- 新建 `utils/messaging.ts`：用 `@webext-core/messaging` 的 `defineExtensionMessaging<ProtocolMap>()` 定义消息协议：
  ```ts
  interface ProtocolMap {
    scanIcons: (data: { tabId: number }) => ScanResult
    downloadIcon: (data: { url: string, filename: string }) => DownloadResult
  }
  ```
  导出 `sendMessage`/`onMessage`。
- **验证**：`pnpm compile`、`pnpm lint` 通过（纯类型层，无运行时行为，不需要单测）。

## 阶段 2：DOM 扫描脚本

- 新建 `entrypoints/scan-dom-icons.ts`，用 `defineUnlistedScript()`，只读 DOM（`<link>` 用 `.href` 而非 `getAttribute` 以正确处理 `<base>`/相对路径），扫描 `rel` 为 `icon`/`shortcut icon`/`apple-touch-icon`/`apple-touch-icon-precomposed`/`mask-icon` 的所有 `<link>` 及 `rel="manifest"` 的 href，返回 `DomScanResult`。文件顶部注释说明其"独立上下文运行、不依赖外部闭包"的约束。
- **验证**：`pnpm build` 后 `find`/`ls` 核实 `.output/chrome-mv3/` 下该脚本实际编译产物的文件名/路径；`pnpm dev` 下再核实一次（dev/build 产物路径可能不同）。记录结果供阶段3使用。

## 阶段 3：图标发现与处理核心逻辑（模块拆分）

按单一职责拆分到 `utils/` 下（子目录 `utils/candidate-sources/` 收纳四个候选来源模块），逐个实现：

- `utils/restricted-pages.ts`：`checkRestrictedUrl(url)`，预判 `chrome://`/`edge://`/`about:`/`chrome-extension://`/`moz-extension://`/应用商店域名等。
- `utils/svg-size.ts`：`parseSvgSize(svgText)`，正则提取根 `<svg>` 的 `width`/`height`（剥离单位、拒绝百分比等非数值），缺失时退化解析 `viewBox` 第3/4个数值。
- `utils/image-size.ts`：`measureRasterSize(blob)`，`createImageBitmap` 测尺寸，用完 `close()`，失败返回 `undefined`。
- `utils/mime-sniff.ts`：`sniffMimeFromBytes(bytes)`，基于 magic bytes 识别 PNG/ICO/GIF/JPEG/WEBP，SVG 走文本判断，仅在响应头缺失/`octet-stream` 时调用。
- `utils/candidate-sources/dom-candidates.ts`：`buildDomCandidates(scan)`，DOM link 结果转 `source: 'link'` 候选。
- `utils/candidate-sources/manifest-candidates.ts`：`fetchManifestCandidates(manifestHref)`，`fetch` manifest JSON，`icons[]` 的 `src` 相对 **manifest 自身 URL**（非页面 URL）解析绝对地址，`sizes` 尽力解析宽高；try/catch 兜底，失败返回空数组。
- `utils/candidate-sources/well-known-candidates.ts`：`buildWellKnownCandidates(origin)`，内置路径列表（`/favicon.ico`、`/favicon.png`、`/favicon.svg`、`/apple-touch-icon.png`、`/apple-touch-icon-precomposed.png`），`sourceDetail` 记录去掉开头斜杠的文件名，供命名规则直接复用。
- `utils/candidate-sources/tab-favicon-candidate.ts`：`buildTabFavIconCandidate(favIconUrl)`，包装 `tab.favIconUrl` 为兜底候选。
- `utils/dedupe.ts`：`dedupeByAbsoluteUrl(candidates)`，按传入顺序（调用方保证 `link > manifest > well-known > tab` 优先级）用 `Map` 去重。
- `utils/candidate-probe.ts`：`probeCandidate(candidate, timeoutMs?)`，`AbortController` 超时 fetch → 验证存在性 → MIME 判定（优先响应头，缺失时嗅探）→ 按 MIME 分流到 SVG 文本解析或 raster `createImageBitmap` 测尺寸；全程 try/catch，失败返回 `undefined` 不抛出。
- `utils/icon-naming.ts`：`buildFilename(domain, candidate)`，按上方"命名规则"实现。
- `utils/icon-discovery.ts`（orchestrator）：`discoverIcons(tab)`，串联上述模块——受限判定 → 命中则返回 `restricted: true` + tab favicon 兜底 → 否则 `executeScript` 注入扫描（try/catch 兜底同样归为受限）→ 并行收集四类候选 → 按优先级 concat → 去重 → 并发 `probeCandidate` → 过滤失败项 → 返回 `ScanResult`。这是唯一的编排层，只做 if/串联调用，不含 fetch/DOM/正则细节。
- **验证**：每个模块写完 `pnpm compile` 确认类型；阶段3全部完成后手动跑一次 `discoverIcons`（可在阶段6单测里覆盖，不重复单独验证）。

## 阶段 4：`background.ts` 消息 handler 整合

**为什么放在 background 而非 content script/popup**：CORS 豁免只对扩展特权上下文生效，content script 请求仍以页面身份发出、受页面 CORS/CSP 约束；background 发出的请求在目标源被 `activeTab` 覆盖时可绕过 CORS。且 service worker 原生支持 `createImageBitmap(blob)` 测量图片尺寸，不需要 DOM。下载逻辑也必须放在 background 而非 popup 内 `<a download>`：popup 窗口很小、极易被用户误关闭，若下载逻辑跑在 popup JS 上下文里，关闭 popup 会中断进行中的异步下载；放在 background 则与 popup 是否还开着无关。

- 新建 `utils/downloads.ts`：`downloadIconFile(url, filename)`，调用 `browser.downloads.download`，try/catch 返回 `DownloadResult`。
- 重写 `entrypoints/background.ts`：`defineBackground` 内注册 `onMessage('scanIcons', ...)`（`browser.tabs.get` 拿 tab 后调用 `discoverIcons`）和 `onMessage('downloadIcon', ...)`（调用 `downloadIconFile`）。保持"薄"，不含业务逻辑。
- 把阶段2确认的 `files: [...]` 具体路径填入 `icon-discovery.ts` 里的 `executeScript` 调用。
- **验证**：`pnpm compile`、`pnpm lint` 通过 → `pnpm build`，Chrome 加载 `.output/chrome-mv3`，打开该扩展的 service worker DevTools，手动发送 `scanIcons`/`downloadIcon` 消息验证返回结构正确、不抛异常（第一次真正接触真实 tab/网络的验证点）。

## 阶段 5：popup UI

- 重写 `entrypoints/popup/App.vue`：`onMounted` 查询 active tab → `sendMessage('scanIcons', ...)` → 渲染 `StatusBanner` + `IconCard` 列表；不引入状态管理/路由，`ref` 足够（可选用 `@vueuse/core` 的 `useAsyncState` 简化 loading/error 状态，视代码量取舍）。
- 新建 `entrypoints/popup/components/StatusBanner.vue`：加载中 / 受限页面 / 空结果三态提示条，纯展示组件。
- 新建 `entrypoints/popup/components/IconCard.vue`：单个候选的缩略图（`<img>` 直接绑定候选 URL 展示不受 CORS 限制，只有 canvas 像素读取才受限）+ 来源/尺寸 badge + 下载按钮，点击调用 `sendMessage('downloadIcon', ...)`，文件名由 `App.vue` 统一算好 `domain` 后传入避免重复逻辑。
- 更新 `entrypoints/popup/main.ts`、视需要精简/删除 `style.css`（交给 UnoCSS）。
- **验证**：`pnpm compile`、`pnpm lint` 通过 → `pnpm dev`，Chrome 加载后在真实网站（如 github.com）打开 popup，确认 loading→渲染流程、缩略图加载、badge 数值正确。

## 阶段 6：单元测试（集中补齐）

逐个补 `*.test.ts`：

- `utils/dedupe.test.ts`：多来源同 URL 的优先级保留、无重复场景数量不变。
- `utils/icon-naming.test.ts`：有尺寸分支、无尺寸+well-known 分支（断言不重复拼接扩展名）、无尺寸+其他分支。
- `utils/svg-size.test.ts`：width/height 齐全、仅 viewBox、单位后缀、百分比/无效值、属性顺序与引号变体。
- `utils/icon-discovery.test.ts`：用 `wxt/testing/fake-browser` 的 `fakeBrowser` mock `browser.scripting.executeScript` 覆盖正常路径、抛错路径、URL 预判命中受限路径三种场景。
- `utils/restricted-pages.test.ts`：各已知前缀命中/不命中、空值不崩溃。
- `utils/mime-sniff.test.ts`：各 magic bytes 样本识别、无法识别返回 `undefined`。
- `utils/candidate-sources/manifest-candidates.test.ts`：mock `fetch` 覆盖合法 JSON（含相对 manifest URL 而非页面 URL 的解析验证）、非法 JSON、404 三种场景。
- 测试代码本身同样要满足 TS 严格模式、不使用 `as any` 糊弄 mock 数据。
- **验证**：`pnpm test` 全部通过；再跑一次 `pnpm compile` 确认测试文件未引入类型放宽。

## 阶段 7：端到端手动验证

- 本地运行：`pnpm dev` 加载扩展，确认 HMR 生效。
- 多站点场景：github.com（link+manifest 多尺寸、mask-icon SVG 走文本解析非误报 300x150、与 well-known 正确去重）；仅传统 favicon.ico 的老站点（well-known 兜底、文件名格式正确）；带 apple-touch-icon 的站点（尺寸通常 180x180）。
- 特殊页面降级：`chrome://extensions`、Chrome 网上应用店详情页、`file:///*.pdf`、关闭"允许访问文件网址"后的 `file://` 页面，逐一确认对应提示不崩溃。
- 下载功能：多候选下载后核对文件名规则、格式不被转码；下载触发后立即关闭 popup 确认下载仍完成（验证下载逻辑放在 background 的必要性）。
- `pnpm build` 生产模式下至少重复一遍"正常站点 + 受限页面"验证（dev/build 的 unlisted script 产物路径可能不同）。
- 收尾：`pnpm compile && pnpm lint && pnpm test` 全部通过后，实际执行一次真实 `git commit`，确认 husky pre-commit（`lint-staged` 跑 `eslint . --fix` + `vue-tsc --noEmit`）在本次全部新增/修改文件上正常触发并通过。

---

## 文件清单总览

| 阶段 | 新建/修改文件 |
|---|---|
| 0 | `wxt.config.ts`(改)、`uno.config.ts`(新)、`vitest.config.ts`(新)、`package.json`(改)、删 `entrypoints/content.ts`、删 `components/HelloWorld.vue` |
| 1 | `utils/types.ts`、`utils/messaging.ts` |
| 2 | `entrypoints/scan-dom-icons.ts` |
| 3 | `utils/restricted-pages.ts`、`utils/svg-size.ts`、`utils/image-size.ts`、`utils/mime-sniff.ts`、`utils/candidate-sources/*.ts`(4个)、`utils/dedupe.ts`、`utils/candidate-probe.ts`、`utils/icon-naming.ts`、`utils/icon-discovery.ts` |
| 4 | `utils/downloads.ts`、`entrypoints/background.ts`(改) |
| 5 | `entrypoints/popup/App.vue`(改)、`entrypoints/popup/components/StatusBanner.vue`、`entrypoints/popup/components/IconCard.vue`、`entrypoints/popup/main.ts`(改) |
| 6 | 对应阶段3各模块的 `*.test.ts`（约7个文件） |
| 7 | 无新文件，纯手动验证 |
