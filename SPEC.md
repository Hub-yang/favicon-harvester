# 站点图标提取与下载 Chrome 插件 — 设计方案

## 背景

在浏览器工具栏面板中展示当前标签页所在网站的"站点图标"（favicon/apple-touch-icon/PWA manifest icon 等），
尽量在多个可能的资源位置查找，找到的都去重展示并提供下载。项目从 0 新建，无历史代码兼容负担。

已确认的关键决策：
1. **技术栈**：WXT 框架（wxt.dev）+ Vue3（`<script setup>`），接入 vite（WXT 自带）+ unocss + ts +
   @antfu/eslint-config + vitest + vueuse，包管理器 pnpm。WXT 目前是社区里 MV3 支持最成熟、更新最活跃的
   扩展框架，默认生成 Manifest V3。
2. **必须是 Manifest V3**，不做 MV2 兼容。
3. **图标发现范围**：只使用当前站点自身能找到的资源，**不允许**调用任何第三方图标服务（如 Google S2）兜底，
   找不到就如实展示"未找到"。
4. **下载策略**：保留图标原始格式（.ico/.png/.svg 等）下载，不做格式转换；文件名规范为
   「域名-来源-尺寸.扩展名」（如 `github.com-manifest-192x192.png`，尺寸未知时用来源标识代替，
   如 `github.com-favicon.ico`）。
5. **展示方式**：面板中列出所有去重后的候选图标（标注来源和尺寸），每个都有独立下载按钮，
   不做"只展示最佳一个"的自动筛选。

## 项目初始化

```bash
pnpm dlx wxt@latest init favicon-harvester -t vue --pm pnpm
cd favicon-harvester
pnpm add @webext-core/messaging @vueuse/core
pnpm add -D unocss @wxt-dev/unocss @wxt-dev/auto-icons vitest @vue/test-utils happy-dom eslint @antfu/eslint-config
```

- `wxt init -t vue` 是 WXT 官方脚手架，直接生成 `<script setup>` 风格的 Vue3+TS 项目骨架，不需要手搓 vite 插件。
- `@wxt-dev/unocss` 在 `wxt.config.ts` 的 `modules` 数组里注册即可接入 UnoCSS。
- `@wxt-dev/auto-icons`（可选）：放一张高分辨率主图到 `public/icon.png`，自动生成插件自身工具栏图标各尺寸，
  写入 manifest 的 `icons` 字段——这是插件自己的图标，与本插件要抓取的"网站 favicon"是两回事。
- ESLint（antfu flat config）：`package.json` 加 `"postinstall": "wxt prepare"`，`eslint.config.mjs` 中
  `import` 并 `.append()` `.wxt/eslint-auto-imports.mjs`（跑过一次 `wxt prepare` 后才会生成），避免 WXT
  自动导入的全局标识符（`browser`、`defineBackground` 等）被误报为 `no-undef`。
- vitest：用 WXT 官方插件 `wxt/testing/vitest-plugin` 的 `WxtVitest()`，自动注入路径别名和
  `@webext-core/fake-browser` 提供的内存版 `browser.*` mock，不需要手写 chrome mock。

## 目录结构

```
favicon-harvester/
├── wxt.config.ts
├── uno.config.ts
├── eslint.config.mjs
├── vitest.config.ts
├── public/icon.png
├── entrypoints/
│   ├── background.ts          # 唯一的网络探测/去重/尺寸测量/下载中枢
│   ├── scan-dom-icons.ts       # defineUnlistedScript：按需注入的 DOM 扫描脚本
│   └── popup/
│       ├── index.html
│       ├── main.ts
│       ├── App.vue
│       └── components/
│           ├── StatusBanner.vue   # 加载中 / 受限页面 / 空结果 提示条
│           └── IconCard.vue       # 单个候选图标：缩略图 + 来源/尺寸标签 + 下载按钮
└── utils/                     # 各入口共享，WXT 自动导入
    ├── types.ts               # IconCandidate / ScanResult / 消息协议类型
    ├── messaging.ts           # defineExtensionMessaging<ProtocolMap>()
    └── icon-naming.ts         # 文件名生成规则
```

WXT 按 `entrypoints/` 下文件名/文件夹名决定入口类型。`scan-dom-icons.ts` 用 `defineUnlistedScript()` 定义
而**不**命名为会被识别成 content script 的模式，因此不会被写入 manifest 的 `content_scripts`，完全靠
`chrome.scripting.executeScript` 按需注入——这是权限最小化的关键。

