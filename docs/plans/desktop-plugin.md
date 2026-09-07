# 必须要实现的目标

计划执行者将 CacheScope 改为可安装到 fzfz/dsh-desktop 的 Host + Client 插件。Host 指 Harness 进程中的记录与查询模块；Client 指由 desktop 加载的浏览器端插件组件。

1. 用户通过 desktop 的插件安装入口安装 CacheScope，启动后即可使用。
2. 用户在 desktop 左侧点击 CacheScope 按钮，打开采用宿主原生组件和交互的诊断面板，查看当前 `/cachescope` 页面的全部诊断功能。
3. 用户在 desktop 设置中的 CacheScope 页面开启或关闭本地记录。设置持久保存，修改后立即生效。

# 已获得的授权

用户已授权创建独立 worktree、调查当前项目与目标仓库、编写实施方案。用户明确要求先批准方案，再实施功能。

本轮工作目录为 `/Volumes/4Tdisk/work/AI2/dsh-cachescope-desktop-plugin-plan`，分支为 `codex/desktop-plugin-plan`，起点为 `65985a6`。用户已批准本方案实施。

用户已批准实施本方案中的 CacheScope 代码、固定版本依赖和测试。用户随后授权创建 PR 并合入 main；正式 desktop 配置修改和软件包发布不在本次授权内。

# 接入依据与适配版本

当前 CacheScope 已有 `dsh.bundle.patch` 和 `cordis.patch.yml`，缺少 `./client` 导出及 Client 注册代码。`src/index.ts` 监听 `llm/stream`，`src/diagnostics.ts` 将调用记录、比较基线及可选完整输入保存在进程内存中；`logAttempts` 默认开启，摘要交给宿主日志系统处理。关闭 `dashboard` 只会关闭 HTTP 页面，不会停止记录；`captureInput: metadata` 也不会停止元数据记录。

