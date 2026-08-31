<h1 align="center">图标提取器</h1>

<p align="center">把一个网站正在用的图标，全都挖出来。</p>

<p align="center">
  <a href="https://github.com/Hub-yang/favicon-harvester/releases"><img src="https://img.shields.io/github/v/release/Hub-yang/favicon-harvester?style=flat-square&color=1f6feb" alt="Release"></a>
  <a href="https://github.com/Hub-yang/favicon-harvester/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/Hub-yang/favicon-harvester/release.yml?style=flat-square" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/Hub-yang/favicon-harvester?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/manifest-v3-brightgreen?style=flat-square" alt="Manifest V3">
</p>

<p align="center">简体中文 | <a href="./README.en.md">English</a></p>

<!-- 截图待补：在 github.com 这类图标丰富的站点上打开面板截一张，放到 docs/screenshot.png 后启用下面这行
<p align="center"><img src="./docs/screenshot.png" width="320" alt="面板截图"></p>
-->

## 这插件解决什么问题

想拿到某个网站的图标，通常得这么干：F12 打开 Elements，在 `<head>` 里翻 `<link rel="icon">`；翻不到就去猜 `/favicon.ico`；想要大尺寸的还得顺着 `<link rel="manifest">` 找到它的 Web App Manifest，再从 JSON 里一个个把 URL 抠出来。

抠完也不一定能用——有些地址是历史遗留的死链，请求得通，图却是坏的。

这插件把这套流程压成一次点击。

## 特性

- **四路并行发现**。页面的 `<link>` 标签、Web App Manifest、`/favicon.ico` 这类约定俗成的路径、以及浏览器自己缓存的 `tab.favIconUrl`，四个来源同时探。
- **只给活的**。候选先在后台发请求确认可达，再在面板里用 `<img>` 真渲染一遍，两关都过了才会出现在列表上。那种"请求通了但图是裂的"会被挡在外面。
- **全都给你，不替你挑**。去重后的候选一个不少地列出来，按尺寸从大到小排，SVG 排最前。哪个最合用由你判断，插件不猜。
- **原样下载**。下载的就是网站上那个文件本身，不转码、不压缩、不改尺寸。文件名按 `域名-来源-尺寸.扩展名` 自动生成，一次点击也能把找到的全部拿走。
- **只碰当前这一个标签页**。manifest 里只声明了 `activeTab`、`scripting`、`downloads` 三个权限，没有 `host_permissions`。不点插件图标，它一行代码都不会跑。
- **不连第三方**。所有图标地址都来自网站自己，不经过 Google S2 之类的兜底服务。你查了哪个网站，只有你自己知道。

## 安装

### 从 Release 装

1. 到 [Releases](https://github.com/Hub-yang/favicon-harvester/releases) 下载最新的 `favicon-harvester-x.y.z-chrome.zip` 并解压。
2. 打开 `chrome://extensions`，右上角开启「开发者模式」。
3. 点「加载已解压的扩展程序」，选中刚解压出来的文件夹。

### 从源码构建

```bash
pnpm install
pnpm build      # 产物在 .output/chrome-mv3
```

然后按上面第 2、3 步加载 `.output/chrome-mv3`。开发调试用 `pnpm dev`，它会自动开一个装好扩展的 Chrome 实例，改代码即时热更新。

## 用法

打开任意网页 → 点工具栏上的插件图标 → 面板里挑图标，单个下载或一次全部下载，也可以只复制某个图标的地址。

## 它是怎么找图标的

点击图标后，background 同时从四个地方收集候选：

| 来源 | 拿什么 |
| --- | --- |
| `link` | 往页面注入一段只读脚本，读 `<head>` 里所有 `<link rel="icon">`、`apple-touch-icon` 等标签的 `href` 与 `sizes` |
| `manifest` | 顺着 `<link rel="manifest">` 拉取 Web App Manifest，解析里面的 `icons[]` |
| `well-known` | 直接试 `/favicon.ico`、`/apple-touch-icon.png` 这几个约定路径 |
| `tab` | 浏览器已经拿到的 `tab.favIconUrl`，前三路都空手而归时的兜底 |

四路结果按绝对 URL 去重（同一地址保留优先级更高的来源：link > manifest > well-known > tab），然后逐个发请求确认可达，顺便从响应头或文件魔数判断真实格式、解析出宽高。SVG 走正则解析根标签尺寸而不是 DOMParser——这段代码最终跑在没有 `document` 的 service worker 里。

到这一步还不够。后台的 fetch 探测通过，不代表 popup 里的 `<img>` 能把图渲染出来：两者请求上下文不同，`<img>` 会带 Referer，可能正好撞上目标站的防盗链。所以候选送进面板后还会再做一次真实渲染验证，裂掉的当场剔除。

## 已知边界

- `chrome://`、Chrome 应用商店等受限页面扫不了。插件会明说，不会让你对着转圈等。
- 只认网站自己声明的图标。一个站点既没有 `<link>`、没有 manifest、连 `/favicon.ico` 都没有的话，那就是真找不到——插件不会去第三方服务替它编一个出来。
- 不做格式转换。想要 PNG 版的 SVG 图标，得自己动手。

## 开发

技术栈是 [WXT](https://wxt.dev) + Vue 3 `<script setup>` + TypeScript + UnoCSS + Vitest。

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发模式（Chrome），带热更新 |
| `pnpm dev:firefox` | 开发模式（Firefox） |
| `pnpm build` | 生产构建，产物在 `.output/chrome-mv3` |
| `pnpm zip` | 打包成可分发的 zip |
| `pnpm compile` | `vue-tsc --noEmit` 类型检查 |
| `pnpm lint` / `pnpm lint:fix` | ESLint 检查 / 自动修复 |
| `pnpm test` / `pnpm test:coverage` | 单元测试 / 带覆盖率 |
| `pnpm release` | 升版本号、打标签并推送，剩下的交给 CI |

目录结构：

```
entrypoints/
  background/       MV3 service worker，编排扫描与下载
  scan-dom-icons/   注入页面的只读 DOM 扫描脚本
  popup/            面板 UI（组件 + 组合式函数）
utils/
  candidate-sources/  四类来源各自的候选收集逻辑
  *.ts                去重、探测、尺寸测量、MIME 嗅探、命名、排序、下载
```

每个模块都配了同名 `*.test.ts`，共 154 个用例。测试跑在 `happy-dom` 里，靠 `wxt/testing` 的 `WxtVitest()` 在内存中模拟 `browser.*` API，不需要真实浏览器。

发布到 Chrome 网上应用店的完整流程见 [PUBLISHING.md](./PUBLISHING.md)。

## License

[MIT](./LICENSE) © Hubery Yang