## manifest 权限设计

```ts
// wxt.config.ts
export default defineConfig({
  modules: ['@wxt-dev/unocss', '@wxt-dev/auto-icons'],
  manifest: {
    permissions: ['activeTab', 'scripting', 'downloads'],
    // 不声明 host_permissions，也不声明任何 content_scripts.matches
  },
})
```

- `activeTab`：用户点击工具栏图标打开 popup 就是合法触发手势，会临时授予当前 tab 源的 host 权限
  （扩展任意上下文可用），同时解锁 `tab.favIconUrl` 读取和 `scripting.executeScript` 注入权限。
- `scripting` / `downloads`：分别是 `executeScript` 和 `downloads.download` 的前提权限。
- **不声明 `host_permissions`**（不用 `<all_urls>`）：所有网络探测都限定在"当前 tab 同源路径"，
  `activeTab` 授予的临时权限已覆盖，且能让 background 的 `fetch()` 绕过 CORS。代价是如果图标托管在
  不同源 CDN 上会探测失败——静默跳过该候选即可，不影响其余候选，这也符合"只用当前站点自身资源"的
  需求边界。安装时的权限提示也会小得多。

## 核心逻辑

### DOM 扫描（`scan-dom-icons.ts`）

只读 DOM，不做网络请求（避免受页面 CSP `connect-src` 限制）。用 `<link>` 元素的 `.href`
（而非 `getAttribute('href')`）取值，让浏览器自动处理 `<base>` 标签和相对路径解析。扫描 `rel` 为
`icon`/`shortcut icon`/`apple-touch-icon`/`apple-touch-icon-precomposed`/`mask-icon` 的所有
`<link>`，以及 `rel="manifest"` 的 href。因为 `executeScript` 的 `func` 需要可序列化，脚本必须是
不依赖外部闭包的纯函数。

### 网络探测与业务中枢（`background.ts`）

**为什么放在 background 而非 content script/popup**：CORS 豁免只对扩展特权上下文生效，content script
请求仍以页面身份发出、受页面 CORS/CSP 约束；background 发出的请求在目标源被 `activeTab` 覆盖时可绕过
CORS。且 service worker 原生支持 `createImageBitmap(blob)` 测量图片尺寸，不需要 DOM。

处理流程：
1. 收到 `scanIcons` 消息 → 先用已知模式（`chrome://`、`edge://`、`chrome-extension://`、应用商店域名等）
   预判是否受限页面；
2. 否则 `browser.scripting.executeScript` 注入扫描脚本，**用 try/catch 兜底**所有注入失败场景
   （file:// 未授权、企业策略锁定页等）统一归类为"受限"；
3. 汇总候选来源：DOM link 标签 + manifest.json 的 `icons[]`（相对 manifest 自身 URL 解析）+ 站点根目录
   常见路径猜测（`/favicon.ico`、`/favicon.png`、`/favicon.svg`、`/apple-touch-icon.png`、
   `/apple-touch-icon-precomposed.png`）+ `tab.favIconUrl` 兜底；
4. 按"最终解析后的绝对 URL"去重（优先级 link > manifest > well-known > tab）；
5. 并发 `fetch` 验证候选存在性（`Promise.allSettled` 容错，逐个超时），测真实 MIME 和尺寸：
   PNG/ICO 用 `createImageBitmap`；SVG 单独走文本解析根 `<svg>` 的 `width`/`height` 或 `viewBox`
   （避免 `createImageBitmap` 对无固定尺寸 SVG 返回误导性的默认 300×150）；MIME 判断优先信任
   `content-type` 响应头，缺失/`application/octet-stream` 时退化用文件头 magic bytes 嗅探；
6. 返回候选列表给 popup。

下载走 `downloadIcon` 消息，background 内调用 `chrome.downloads.download({ url, filename })`。
**下载逻辑必须放在 background 而非 popup 内 `<a download>`**：popup 窗口很小、极易被用户误关闭，
若下载逻辑跑在 popup JS 上下文里，关闭 popup 会中断进行中的异步下载；放在 background 则与 popup
是否还开着无关。`filename` 参数也能直接落地"域名-来源-尺寸.扩展名"命名规则,不需要先转 object URL。

### 消息协议（`utils/messaging.ts` + `types.ts`）

