# 上线操作指南

本文档记录「图标提取器」提交 Chrome 网上应用店审核的完整操作流程，分三部分：**首次提交上架**、**后续版本迭代发布**、**审核被打回怎么办**。前置代码质量/安全/manifest 合规审查已完成（见 git log 中「上线前最后一次 code review」相关提交），本文档只覆盖店铺列表侧的操作。

已确认的前提：已有 Chrome Web Store 开发者账号；仓库 `Hub-yang/favicon-harvester` 保持 **private**（不改可见性）；隐私政策改用公开 GitHub Gist 承载；商店列表只做中文（zh-CN）。

---

## 第一部分：首次提交上架

### 1.1 准备隐私政策页面（公开 Gist）

Chrome 商店「隐私声明」页要求填一个可公开访问的隐私政策 URL。仓库保持 private，所以用一个**公开 Gist**单独承载，文件名 `PRIVACY.md`，内容如下（Gist 具体创建操作是一次性动作，不写在这份长期维护的发版流程文档里）：

```markdown
# 图标提取器（Favicon Harvester）隐私政策

本插件不收集、不存储、不上传任何用户数据。

- 插件仅在你主动点击工具栏图标时运行，不会在后台持续监听或收集你的浏览数据。
- 插件仅读取当前标签页的 URL，以及页面 `<head>` 中与图标相关的公开标签信息（如 `<link rel="icon">`），用于发现该网站的图标资源。
- 插件会向当前网站自身域名下的图标地址发起请求（获取图标文件与 web manifest），不会将任何信息发送到该网站之外的第三方服务器，不接入任何第三方图标兜底服务。
- 插件不集成任何分析、统计或广告 SDK，不包含任何形式的用户跟踪。
- 下载到本地的图标文件只保存在你自己的设备上，插件开发者无法访问。

如有疑问，请通过 `18830279823@163.com` 联系。
```

创建时**必须选择 public gist**（不能是 secret gist，否则审核方可能判定链接不可公开访问）。创建后得到的 Gist URL 就是 1.4 节步骤 5 要填的隐私政策 URL。

### 1.2 商店列表文案（可直接抄用的草稿）

**应用名称**：图标提取器

**简短描述**（132 字符以内，列表页展示）：

```
获取当前网站的 favicon、apple-touch-icon、manifest 图标等资源，去重后逐个下载，不依赖第三方服务。
```

**详细描述**（Store listing 详情页正文）：

```
图标提取器是一款轻量级 Chrome 插件，帮你快速获取当前网站的图标资源。

功能：
· 自动扫描当前标签页站点的图标资源：页面 <link> 标签声明的 favicon / apple-touch-icon、Web App Manifest 里的图标、常见的 well-known 路径（如 /favicon.ico）、以及浏览器自带的标签页图标，四路来源并行收集。
· 去重后完整展示所有找到的候选图标，逐个预览、逐个下载，不会替你自动挑选"最好"的一个。
· 下载时保留图标原始格式（PNG / SVG / ICO / JPEG / GIF / WEBP），不做任何转码。
· 仅使用当前网站自身暴露的资源，不依赖任何第三方图标兜底服务，不收集、不上传你的任何数据。

适合谁用：需要给网站找 favicon 参考的开发者/设计师，或想导出某个网站全部尺寸图标的用户。
```

**单一用途说明**（Privacy practices 标签页「Single purpose description」字段）：

```
提取并下载当前网站的图标资源（favicon、apple-touch-icon、web manifest 图标等）。
```

**权限用途说明**（Privacy practices 标签页，每个权限单独一个文本框）：

| 权限 | 用途说明草稿 |
|---|---|
| `activeTab` | 用于在用户主动点击插件图标时读取当前标签页的 URL，作为图标扫描目标页面并计算下载文件名里的域名前缀。不会在后台持续访问任何标签页。 |
| `scripting` | 用于在用户点击插件图标时，向当前页面注入一个只读脚本，读取页面 `<head>` 中 `<link rel="icon">` 等标签的地址，以发现该网站声明的图标资源。脚本不修改页面内容、不执行页面中的任何代码、不读取图标信息之外的其他数据。 |
| `downloads` | 用于把用户在插件面板里选中的图标文件保存到本地下载目录，这是插件的核心功能（下载图标）。 |

**数据使用声明**（Privacy practices 标签页会问"是否收集用户数据"，逐项勾选）：

- 是否收集个人信息 / 财务信息 / 健康信息 / 认证信息 / 个人通讯 / 位置 / 网页浏览记录 / 用户活动 / 网站内容：**全部选"否"**。
- "我没有出售或转让用户数据给第三方"、"我没有将用户数据用于与其核心功能无关的用途"、"我没有将用户数据用于确定信用资格或放贷"：**全部勾选确认**。

**分类（Category）**：建议选 "Productivity"（生产力工具）或 "Developer Tools"，二选一，凭你判断哪个更贴近实际使用场景。