目标 desktop 的 [package.json](https://github.com/fzfz/dsh-desktop/blob/main/package.json) 使用 Harness `0.1.2-rc.1`。本方案同时核对本机目标仓库的 `fork/main` 提交 `f2a27b4461e8c15d21268533efb7b99bb9bb14f2`、`packages/dshmarket` 和该工作目录中的已安装类型声明。实施验收以这个 desktop 提交及其打包依赖为基准。

| 已确认的宿主接口 | CacheScope 的用途 |
| --- | --- |
| `package.json` 的 `dsh.client`、`exports["./client"]` | 声明 Client 依赖和加载入口 |
| `window.__ModuleLoader__.load({ id, factory })` | 加载浏览器构建产物，使用宿主提供的 React 和控件 |
| `sidebar.footer.action` | 添加左侧 CacheScope 按钮，适配展开和折叠状态 |
| `shell.overlay`、原生 `Modal` | 打开 CacheScope 大尺寸诊断面板 |
| `settings.section` | 添加设置导航中的 CacheScope 页面 |
| Host `settings.register/get/watch` | 读取持久配置并通知记录模块 |
| Client `settingsScope.bind/set/subscribe` | 显示设置值、保存更改、接收最新配置 |
| `@deepseek-ai/dsh-client-ui-primitives` | 使用 Button、Input、Menu、Tooltip、DisclosureRow、JsonTree 和剪贴板工具 |

已核对的 `ctx.layout` 只提供侧栏和详情栏动作，没有通用的主内容页导航接口。因此本方案使用 desktop 原生 `Modal` 展示大尺寸诊断面板；它属于桌面应用内的浮层面板，不是替换聊天主内容区的路由页。若用户要求后者，需要另外设计宿主页面扩展接口并扩大到 desktop 仓库的改动。

# 用户界面与交互

## 左侧入口与诊断面板

计划执行者在 `sidebar.footer.action` 注册唯一的 CacheScope 按钮。侧栏展开时，按钮显示图标与名称；侧栏折叠时，按钮显示图标、Tooltip 和可访问名称。

用户点击按钮后，Client 在 `shell.overlay` 中显示原生 Modal。面板使用可随窗口伸缩的大尺寸布局，保留宿主关闭按钮、Escape 关闭和焦点返回行为。关闭面板后，用户返回原有会话，输入草稿和会话选择保持原状。

面板顶部显示名称、记录状态、刷新操作和跟随最新调用开关；中部显示缓存统计及筛选条件；下部显示调用列表和所选调用详情。窗口变窄时，列表与详情改为上下排列。主题颜色、字体、边框和间距使用宿主 `--dsw-*` 变量。通用操作使用宿主控件，不引入另一套 UI 库。

Client 用 React 组件重写 `src/page.ts` 中的页面行为，不嵌入 iframe、webview 或完整 HTML，不要求用户输入 URL，不创建第二个端口。前端使用同源相对路径访问现有查询接口。

## 原有功能迁移

| 现有功能 | 原生面板中的实现 |
| --- | --- |
| 缓存读写、未缓存输入、输出、加权缓存比例、TTFT 和耗时统计 | 统计区与调用详情；继续使用 Host 的计算结果 |
| Session、供应商、模型、用途、生命周期和证据筛选，以及诊断排序 | 原生输入框、菜单和表格交互；筛选后同步刷新统计 |
| 选中调用、跟随最新调用、暂停刷新、手动刷新、详情聚焦 | Client 状态管理；暂停刷新不改变 Host 记录开关 |
| 邻接输入比较、Token 差额解释和差异颜色 | 输入诊断组件；保留稳定区域、首个差异、下游区域及无比较基线的区别 |
| 完整输入按需加载、重试、JSON 展开收起、复制 | 原生 JsonTree 用于普通 JSON；带差异标记的输入树用 DisclosureRow 组合，保留原有展开收起和复制能力 |
| 空列表、未携带 usage、输入已淘汰、加载失败 | 分别显示具体状态；缺失的 Token 数据不显示为零 |

计划执行者从 `src/page.ts` 抽取筛选、排序、输入树和展示数据转换函数，供原生组件使用；诊断算法继续由 `src/analysis.ts` 和 `src/diagnostics.ts` 提供。旧页面保持可访问，作为现有调用方的原有功能；本次不增加旧版本宿主适配逻辑。

## 设置页与记录开关

设置导航新增 CacheScope 页面，提供以下三个选项。设置页使用宿主已有设置行的样式与开关交互。

| 配置项 | 初始值 | 行为 |
| --- | --- | --- |
| `recordingEnabled`：记录模型调用 | `true` | 控制内存调用记录、输入分析、比较基线、完整输入留存和调用摘要日志 |
| `captureInput`：保留完整输入 | 沿用 bundle 的 `full` | 关闭时切换为 `metadata`；仍可记录 Token、耗时和诊断元数据 |
| `logAttempts`：输出调用摘要日志 | `true` | 控制宿主日志中的 CacheScope 调用摘要 |

`recordingEnabled=false` 时，另外两个选项保留已保存值，但控件不可编辑；页面说明重新开启记录后将恢复这些选择。数值容量、刷新间隔和价格配置继续使用现有插件配置，本次不增加这些高级设置的界面。

关闭记录的保存操作成功后，Host 停止新增和更新 CacheScope 调用记录，停止输入分析及摘要日志，并清空比较基线。已保存的调用记录仍可查看，不删除宿主已经写出的日志。已经开始记录但仍在运行的调用标记为“记录已停止”，保留关闭前的数据，不把后续模型输出写入记录。

关闭前已创建的流包装器必须在每次观察和结束处理前检查记录资格。重新开启后，只记录新开始的调用；关闭前的调用不能恢复写入。第一条新调用显示无比较基线。整个过程保持模型请求、流式输出、取消和异常传播不变。

`captureInput` 从 `full` 改为 `metadata` 时，Host 删除已有记录保留的完整输入，Client 同步清空已加载的完整输入。再次开启完整输入留存只影响新调用。

设置使用 `cachescope` 命名空间。默认配置文件提供默认值，插件配置提供部署覆盖值，宿主 settings 用户层提供用户覆盖值。Client 不用 localStorage 保存另一份配置；保存失败或版本冲突时，显示具体错误并重新读取宿主实际值。

# 代码改动与执行顺序

| 步骤 | 计划执行者修改的文件 | 产物与完成条件 |
| --- | --- | --- |
| 1. 统一配置定义 | 新增 `src/config.ts`、`src/settings.ts`；修改 `src/index.ts`、`src/types.ts` | 默认值只在配置模块定义；schema 只负责结构与校验；Host 注册 settings 并向流观察逻辑提供实时配置 |
| 2. 实现记录状态切换 | 修改 `src/diagnostics.ts`、`src/index.ts`、`src/types.ts` | 开关、进行中调用停止记录、基线清理和完整输入清理按上文生效 |
| 3. 提供 Client 查询状态 | 修改现有 `/cachescope/api` 和 `/cachescope/api/input` 的响应类型；新增 `src/contracts.ts` | 状态响应包含有效记录设置；完整输入状态准确；请求保留现有同源与回环访问检查 |
| 4. 实现原生界面 | 新增 `src/client/index.tsx`、`Dashboard.tsx`、`SettingsPage.tsx`、`InputInspector.tsx`、`dashboard-state.ts` 和样式文件 | 注册入口、面板和设置页；共享查询状态；关闭或卸载后清理轮询、订阅和请求 |
| 5. 集中文案与错误映射 | 新增 `src/client/locales.ts`、`src/errors.ts` | UI 文案按宿主语言服务提供中英文；CacheScope 错误码与文案 key 只有一份映射，Host 返回结构化错误 |
| 6. 构建安装包 | 修改 `package.json`、锁文件、`scripts/build.mjs`、TypeScript 配置和 `cordis.patch.yml` | Host ESM 与 Client 模块工厂均被打包；Client 不携带重复 React 或 Node 内置模块 |
| 7. 验收和安装说明 | 扩展 `tests/cachescope.test.ts`，增加 Client 与安装测试；更新 `README.md`、`README.zh.md`、`README.i18n.yaml` | 全部测试通过，说明明确仅支持 desktop，列出 desktop 0.1.1（fzfz 分支提交 f2a27b4）与 DSH 0.1.2-rc.1，并包含安装入口、设置和使用步骤 |

查询路径、插件标识、设置命名空间和错误码等生产代码常量使用唯一结构化定义，Host 与 Client 按需导入。构建产物不得依赖本机 desktop 仓库路径。脚本不读取 Markdown 作为配置来源。

# 依赖版本与安装审计

计划执行者采用现有 TypeScript 构建 Host，并新增 `esbuild 0.25.12` 构建 Client 模块工厂。样式由插件自有静态样式产物提供，并在 Client 卸载时移除，不新增 CSS 处理器。React、React DOM 和宿主 UI 控件通过宿主模块表加载。

| 直接新增或适配依赖 | 固定版本 | 用途与审计意见 |
| --- | --- | --- |
| `esbuild` | `0.25.12` | 仅用于构建；其已披露开发服务器漏洞影响 `<=0.24.2`，本方案版本不在该范围，也不启动开发服务器 |
| `react`、`react-dom` | `18.3.1` | 开发与测试版本匹配目标宿主；生产由宿主提供；本插件不使用 React Server Components |
| `@types/react`、`@types/react-dom` | `18.3.1`、`18.3.0` | 仅用于 TypeScript 类型检查 |
| `@deepseek-ai/cordis`、`@deepseek-ai/schemastery` | `4.0.2`、`3.18.2` | 与目标宿主版本对齐；检查安装包依赖解析结果，确保插件使用宿主的 Cordis 与 Schemastery，不额外加载另一版本 |
| `@deepseek-ai/dsh-settings`、`dsh-llm`、`dsh-session`、`dsh-host-webserver` | 均为 `0.1.2-rc.1`，后三项同属 `@deepseek-ai` | Host 接口与目标打包版本对齐 |
| `@deepseek-ai/dsh-client-ui-primitives`、`dsh-client-ui-slots`、`dsh-client-ui-sidebar`、`dsh-client-ui-layout`、`dsh-client-ui-settings`、`dsh-client-locale` | 均为 `0.1.2-rc.1`，各项同属 `@deepseek-ai` | Client 类型与宿主接口对齐；运行时控件由宿主提供 |

上述审计依据包括目标锁文件、宿主类型声明、[esbuild 安全公告](https://github.com/advisories/GHSA-67mh-4wv8-2f99)和 [React 官方漏洞说明](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)。它们支持上述具体适用范围判断，尚不构成完整传递依赖审计。

安装获授权后，计划执行者先将直接依赖精确版本写入包管理文件，再生成锁文件并检查依赖公告、生命周期脚本与目标平台二进制。计划执行者将安装审计结果写入验收报告；若发现影响本次构建或运行的未解决漏洞，须在安装前提交替代版本及理由。除表内依赖和现有锁定依赖外，新增安装项目需另行说明并获得授权。

# 验收清单

以下条目已通过自动化测试及隔离宿主验证。具体证据见 `../desktop-compatibility.md`；原生界面验证使用 Desktop 内置 Harness 的补丁后前端，未启动 Electron 安装包。

- [x] 安装包包含 Host 入口、Client 模块工厂、样式、类型和 bundle patch；离开源码目录后仍可被目标宿主加载。
- [x] 经授权，在隔离 desktop 测试配置中从插件安装入口安装实际构建包，确认随机端口下成功加载；正式用户配置不作为测试配置。
- [x] 左侧展开和折叠状态均可打开原生诊断面板；关闭、Escape、键盘操作和焦点返回符合宿主交互；会话和输入草稿保持原状。
- [x] 宿主浅色、深色主题及窗口缩放下，筛选、列表、详情和输入树可读可操作，无 iframe 或外部浏览器跳转。
- [x] 模拟两次可比较调用，验证缓存 Token、加权比例、TTFT、输入差异和完整输入展示与现有算法一致；覆盖首条调用和缺失 usage；同一 Session 且同一用途的相邻调用可比较，不同 Session 或用途的调用不互作基线，无 Session 的 direct 调用不建立会话基线。
- [x] 覆盖全部筛选、排序、跟随、刷新暂停、手动刷新、复制、展开收起、输入过期和请求失败重试分支。
- [x] 记录关闭时，后续调用不新增记录、不分析输入、不输出调用摘要；Host settings 重启后仍为关闭。
- [x] 分别在模型流创建后尚未迭代、正在迭代时关闭记录；分别验证模型流成功结束、失败、取消和消费者提前停止迭代的行为；验证关闭记录后重新开启时旧模型流不恢复记录；模型 chunk、异常和取消行为与未启用观察器时一致。
- [x] 关闭记录后历史记录仍可查看，进行中记录标明已停止记录；重新开启后旧流不复活，新调用以无比较基线开始。
- [x] 完整输入关闭后，Host 和 Client 已保留原文被清理；输入相关元数据仍可查看；重新开启不补采旧调用。
- [x] 设置保存失败、只读设置、连接断开和并发修改均显示宿主实际状态，不显示未成功保存的开关值。
- [x] 卸载或禁用插件后，入口、面板、settings 注册、流监听、HTTP 路由和轮询被清理；重复启用只有一组注册。
- [x] 旧 `/cachescope` 页面可正常访问并使用原有功能，现有测试全部通过，原有回环访问检查保持有效。
- [x] `npm run typecheck`、`npm test`、`npm run build` 和安装包内容检查通过；Client 用现有 Node 测试运行器、jsdom 与 React DOM 测试，不新增测试框架。
- [x] 独立语义审核队员仅阅读待验收文案及语义规则，对界面文案、错误提示和使用文档出具验收清单；计划执行者修正不清晰的对象、动作、结果和章节混入内容。

# 非本次目标

本次不修改 dsh-desktop 的 Electron 主进程、通用导航或插件安装系统，不发布 npm 包或提交市场收录，不增加数据库或跨重启调用历史，不清除宿主旧日志，不改变模型请求和缓存策略，不新增费用估算规则、远程访问能力或额外 HTTP 服务。
