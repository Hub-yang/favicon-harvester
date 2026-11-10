# 上线操作指南

本文档记录「图标提取器」在 Chrome 网上应用店的首次上架、版本更新和审核处理流程。隐私政策沿用公开 GitHub Gist，商店默认语言为简体中文，并维护英文列表。

## v0.5.0 上架记录

v0.5.0 已通过审核。2026-11-09 核对[商店公开页](https://chromewebstore.google.com/detail/bejmkbjkhhdoimpilmolnlckhnoihpjp?hl=zh-CN)，版本字段为 `0.5.0`。正式包见 [GitHub Release](https://github.com/Hub-yang/favicon-harvester/releases/tag/v0.5.0)。下面保留本次更新现有项目的送审步骤。

1. **更新隐私政策**。打开 [现有公开 Gist](https://gist.github.com/Hub-yang/ad261fe23b78b0c0c72098e927cb70de)，点击 **Edit**，用 [1.1 的完整正文](#11-准备隐私政策页面公开-gist)替换 `PRIVACY.md` 并保存。用退出登录或无痕窗口打开同一 URL，确认能看到「自动扫描」「最多复用 30 秒」和「有限使用要求」。商店继续使用这个 URL。
2. **上传正式包**。下载 [`favicon-harvester-0.5.0-chrome.zip`](https://github.com/Hub-yang/favicon-harvester/releases/download/v0.5.0/favicon-harvester-0.5.0-chrome.zip)。进入 [Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole)，打开已发布的「图标提取器」，在 **Package** 里点 **Upload new package**，直接选择 ZIP。确认草稿版本显示 `0.5.0`。如需校验文件，SHA-256 为 `94f44412dd36b7d6603a7d17abf7214c5d74e6cbd23af702fa85c06639c3d2ae`。 [官方更新指南](https://developer.chrome.com/docs/webstore/update)
3. **保存 Privacy practices**。按 [1.2 的权限表和数据使用声明](#12-商店列表文案可直接抄用的草稿)填写。重点复核 `scripting`、新增的 `storage` 和 HTTP(S) 可选站点访问。若后台提供 **Host permission justification**，粘贴权限表最后一行。远程代码选「否」，隐私政策 URL 指向第 1 步的 Gist。 [官方隐私字段指南](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
4. **保存 Store listing**。分别粘贴 [简体中文](#12-商店列表文案可直接抄用的草稿)和 [English](#英文-listingen)的详细描述，名称与简短描述沿用扩展包自带文案。复核现有截图是否仍符合本版界面。需要替换时，使用 v0.5.0 的实际面板或设置页截图，可展示工具栏徽章，推荐 `1280 × 800`。 [官方列表素材指南](https://developer.chrome.com/docs/webstore/best-listing#screenshots)
5. **提交审核**。复核草稿版本、两种语言、权限说明和公开隐私政策，处理后台标出的必填项后点击 **Submit for review**。希望审核通过即上架就保留 **Publish automatically**，希望通过后再自行决定上架时间就取消勾选。确认 **Status** 中 v0.5.0 显示 **Pending review** 或「审核中」。 [提交与延后发布](https://developer.chrome.com/docs/webstore/publish#submit_your_item) · [查看审核状态](https://developer.chrome.com/docs/webstore/check-review)

如果 **Test instructions** 中有可填写的审核说明，可使用下面这段。

```text
Open an HTTP(S) page with site icons and click the extension icon to scan manually. To test automatic scanning, open Settings from the popup, enable automatic scanning, approve the optional site access prompt, and open an authorized page. The toolbar badge shows the number of verified icons. Turn off automatic scanning in Settings to clear the badge and revoke site access. No account is required.
```

---

## 第一部分：首次提交上架

### 1.1 准备隐私政策页面（公开 Gist）

在 **Privacy practices** 的 **Privacy policy URL** 填写[现有公开 Gist](https://gist.github.com/Hub-yang/ad261fe23b78b0c0c72098e927cb70de)的页面地址。更新 `PRIVACY.md` 后继续使用同一个 URL。以下是可直接复制的完整正文。

```markdown
# 图标提取器（Favicon Harvester）隐私政策

本插件在你的设备上处理当前页面 URL 和与图标相关的网页内容，用于查找、显示和保存图标。插件不向开发者上传或出售这些数据，也不把浏览历史或扫描记录写入持久存储。

后台会在内存中暂存扫描结果，包括当前页面地址、图标声明和候选元数据。缓存最多复用 30 秒，过期后停止复用并在后续缓存操作时清理。后台终止时内存数据丢失。包含内嵌图片地址的结果不进入此缓存。「重新扫描」与「重试」绕过插件缓存，浏览器自身的 HTTP 缓存仍照常生效。

- 默认由你点击工具栏图标、按下快捷键或选择「提取此页图标」后扫描。你也可以主动授予可选的 HTTP(S) 站点访问权限，让插件在你查看已授权网页时自动扫描并显示数量徽章。可以随时停用，持久存储只保存这个开关。
- 插件读取当前标签页的 URL 和 favicon 地址，并处理页面 `<head>` 中与图标有关的声明、网站的 Web App Manifest 和图标文件。用于核对页面与徽章是否对应的临时状态保存在后台内存。
- 自动模式只请求当前页面同源的图标资源和 manifest，不携带凭据或 Referer，不跟随重定向。手动模式还会处理网站声明的资源。插件不使用第三方图标兜底服务。
- 插件不集成任何分析、统计或广告 SDK，不包含任何形式的用户跟踪。
- 下载到本地的图标文件只保存在你自己的设备上，插件开发者无法访问。

本插件对上述数据的使用遵守 [Chrome 网上应用店用户数据政策的有限使用要求](https://developer.chrome.com/docs/webstore/program-policies/limited-use)。

如有疑问，请通过 `18830279823@163.com` 联系。
```

### 1.2 商店列表文案（可直接抄用的草稿）

> ⚠️ 这份文案是 2026-08-01 首次提交被拒（描述关键字堆砌）后重写的版本，改写要守住的三条原则见 [第三部分](#第三部分审核被打回怎么办) 表格中「垃圾内容和商店中的排名」那一行。**不要把它"优化"回枚举/斜杠列表的写法。**

> 📌 **v0.3.0 起 manifest 的 `name` / `description` 不再硬编码**，改由 `locales/zh_CN.yml` 的 `extName` / `extDescription` 提供
> （英文对应 `locales/en.yml`）。本节的「应用名称」和「简短描述」与那两个字段**必须逐字一致**——
> 前者是商店列表页展示的文案，后者是用户安装后在扩展管理页看到的名字，对不上会让人以为装错了东西。改文案时两处一起改。

**应用名称**：图标提取器

**简短描述**（132 字符以内，列表页展示）：

```
扫描当前网站正在使用的图标（favicon 等），去重后列出全部结果，单个下载或打包成一个 ZIP 拿走，不依赖第三方服务。
```

**详细描述**（Store listing 详情页正文）：

```
图标提取器帮你快速拿到当前网站正在使用的图标文件。

打开任意网页，点击工具栏上的插件图标（也可以按它的快捷键，或者在页面空白处右键选择「提取此页图标」），它会扫描这个网站声明的图标资源，包括页面头部的图标标签、网站的 Web App Manifest，以及网站根目录下的常见图标路径。

找到的图标会去重后按尺寸从大到小列在面板里，每一条都标着尺寸和格式，通常还带着文件有多大。点一下缩略图可以放大再看一眼，还能把背景换成浅色或者深色，图标边缘的透明部分干不干净，一眼就能看出来。

你可以挑需要的那些单独下载，也可以把它们打包成一个 ZIP 一次拿走，包里附了一份清单，记着每个图标是从网站的哪个位置找到的。下载的文件会按网站的域名分到各自的文件夹里，不会把你的下载目录弄乱。单个图标还能直接复制走——复制地址、复制图片本身、复制 Data URI，或者复制一段现成的 link 标签。下载得到的是网站上的原始文件，插件不做任何转码或压缩。

短时间重开同一页面时，可以复用刚才的扫描结果，减少重复等待；需要时点击「重新扫描」即可。

如果你希望打开网页时就看到有多少图标可提取，可以在设置里授权并启用自动扫描。工具栏会显示当前页面已验证的数量，未扫全时会在数字后标上加号。你随时可以停用。

插件的界面跟着浏览器的语言走，简体中文和英文都有，不需要你另外设置。

自动扫描默认关闭，只有你主动授权后才会运行，自动请求限于当前网页同源。插件不使用第三方图标服务。扫描数据在设备上处理，不会回传给开发者。页面地址和图标元数据仅临时保存在后台内存，最多复用 30 秒。插件只持久保存自动扫描的开关。

适合需要参考同行网站图标的设计师，以及想拿到某个站点各个尺寸图标的开发者。
```

**单一用途说明**（Privacy practices 标签页「Single purpose description」字段）：

```
提取并下载当前网站的图标资源（favicon、apple-touch-icon、web manifest 图标等）。
```

**权限用途说明**（Privacy practices 标签页，每个权限单独一个文本框）：

| 权限 | 用途说明草稿 |
|---|---|
| `activeTab` | 用于用户主动点击插件图标、按下快捷键或选择「提取此页图标」时，临时访问当前标签页，读取 URL 以确定手动扫描目标和下载文件名中的域名。 |
| `scripting` | 手动扫描时使用临时访问权限，自动扫描时仅访问已授权的当前网页。两种模式均使用随扩展打包的脚本读取当前页图标声明，自动扫描还会在页面隔离环境中验证 SVG。脚本不修改页面内容。 |
| `downloads` | 用于将用户选择的图标保存到本地下载目录。打包下载时，扩展从对应资源地址取得图标，在本机生成 ZIP，再用该权限保存文件。 |
| `contextMenus` | 用于在网页空白处添加「提取此页图标」菜单项，用户选择后打开插件面板。该入口不读取右键位置的元素、选中的文字或链接。 |
| `storage` | 仅在本机保存用户是否启用自动扫描。不保存站点地址、扫描记录或图标。 |
| HTTP(S) 可选站点访问 | 自动扫描默认关闭。用户在设置页主动启用时，才请求 HTTP 和 HTTPS 的可选站点访问。授权用于在用户打开已授权网页时读取当前页图标声明并显示数量徽章，无需每次点击扩展。后台自动请求只访问当前网页同源的图标和 manifest，用户可随时停用。 |

**远程代码（Remote code）** 选「否」。扩展执行的是 ZIP 内打包的代码，网站图标和 manifest 作为资源数据读取。

**数据使用声明（Data usage）** 按本机处理范围填写。

- 勾选 **Web history（网页浏览记录）** 和 **Website content（网站内容）**。这里对应扩展临时读取的当前页 URL，以及图标声明、manifest 和图标文件。扩展不读取浏览器历史库，不记录浏览历史，也不向开发者回传这些数据。其余数据类别按本版行为留空。 [官方用户数据 FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- 勾选第二组的三项有限使用确认，包括不出售或转让用户数据、不用于核心功能以外的用途，以及不用于信贷判断。 [官方隐私字段指南](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#certify_your_data_use_practices)

**分类（Category）**：建议选 "Productivity"（生产力工具）或 "Developer Tools"，二选一，凭你判断哪个更贴近实际使用场景。

**语言**：中文（简体）为默认语言；英文 listing 见下方。

#### 英文 listing（en）

Store listing 页顶部的语言下拉框里，选项对应扩展包里的 `_locales/<locale>` 目录，所以要在带 `_locales/en` 的包（v0.3.0 起）上传后才能选 English。各字段的来源：

- **名称**与**简短描述**取自 manifest。下列文案应与 [`locales/en.yml`](./locales/en.yml) 的 `extName` / `extDescription` 逐字一致。
- **详细描述**：后台切到 English 后粘贴下面这段。它和中文版逐段对应，同样受本节顶部三条原则约束。
- **截图**：可以给英文单独上传一组，用英文界面截取。不传就沿用默认语言的截图。
- **单一用途说明、权限用途说明、数据使用声明**：这几项在 Privacy practices 标签页，不分语言，沿用上面的中文版即可。

**应用名称**：Favicon Harvester

**简短描述（English）**：

```
Scan the icons a site actually uses, list every unique result, download them one by one or as one ZIP. No third-party services.
```

**详细描述（English）**：

```
Favicon Harvester gets you the icon files that the website you are on is actually using.

Open any page and click the extension's button in the toolbar, or press its keyboard shortcut, or right-click an empty spot on the page and choose “Harvest icons from this page”. It looks at everything the site declares for its icons, including the icon tags in the page head, the site's Web App Manifest, and the usual file locations at the root of the domain.

Duplicates are removed and the results are listed from largest to smallest, each labeled with its dimensions and format, and usually its file size too. Click a thumbnail to see it enlarged, then switch the background to light or dark to check whether the transparent edges are clean.

Save the ones you need one at a time, or bundle them all into a single ZIP that comes with a list noting where on the site each file was found. Downloads go into a folder named after the website, so your downloads folder stays tidy. You can also copy any single result straight away, as its address, as the image itself, as a Data URI, or as a ready-to-paste link tag. What you get is the original file from the website, never converted or compressed.

Reopen the same page shortly afterwards to reuse the recent scan, or choose Rescan when needed.

If you want to see how many icons a page offers as you browse, you can grant access and turn on automatic scanning in Settings. The toolbar shows how many icons were verified and adds a plus sign when the scan was partial. You can turn this off at any time.

The interface follows your browser's language and is available in English and Simplified Chinese, with nothing to set up.

Automatic scanning is off by default and runs only after you grant site access. Its requests stay within the current page's origin. The extension uses no third-party icon service and sends no scan data to the developer. Page addresses and icon metadata stay in background memory for reuse for up to 30 seconds. Only your automatic scanning setting is saved in persistent extension storage.

Useful for designers looking at how other sites handle their icons, and for developers who need every size a site provides.
```

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
   - 按 1.2 节填写 manifest 中各权限的用途，包括 `storage` 与 HTTP(S) 可选站点访问。
   - 数据使用声明按 1.2 节逐项勾选。
   - 填入 [1.1 的公开 Gist 地址](#11-准备隐私政策页面公开-gist)。
6. 进入「Distribution」标签页：
   - 可见性选 **Public**（商店listing 公开，跟代码仓库是否 private 无关）。
   - 地区选「所有地区」或按需勾选。
   - 定价选「免费」。
7. 检查页面顶部/底部是否还有未完成项的红色提示，全部清空后点击「提交审核」。
8. 提交后一般 **数小时到数个工作日**内会收到审核结果邮件（首次提交的新账号/新插件有时会更久，属于正常范围）。

---

## 第二部分：后续版本迭代发布流程

版本号递增、打标签、跑验证、构建 zip、生成 changelog、创建 GitHub Release 这一串动作已由 `.github/workflows/release.yml` 自动化，本地只剩一条命令。

1. 确认所有改动已提交并推送（`git status` 干净）。建议先在本地跑一遍验证：

   ```bash
   pnpm lint && pnpm compile && pnpm test
   ```

   这一步不是必须的（CI 里会再跑一遍作为门禁），但能避免标签推上去才发现失败——那样得先删标签才能重来（见本节末尾）。

2. 跑发布命令，按提示选版本号（纯 bug 修复选 patch，新功能选 minor，破坏性变更选 major）：

   ```bash
   pnpm release
   ```

   `bumpp` 会自动改写 `package.json` 的 `version`、生成一条 `chore: release v<新版本号>` 提交、打上 `v<新版本号>` 标签并推送。提交信息里的 `chore` 在 commitlint 白名单内，不会被 husky 钩子拦下。

3. 标签推送后 GitHub Actions 自动接手，在仓库 Actions 页面能看到 Release 工作流依次执行：

   - 校验标签名与 `package.json` 的 `version` 一致（防手滑打错标签）；
   - 跑 `pnpm lint` / `pnpm compile` / `pnpm test` 作为发布门禁，任一失败就不会产生 Release；
   - 通过后 `pnpm zip` 构建打包，`changelogithub` 按 conventional commits 把上一个标签至今的提交渲染成 Release 正文，最后把 zip 作为附件传上去。

4. 工作流跑绿后打开仓库 Releases 页面，下载附件里的 `favicon-harvester-<版本号>-chrome.zip`。（不想等 CI 也可以本地 `pnpm zip` 自己出包，产物路径和文件名完全一样。）

5. 打开 [Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole)，进入已发布的「图标提取器」项目。

6. 「Package」标签页上传这个 zip 包（Chrome 会自动识别 `manifest.json` 里的 `version` 已递增）。

7. 如果这次改动涉及新权限/新的数据处理方式，同步更新「Privacy practices」标签页对应内容；否则跳过，直接提交。

8. 如果这次改动让 1.2 节的商店文案不再准确（比如新增了文案里没提到的能力），先按那一节标注的重写原则更新文案，再在「Store listing」标签页同步。

9. 点击「提交审核」。更新审核通常比首次提交快。

10. 审核通过后核对商店公开页的版本字段。将发版提交同步回 `dev`，更新发布记录后核对 `dev` 与 `main` 的本地和远端分支。

**门禁失败或标签打错了怎么办**：Release 工作流跑红时不会产生 Release，修完问题后需要把标签删掉重打，否则同名标签推不上去：

```bash
git tag -d v<版本号>                  # 删本地标签
git push origin :refs/tags/v<版本号>  # 删远端标签
```

然后修复问题、提交，再重新跑 `pnpm release`。

### 各版本变更要点

**每次发版前在这里补一条**，记清楚这一版对用户可见的变化，以及商店后台需要跟着动的地方。
上一版没改过的字段就写「无需改动」，别留空——留空分不清是"不用改"还是"忘了看"。

| 版本 | 对用户可见的变化 | 商店后台要跟着改什么 |
|:--|:--|:--|
| v0.2.0 | 首个上架版本：扫描当前网站的图标资源，去重列出，逐个下载 | 首次提交，1.2 节全部字段都要填 |
| v0.3.0 | 界面与扩展名支持简体中文和英文，跟随浏览器语言自动切换；「全部下载」改为打包成一个 ZIP（内附 `icons.json` 清单），不再触发 Chrome 的多文件下载询问；下载文件统一落到 `favicon-harvester/<域名>/` 子目录；复制能力从只能复制链接扩展到还能复制图片本身、Data URI 和现成的 `<link>` 标签；卡片上补充文件体积，缩略图可点击放大并切换预览底色 | **Store listing 的详细描述必须更新**（1.2 节已改好，直接抄）。权限没有增减，Privacy practices 标签页**无需改动**。⚠️ 应用名称与简短描述这一版起改由 `locales/zh_CN.yml` 提供，改文案时记得两处同步 |
| v0.3.1 | 纯视觉调整，能力不增不减：所有按钮配上图标，进行中、成功、失败时图标随状态变化；卡片上的下载与复制按钮缩小后并排放到第一行，文件体积挪到第二行 | 详细描述**无需改动**，权限没有增减，Privacy practices **无需改动**。⚠️ **截图建议重截**：旧截图里的按钮样式与卡片排版已和实际界面不一致，审核可能以「元数据不准确」打回 |
| v0.3.2 | 修复两处扫描缺陷：`rel` 写成多个值的图标标签（如 `alternate icon`）原来会被漏掉，现在能识别；多帧 ICO 的卡片原来只显示一个尺寸，现在列出它包含的全部尺寸。本版同时带上 v0.3.1 的视觉调整（按钮图标、卡片按钮单行） | 详细描述**无需改动**（「head 里的图标标签」本就涵盖多值 `rel`），权限没有增减，Privacy practices **无需改动**。⚠️ **截图必须重截**（v0.3.1 起界面已变）。英文 listing（FH-21）与本版同一次提交 |
| v0.3.3 | 修复一处复制缺陷：多帧 ICO 复制成 `<link>` 标签时，`sizes` 原来只写最大的那一帧（如 `48x48`），现在写全它包含的每一帧（如 `16x16 32x32 48x48`）。界面没有变化 | 详细描述**无需改动**，权限没有增减，Privacy practices **无需改动**，截图**无需重截**。等 v0.3.2 审核结束后再上传本版 |
| v0.4.0 | 新增两种打开面板的方式：快捷键 `Alt+Shift+F`（Mac 上是 `Option+Shift+F`，可在 `chrome://extensions/shortcuts` 改），以及页面空白处右键菜单里的「提取此页图标」。面板和扫描结果与点图标时完全一样。新功能，版本号选 **minor** | **Store listing 的详细描述必须更新**：中文与 English 两个语言各粘贴一次，1.2 节已改好，直接抄；名称与简短描述来自 manifest，**无需改动**。**新增 `contextMenus` 权限**，安装与更新时都没有权限警告，已装用户不会被停用。Privacy practices 要改三处：新增的 `contextMenus` 文本框填用途说明；`activeTab`、`scripting` 两段换成新写法（都按 1.2 节权限表直接抄）；单一用途说明与数据使用声明**无需改动**。⚠️ **公开 Gist 上的隐私政策要按 1.1 节同步**（只改了第一条）。截图**无需重截**（面板界面没变） |
| v0.5.0（GitHub 与 Chrome 网上应用店均已发布） | 设置页可启用自动扫描和数量徽章，默认关闭。同页短期复用完整结果，并提供主动重新扫描 | 公开 Gist、权限与数据使用声明、中英文详细描述及截图的送审步骤见[本版上架记录](#v050-上架记录) |

### v1.0.0 候选

Chrome 首个稳定版。面板设置入口更容易辨认，授权说明更直接，停用按钮增加电源图标和操作反馈。工具栏徽章改为红底，部分扫描用 `N+` 表示已验证数量的下限（FH-35）。本版同时包含 Chrome 升级引导单测修正（FH-32）及原生右键菜单 E2E（FH-33）。Firefox 另行适配。

送审时在现有商店项目上传已核验的 `favicon-harvester-1.0.0-chrome.zip`，分别更新中英文的面板和设置页截图。沿用 1.2 节中英文列表文案、Privacy practices 与公开隐私政策。[Chrome 网上应用店更新指南](https://developer.chrome.com/docs/webstore/update)

| 列表语言 | 面板与红色徽章 | 自动扫描设置 |
| :-- | :-- | :-- |
| 简体中文 | `zh-cn-panel.png` | `zh-cn-settings.png` |
| English | `en-us-panel.png` | `en-us-settings.png` |

审核测试说明可用以下文字。

```text
Open an HTTP(S) page with site icons and click the extension icon to scan manually. Open Settings using the gear in the panel, enable automatic scanning, and approve the optional site access prompt. On an authorized page, the red badge shows the number of verified icons. A plus sign indicates that the automatic scan verified only part of the results. Turn off automatic scanning in Settings to clear the badge and revoke site access.
```

---

## 第三部分：审核被打回怎么办

Chrome 审核团队打回后会在开发者控制台和邮件里给出理由。常见打回原因和排查方向：

| 打回原因（常见措辞） | 排查方向 |
|---|---|
| Permission not sufficiently justified / 权限说明不够具体 | 检查 1.2 节的权限用途说明是否明确写清了"何时触发、读取什么、不做什么"，避免笼统的"用于提供插件功能"这类空泛表述 |
| Privacy policy URL not accessible / 隐私政策链接无法访问 | 确认 Gist 是 **public** 而非 secret，用无痕窗口/未登录状态重新打开链接验证能看到内容 |
| Single purpose violation / 不满足单一用途 | 确认应用描述和实际功能一致，没有描述任何和"提取下载图标"无关的功能 |
| Deceptive or inaccurate metadata / 元数据不准确 | 核对应用名称、描述、截图是否和插件实际行为一致，不要用夸大或无关的关键词堆砌描述吸引搜索 |
| Spam and Placement in the Store / 垃圾内容和商店中的排名（违规参考 ID 形如 `Yellow Argon`）、「产品说明中有过多关键字」 | 商店描述按三条原则重写：①不写脱离句子的枚举列表，尤其是文件格式、扩展名、同义词串；②不用 `A / B / C` 斜杠罗列，也不用 `·` 起头的关键词式条目，改成完整段落句子；③同一个技术名词全篇最多提一次。改完只在 Store listing 标签页更新文字并重新提交，包和版本号都不用动。**2026-08-01 首次提交就是栽在描述里的 `PNG/SVG/ICO/JPEG/GIF/WEBP` 这一串格式枚举上** |
| Uses remote code / 使用远程代码 | 本项目已在代码 review 阶段确认无 `eval`/动态执行远程内容，正常不会触发；如果收到这条，检查是否误引入了新依赖动态加载脚本 |
| Requesting permissions not used / 声明了未使用的权限 | 核对 [WXT 配置](./wxt.config.ts) 中的必需与可选权限是否各有现役调用，并与 1.2 节的用途一致 |

排查修复后，回到开发者控制台对应标签页更新内容，重新提交即可，不需要新建项目。

## 第四部分：「增强型安全浏览功能不信任此扩展程序」提示

用户在 `chrome://extensions` 看到黄色感叹号加这句提示（英文原文 *This extension is not trusted by Enhanced Safe Browsing*）时，
**不是代码、manifest 或商店文案的问题，也不是审核违规**，不要试图改包或反复重发版本去消除它。

### 触发规则

该提示只对开启了「增强型安全浏览（Enhanced Safe Browsing）」的用户显示，判定依据是**发布者账号的声誉**，不是逐个扩展的代码扫描：

- 官方口径：扩展由「遵守 Chrome 网上应用店开发者计划政策的开发者」发布时才被视为可信；
  **新开发者账号通常需要持续合规几个月**才会进入可信名单（社区反馈普遍为 2~6 个月）。
- 2025 年 6 月起增强型安全浏览设置会跨设备同步，开启该选项的用户基数变大，看到这个提示的人随之增多。
- 提示只是信息性的，不阻止安装和使用。

本项目 0.2.0 出现该提示时的实际情况：开发者账号 2026-08 才首次上架，商店条目正常在架
（ID `bejmkbjkhhdoimpilmolnlckhnoihpjp`），权限仅 `activeTab`/`scripting`/`downloads`、无 `host_permissions`、无远程代码——完全符合「新账号尚未攒够声誉」这一种情况。

### 能做的事（按性价比排序）

1. **保持合规、按正常节奏迭代发版，等时间**。这是唯一真正让提示消失的路径；任何未处理的政策违规都会让计时重来。
2. 在开发者控制台 Account 标签页完成发布者身份与联系邮箱验证、补齐发布者网站（填 GitHub 仓库主页即可）。
   这同时是 **Established Publisher（知名发布商）徽章**的前置条件——该徽章要求「身份已验证 + 与 Google 服务保持一贯良好记录」，同样需要几个月。
3. 继续维持权限最小化、不引入任何动态加载远程脚本的依赖（当前已满足，见第三部分表格最后两行）。
4. 在 README 与商店描述里主动说明这个提示的含义，降低用户疑虑，比什么都不说更能保住信任。
5. Featured（精选）徽章需要提名，且要求条目支持英文。英文 listing 文案见 1.2 节末尾，在商店后台提交生效后才满足这一条。

### 顺带说明：`Service Worker（无效）`

同一个卡片上「检查视图：Service Worker（无效）」是 MV3 后台 Service Worker 的**空闲状态**（zh-CN 把 Inactive 译成了「无效」），
收到消息会自动唤醒，不是错误，与上面的提示无关。
