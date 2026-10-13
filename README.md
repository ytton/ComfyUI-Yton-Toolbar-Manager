# Yton 界面管理器

控制 ComfyUI 顶部插件工具栏和侧边栏入口的显示，不修改其他插件或工作流节点。

安装到 `ComfyUI/custom_nodes/ComfyUI-Yton-Toolbar-Manager`，重启 ComfyUI 并刷新页面。无需额外依赖。

点击顶部“界面管理”，或通过“设置 → Yton 界面管理”打开。快捷键为 `Alt+Shift+T`。

- 取消勾选强制隐藏对应入口，勾选允许原插件显示。
- “新入口默认隐藏”保留当前已识别入口，以后新增的入口需手动勾选。
- 隐藏规则会在插件重新插入入口后继续应用。
- “恢复全部入口”清除隐藏规则；关闭“启用入口管理”暂停管理。
- 界面管理器和设置入口始终保留。
- 配置保存在 ComfyUI 用户设置中，可跨刷新和重启使用。

管理范围是 `app.menu.element`、顶部扩展区域和原生侧边栏。插件自行创建的悬浮窗、画布节点内部按钮及弹窗内容不在管理范围内。

新版双击节点选择器的左侧包列表提供独立搜索，按名称 A–Z 排列，忽略前缀 emoji 和符号，中文名称排在最后。搜索只过滤左侧包名；顶部节点搜索仍按原功能使用。此功能的前端扩展名为 `Yton.NodeSearchPackages`。

验证：`npm test`。浏览器回归函数位于 `tests/toolbar-manager.browser.mjs` 和 `tests/node-search.browser.mjs`。