**语言**：仅添加中文（简体）。

### 1.3 图形素材

- **应用图标**：已由 `@wxt-dev/auto-icons` 自动生成（`assets/icon.svg` → 16/32/48/128px），无需额外准备。
- **截图**（必填，至少 1 张，最多 5 张，尺寸 1280×800 或 640×400 PNG/JPEG）：建议截以下场景，本次未实际截图，需要你自己操作：
  1. 在一个图标资源丰富的网站（如 github.com）打开插件面板，展示多个候选图标的效果。
  2. 可选：受限页面（如 `chrome://extensions`）的提示条效果，展示插件的降级处理。
- **小型宣传图块（Small promo tile，440×280）**：可选，不填不影响审核通过，暂时可跳过。
- **Marquee 宣传图（1400×560）**：可选，只有参加 Chrome 商店推荐位才需要，跳过。

### 1.4 提交审核操作步骤

1. 打包最新版本（如果 `.output/` 下没有最新 zip，先跑一遍）：
   ```bash
   pnpm build
   pnpm zip
   ```
   产物在 `.output/favicon-harvester-<version>-chrome.zip`。
2. 打开 [Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole)。
3. 点击「新增项目」，上传 `.output/favicon-harvester-<version>-chrome.zip`。
4. 进入「Store listing」标签页，填入 1.2 节的应用名称/描述/分类/语言，上传 1.3 节的截图。
5. 进入「Privacy practices」标签页：
   - 填入 1.2 节的单一用途说明。
   - 三个权限（`activeTab`/`scripting`/`downloads`）分别粘贴对应的用途说明。
   - 数据使用声明按 1.2 节逐项勾选。
   - 填入 1.1 节生成的 Gist 隐私政策 URL。
6. 进入「Distribution」标签页：
   - 可见性选 **Public**（商店listing 公开，跟代码仓库是否 private 无关）。
   - 地区选「所有地区」或按需勾选。
   - 定价选「免费」。
7. 检查页面顶部/底部是否还有未完成项的红色提示，全部清空后点击「提交审核」。
8. 提交后一般 **数小时到数个工作日**内会收到审核结果邮件（首次提交的新账号/新插件有时会更久，属于正常范围）。

---

## 第二部分：后续版本迭代发布流程

每次改完代码、要发新版本时，按下面顺序操作：

1. 确认所有改动已提交（`git status` 干净）。
2. 更新版本号：编辑 `package.json` 的 `version` 字段（遵循语义化版本，纯 bug 修复升 patch，如 `0.1.0` → `0.1.1`；新功能升 minor；破坏性变更升 major）。
3. 跑完整验证（同上线前 review 的验收标准）：
   ```bash
   pnpm compile
   pnpm test
   pnpm lint
   ```
4. 生产构建并打包：
   ```bash
   pnpm build
   pnpm zip
   ```
5. 提交版本号改动：
   ```bash
   git add package.json
   git commit -m "chore: 发布 v<新版本号>"
   git push
   ```
6. 打开 [Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole)，进入已发布的「图标提取器」项目。
7. 「Package」标签页上传新的 zip 包（Chrome 会自动识别 `manifest.json` 里的 `version` 已递增）。
8. 如果这次改动涉及新权限/新的数据处理方式，同步更新「Privacy practices」标签页对应内容；否则跳过，直接提交。
9. 点击「提交审核」。更新审核通常比首次提交快。

---

## 第三部分：审核被打回怎么办

Chrome 审核团队打回后会在开发者控制台和邮件里给出理由。常见打回原因和排查方向：

| 打回原因（常见措辞） | 排查方向 |
|---|---|
| Permission not sufficiently justified / 权限说明不够具体 | 检查 1.2 节的权限用途说明是否明确写清了"何时触发、读取什么、不做什么"，避免笼统的"用于提供插件功能"这类空泛表述 |
| Privacy policy URL not accessible / 隐私政策链接无法访问 | 确认 Gist 是 **public** 而非 secret，用无痕窗口/未登录状态重新打开链接验证能看到内容 |
| Single purpose violation / 不满足单一用途 | 确认应用描述和实际功能一致，没有描述任何和"提取下载图标"无关的功能 |
| Deceptive or inaccurate metadata / 元数据不准确 | 核对应用名称、描述、截图是否和插件实际行为一致，不要用夸大或无关的关键词堆砌描述吸引搜索 |
| Uses remote code / 使用远程代码 | 本项目已在代码 review 阶段确认无 `eval`/动态执行远程内容，正常不会触发；如果收到这条，检查是否误引入了新依赖动态加载脚本 |
| Requesting permissions not used / 声明了未使用的权限 | 核对 `wxt.config.ts` 里的 `permissions` 是否和代码里实际调用的 API 一致（当前只有 `activeTab`/`scripting`/`downloads`，均有对应代码路径使用） |

排查修复后，回到开发者控制台对应标签页更新内容，重新提交即可，不需要新建项目。