用 `@webext-core/messaging` 的 `defineExtensionMessaging<ProtocolMap>()`，双端共享类型：

```ts
interface ProtocolMap {
  scanIcons: (data: { tabId: number }) => ScanResult
  downloadIcon: (data: { url: string, filename: string }) => { success: boolean, downloadId?: number, error?: string }
}
```

### 命名规则（`utils/icon-naming.ts`）

有尺寸时用 `域名-来源-WxH.扩展名`；无尺寸时用 `域名-来源标识.扩展名`。well-known 路径类来源建议记录成
`well-known:favicon.ico` 这种"来源:文件名"复合值（而非笼统的 `well-known`），这样能直接产出
`github.com-favicon.ico` 这类符合需求示例的文件名，不需要额外特判分支。

### popup（Vue3 展示层）

`App.vue` 在 `onMounted` 里查询当前 active tab → `sendMessage('scanIcons', ...)` → 渲染
`StatusBanner`（loading / 受限提示 / 空结果）+ `IconCard` 列表（每张卡片：`<img>` 缩略图、
来源/尺寸 badge、下载按钮，点击触发 `sendMessage('downloadIcon', ...)`）。`<img>` 直接绑定候选
URL 展示不受 CORS 限制（只有 canvas 像素读取才受限）。不引入状态管理库/路由，`ref`+`onMounted`
足够，只需 `App.vue` + `StatusBanner.vue` + `IconCard.vue` 三个组件。

### 特殊页面降级

`chrome://`、扩展商店页、`file://` 未授权、PDF viewer 等场景下 content script 无法正常获取有效 DOM：
- 预判命中已知模式或 `executeScript` 抛错 → 标记 `restricted: true`，UI 显示提示条，但仍展示基于
  `tab.favIconUrl` 的兜底候选（若也为空则显示"未找到任何图标"，不报错崩溃）。
- PDF viewer 一般不会抛错但 DOM 内没有 `<link>` 标签 → 属于"扫描成功但零候选"，与"受限"是两种不同的
  降级路径，均需在 UI 上给出对应提示。

## 验证方式

1. **本地运行**：`pnpm install && pnpm dev`，Chrome 打开 `chrome://extensions` → 开发者模式 →
   加载已解压的扩展程序 → 选择 `.output/chrome-mv3-dev`（`wxt dev` 自动构建并支持 HMR）。
2. **构建产物路径核对**：`pnpm build` 后检查 `.output` 目录，确认 `scan-dom-icons.ts` 编译后的实际
   输出文件名/路径，据此校正 `background.ts` 里 `executeScript({ files: [...] })` 的路径字符串——
   这是唯一需要运行时确认的细节。
3. **多站点场景覆盖**：
   - 现代站点（github.com 等）：验证 `link:icon` + `manifest` 多尺寸图标齐全，且与 well-known 猜测
     正确去重；github.com 还带 `mask-icon`（SVG），验证走文本解析分支而非误报 300×150。
   - 仅有传统 favicon.ico、无 manifest 的老站点：验证 well-known 兜底路径生效。
   - 带 apple-touch-icon 的站点：验证对应 rel 被抓取、尺寸测量准确（通常 180×180）。
4. **特殊页面降级验证**：分别打开 `chrome://extensions`、Chrome 网上应用店详情页、本地
   `file:///*.pdf`（在自带 PDF viewer 中）、关闭"允许访问文件网址"后的 `file://` 页面，逐一确认
   对应降级分支和 UI 提示符合预期。
5. **下载功能验证**：对多个候选点下载，检查系统下载目录里文件名是否严格符合命名规则、格式是否
   原样保留（.ico 不被转码）；点击下载后立即让 popup 失焦关闭，确认下载仍能完成（验证下载放在
   background 的必要性）。
6. **单元测试**（vitest + `@webext-core/fake-browser`）：`dedupeByAbsoluteUrl` 去重优先级、
   `buildFilename` 各分支、SVG 尺寸解析、`scanIcons` handler 在"正常"和"executeScript 抛错"两种
   路径下的行为。

## 关键文件

- `favicon-harvester/wxt.config.ts`
- `favicon-harvester/entrypoints/background.ts`
- `favicon-harvester/entrypoints/scan-dom-icons.ts`
- `favicon-harvester/entrypoints/popup/App.vue`
- `favicon-harvester/utils/types.ts`
