# Yton 界面管理器

管理 ComfyUI 顶部插件工具栏和侧边栏入口，并提供工作流模型路径智能回填。

安装到 `ComfyUI/custom_nodes/ComfyUI-Yton-Toolbar-Manager`，重启 ComfyUI 并刷新页面。无需额外依赖。

GitHub：[ytton/ComfyUI-Yton-Toolbar-Manager](https://github.com/ytton/ComfyUI-Yton-Toolbar-Manager)。在 `ComfyUI/custom_nodes` 中执行 `git clone https://github.com/ytton/ComfyUI-Yton-Toolbar-Manager.git` 即可安装。

点击顶部“界面管理”，或通过“设置 → Yton 界面管理”打开。快捷键为 `Alt+Shift+T`。

- 取消勾选强制隐藏对应入口，勾选允许原插件显示。
- “新入口默认隐藏”保留当前已识别入口，以后新增的入口需手动勾选。
- 隐藏规则会在插件重新插入入口后继续应用。
- “恢复全部入口”清除隐藏规则；关闭“启用入口管理”暂停管理。
- 界面管理器和设置入口始终保留。
- 配置保存在 ComfyUI 用户设置中，可跨刷新和重启使用。

管理范围是 `app.menu.element`、顶部扩展区域和原生侧边栏。插件自行创建的悬浮窗、画布节点内部按钮及弹窗内容不在管理范围内。

新版双击节点选择器的左侧包列表提供独立搜索，按名称 A–Z 排列，忽略前缀 emoji 和符号，中文名称排在最后。搜索只过滤左侧包名；顶部节点搜索仍按原功能使用。此功能的前端扩展名为 `Yton.NodeSearchPackages`。

点击界面管理器右上角“智能填充缺失模型 / LoRA”，检查当前工作流及子图，按 ComfyUI 最新模型列表自动回填因目录分类而失效的路径。例如 `model.safetensors` 可回填为 `H3/model.safetensors`。仅替换唯一同名文件，支持普通模型、LoRA 和 rgthree 多行 LoRA，并保留强度、开关与连线。结果弹窗列出回填明细、同名候选和未找到的文件。编辑可通过 ComfyUI 撤销，保存工作流后持久化。

验证：`npm test`。浏览器回归函数位于 `tests/toolbar-manager.browser.mjs`、`tests/node-search.browser.mjs` 和 `tests/model-repair.browser.mjs`。模型回填回归使用独立 ComfyUI，需在其模型目录放置 `checkpoints/H3/review-model.safetensors`、`loras/H3/review-lora.safetensors` 以及 `checkpoints/A/duplicate.safetensors`、`checkpoints/B/duplicate.safetensors` 测试文件；文件可以为空，测试只检查路径，不运行模型。
