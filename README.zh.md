# DSH Desktop 的 CacheScope 插件

[English](README.md) | 中文

**CacheScope 仅支持 DSH Desktop。** 插件在桌面应用中提供原生侧栏入口、诊断面板和设置页，不支持独立运行的 Harness CLI 或浏览器部署。

## 支持版本

| 组件 | 支持目标 |
| --- | --- |
| DSH Desktop | [fzfz/dsh-desktop](https://github.com/fzfz/dsh-desktop)，版本 **0.1.1**，提交 **`f2a27b4461e8c15d21268533efb7b99bb9bb14f2`** |
| 内置 DeepSeek Harness | **0.1.2-rc.1** |
| Cordis / Schemastery | **4.0.2 / 3.18.2**，由该 desktop 提供 |
| React / React DOM | **18.3.1**，由该 desktop 提供 |

兼容范围按以下提交确定，不能只根据 desktop 的 package.json 版本号判断。

| Desktop 仓库 / 提交 | 内置 Harness | 兼容结论 |
| --- | --- | --- |
| `fzfz/dsh-desktop@f2a27b4`（包版本 0.1.1） | 0.1.2-rc.1 | 已支持；隔离宿主安装及原生界面验证通过 |
| `dataelement/dsh-desktop@64e3dfe9cf92361b413782959170560b6491072d`（main，包版本 0.1.1） | 0.1.2-rc.1 | 源码接口兼容；尚未进行上游宿主集成测试 |
| 上游发布标签 `v0.7.2`（包版本 0.1.1） | 0.1.2-alpha.1 | 不支持：不满足插件的精确 Host 依赖版本 |
| 上游发布标签 `v0.1.1`（包版本 0.1.0） | 0.1.0-rc.6 | 不支持：不满足插件的精确 Host 依赖版本 |

其他提交及发布标签尚未验证。上游源码对比依据见[兼容性报告](docs/desktop-compatibility.md)。

插件使用 desktop 的设置服务、Client 加载器、UI 控件和侧栏插槽，不打包另一份 React。Host 依赖使用与上述目标匹配的精确版本。

## 安装到 DSH Desktop

从本仓库构建 `.tgz` 包，然后安装到 **DSH Desktop 所属的 web profile**。若桌面插件安装器接受本地包，可直接选择该包。等价命令使用 desktop 自带的 DSH 入口及其 Harness 数据目录：

```sh
DSH_HOME="<desktop 的 Harness 数据目录>" node "<desktop 自带的 DSH 入口>" \
  plugin --profile web add "/absolute/path/to/kober-basket-dsh-cachescope-0.1.2.tgz" --ignore-scripts
```

安装后重启 DSH Desktop。安装到独立的全局 `dsh` profile 不会把插件装入 desktop。

## 打开与使用

1. 点击 desktop 左侧的 **CacheScope**。侧栏收起后仍可使用图标入口。
2. 开启记录，在同一会话中发送两条消息。
3. 选择一次调用，查看供应商报告的缓存用量、耗时及相邻输入差异。
4. 使用 Session、供应商、模型、用途、状态和证据筛选调用；汇总统计随筛选结果更新。

诊断面板使用 desktop 原生控件并跟随主题。关闭面板或按 Escape 后返回原会话，输入草稿保持原状。保留的 `/cachescope` 是现有诊断路由，使用者不需要手动输入 URL。

## 记录设置

打开 **设置 → CacheScope**。

| 设置 | 默认值 | 行为 |
| --- | --- | --- |
| 记录模型调用 | 开启 | 在进程内存中记录缓存用量、耗时、输入元数据和比较基线。 |
| 保留完整输入 | 安装包默认开启 | 在调用数量和单次输入大小限制内保留完整逻辑输入。关闭后清除 Host 和已打开原生面板中的输入正文。 |
| 向桌面日志写入调用摘要 | 开启 | 将只含元数据的调用摘要交给 desktop 日志系统。 |

更改通过 desktop 设置服务保存并立即生效。关闭记录后，插件停止采集、输入分析和调用摘要日志；历史记录仍可查看，进行中的记录标记为“记录已停止”。已有 desktop 日志保持原状。

重新开启后只记录新的调用；关闭前创建的模型流不会恢复写入。第一条新调用没有比较基线。记录关闭期间，另外两个选项保留已保存的值。**暂停刷新**只暂停面板定时查询，不会停止 Host 记录。

## 诊断功能

- 展示 Cache Read、Cache Write、未缓存输入、输出及 Token 加权缓存比例。
- 展示单次调用的 TTFT、总耗时，以及筛选范围的 TTFT 中位数与 P95。
- 比较相邻调用的 System、工具、消息、模型路由和请求参数。
- 通过 Token 差额公式解释报告的未缓存输入量变化。
- 通过输入树颜色区分稳定前缀、首个变化或新增、前序变化之后的区域以及无比较基线。
- 按所选调用加载完整输入，支持 JSON 展开、收起、重试和复制。
- 支持筛选、按时间或缓存比例或 TTFT 排序、跟随最新调用、手动刷新及复制筛选后的元数据。
- 使用显式配置的价格估算费用。

缺失的 usage 数据显示为未报告，不按零处理。输出 Token 不参与缓存比例。输入比较针对供应商序列化之前的 DSH 逻辑输入，颜色不表示供应商缓存命中位置。Call TTFT 包含网络和排队时间。

## 留存与高级配置

调用记录在 Harness 进程停止后消失。完整输入可能包含 System 正文、工具定义、消息和参数。复制完整输入会写入操作系统剪贴板，其内容可能在进程结束后继续存在。

以下参数继续通过插件配置提供：

| 配置项 | 默认值 | 含义 |
| --- | --- | --- |
| `maxAttempts` | `500` | 最多保留的调用数。 |
| `rawRetentionAttempts` | `12` | 最多保留完整输入的近期调用数。 |
| `maxRawInputBytes` | `2000000` | 单次完整输入的 UTF-8 JSON 字节上限。 |
| `refreshMs` | `1500` | 面板定时查询间隔，单位为毫秒。 |
| `includeAuxiliary` | `true` | 包含会话压缩调用、标题生成调用和直接模型调用。 |
| `dashboard` | `true` | 提供现有 HTML 路由；关闭后原生面板的数据查询仍然可用。 |
| `pricing` | 未设置 | 币种及未缓存输入、缓存读取、缓存写入、输出的每百万 Token 单价。 |

desktop 的 `cachescope` 设置覆盖插件配置中的 `recordingEnabled`、`captureInput` 和 `logAttempts`。完整输入留存数量不能超过调用留存数量。查询接口继续检查回环来源、Host 和同源访问。

## 开发与验证

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm pack --ignore-scripts
```

Client 产物由 desktop 模块加载器加载，不是独立网页。目标运行环境、测试和集成结果见[兼容性验证](docs/desktop-compatibility.md)。

## 许可证

MIT
