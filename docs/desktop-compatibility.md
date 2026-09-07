# 适配目标

CacheScope 仅支持 fzfz/dsh-desktop **0.1.1** 的提交 `f2a27b4461e8c15d21268533efb7b99bb9bb14f2`，及该提交内置的 **Harness 0.1.2-rc.1**。该支持范围不代表上游 desktop、其他同版本提交或独立 Harness 部署均兼容。

# 上游 Desktop 兼容范围

本次核对上游 [dataelement/dsh-desktop 的 64e3dfe 提交](https://github.com/dataelement/dsh-desktop/tree/64e3dfe9cf92361b413782959170560b6491072d)。该提交的 package.json 版本为 0.1.1，内置 Harness 为 0.1.2-rc.1。

该提交与已实测的 fzfz 提交使用相同的 packages/harness-0.1.2-rc.1 包内容。两者的 settings、UI primitives、模块加载器、layout 与 slots 补丁没有差异。侧栏补丁的差异涉及标题区域间距和品牌标记属性，均保留 sidebar.footer.action。DSH 入口与默认配置补丁的差异涉及 PPT 插件选择，不改变 CacheScope 的注册接口。因此，这个上游提交通过源码接口兼容核对；本轮没有安装并运行它，不能将 fork 的运行结果列为上游集成测试结果。

| 上游对象 | package.json 版本 | 内置 Harness | 结论 |
| --- | --- | --- | --- |
| main 提交 64e3dfe | 0.1.1 | 0.1.2-rc.1 | 源码接口兼容，未进行上游宿主集成测试 |
| [发布标签 v0.7.2](https://github.com/dataelement/dsh-desktop/blob/v0.7.2/package.json) | 0.1.1 | 0.1.2-alpha.1 | 不支持，Host 依赖版本不匹配 |
| [发布标签 v0.1.1](https://github.com/dataelement/dsh-desktop/blob/v0.1.1/package.json) | 0.1.0 | 0.1.0-rc.6 | 不支持，Host 依赖版本不匹配 |

其他上游提交和发布标签不在本次已核对范围内。发布标签、package.json 版本和内置 Harness 版本分别记录，不能相互替代。

# 版本与接口核对

| 对象 | 目标 desktop | CacheScope | 核对结果 |
| --- | --- | --- | --- |
| Harness CLI 及相关 Host/Client 包 | 0.1.2-rc.1 | 0.1.2-rc.1 | 直接使用的包版本和 package exports 一致 |
| Cordis | 4.0.2 | 4.0.2 | Host 使用宿主服务实例 |
| Schemastery | 3.18.2 | 3.18.2 | settings schema 注册成功 |
| React / React DOM | 18.3.1 | 测试版本 18.3.1，生产外部加载 | 实际 Client 使用宿主 React |
| `snapshotJsonValue` | `dsh-util-values` 导出 | 已改为从该包导入 | 旧 `dsh-session` 导入在新版无效，已修正 |
| 首个 Token 判断 | StreamChunk 区分 text、reasoning、tool-call delta | 按新版类型判定非空内容 | 旧 `dsh-llm.isTokenDelta` 导入在新版无效，已移除 |
| 设置 | `settings.register/get/watch`、`settingsScope.bind/set` | 使用上述接口 | 实际设置页保存成功 |
| Client 加载 | `__ModuleLoader__.load({ id, factory })` | 输出宿主模块工厂 | 实际安装包加载成功 |
| 原生 UI | 侧栏、settings、overlay 插槽与 ui-primitives | 注册三个插槽 | 按钮、设置页和 Modal 正常出现 |

目标 desktop 的侧栏补丁修改窗口标题区布局，保留 `sidebar.footer.action`。验证使用了目标安装目录中的 Harness、模块加载器、前端资源及补丁后的 Client 包，没有用 npm 原版宿主代替整个运行环境。

# 隔离宿主集成结果

使用独立 `DSH_HOME`，通过 desktop 自带 Harness 的 `plugin --profile web add <构建包> --ignore-scripts` 安装实际 `.tgz`。宿主使用随机回环端口启动。原生界面在浏览器中连接这份隔离宿主进行操作；正式 desktop 配置未用于测试。

- 安装器将包加入 web profile 的 dependencies 和 bundle 列表。
- 实际 Client 加载成功，展开与收起的侧栏均显示 CacheScope 入口。
- 点击入口可打开原生 Modal，关闭后焦点回到入口。
- 设置页显示记录、完整输入留存和调用摘要日志三个选项。
- 关闭记录后，附属选项禁用；配置写入隔离 settings.yaml。
- 重启宿主并更换随机端口后，面板仍显示“记录已关闭”。
- 使用本地测试模块向实际 llm/stream 送入两次合成调用；面板显示 89.09% 的单次缓存比例、84.76% 的加权比例及 200 + 100 − 180 − 0 = 120 的未缓存输入差额公式。
- 输入树完整展开后显示测试消息和差异标记；浏览器错误日志为空。
- 浅色、深色主题及 800 像素宽度下已检查原生面板；窄窗口中列表与详情上下排列。

本轮没有启动 Electron 安装包或使用真实模型密钥。上述界面结果来自 desktop 的实际内置 Harness 和补丁后前端；Electron 窗口生命周期及 macOS/Windows 安装器未在本轮重新测试。

# 自动化验证范围

`npm run typecheck`、57 项自动化测试、`npm run build` 和 `.tgz` 内容检查全部通过。安装包包含 Host JavaScript 与类型声明、Client 模块工厂及内嵌样式、bundle patch 和兼容性报告。

自动化测试覆盖原有页面和诊断计算、设置持久读写、记录开关、进行中的调用停止记录、重新开启后的旧流隔离、完整输入清理、流异常与取消、原生组件、筛选排序、复制、重试和卸载清理。测试使用 DSH 0.1.2-rc.1 的实际 Host 模块和原生 UI 控件；设置传输在组件测试中使用可控测试对象。

# 依赖安装审计

直接依赖使用 package.json 中的精确版本，传递依赖由 package-lock.json 固定。安装时禁用生命周期脚本。esbuild 仅用于本地构建，不启动开发服务器；React 与原生 UI 控件由宿主提供。

npm 镜像未实现审计接口，改用 registry.npmjs.org 执行审计，报告已知漏洞总数为 **0**。DSH 0.1.2-rc.1 迁移所需的 `dsh-util-values 0.1.2-rc.1` 原本已经作为传递依赖安装，现已明确声明为直接依赖。
