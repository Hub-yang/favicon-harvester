# favicon-harvester

Chrome 插件（Manifest V3）：获取当前标签页站点的图标资源（favicon / apple-touch-icon / web manifest icon 等），
在多个可能的资源位置查找，去重后在面板中展示，支持逐个下载。

## 状态

项目刚完成目录初始化，尚未开始编码。完整设计方案见 [SPEC.md](./SPEC.md)，
架构设计与功能实现将在后续会话中进行。

## 技术栈

- 框架：WXT (wxt.dev) + Vue3（`<script setup>`）
- 语言：TypeScript
- 构建：Vite（WXT 内置）
- 样式：UnoCSS（`@wxt-dev/unocss` 模块）
- Lint：@antfu/eslint-config（flat config）
- 测试：Vitest（`wxt/testing/vitest-plugin`）
- 工具函数：VueUse
- 包管理器：pnpm
- Manifest 版本：**MV3 only**，不做 MV2 兼容

## 关键约束（来自需求确认，不要在后续会话中重新讨论变更）

- 图标发现只使用当前站点自身资源（DOM link 标签、web manifest、常见 well-known 路径、`tab.favIconUrl`），
  **不引入任何第三方图标兜底服务**（如 Google S2）。
- 下载保留图标原始格式，不做格式转换；文件名规则：`域名-来源-尺寸.扩展名`（尺寸未知时用来源标识代替）。
- 面板展示**所有**去重后的候选图标，各自独立可下载，不做"只保留最佳一个"的自动筛选。
- manifest 权限最小化：只用 `activeTab` + `scripting` + `downloads`，不声明 `host_permissions`。

详细的架构设计、消息协议、目录结构、验证方式见 [SPEC.md](./SPEC.md)。
