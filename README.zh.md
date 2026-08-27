# CacheScope

[English](README.md) | 中文

CacheScope 是 DeepSeek Harness 的提示词缓存可观测插件。它记录每次 `llm/stream` 调用，结合提供方标准化 usage 与相邻 DSH 逻辑输入的本地比较，并在不修改模型请求、不注册模型可见工具的前提下提供桌面诊断页。

## 安装

将组合包安装到 Web profile，然后启动该 profile：

```sh
dsh plugin --profile web add @kober-basket/dsh-cachescope
dsh web
```

打开 [http://127.0.0.1:3080/cachescope](http://127.0.0.1:3080/cachescope)。可安装组合包会保留近期受限的完整逻辑输入，并排除标题、压缩和直接调用，因此表格只表示 AgentLoop 对话。

如需禁止保留提示词正文，请将以下配置项加入 profile 的 `cordis.patch.yml`，然后重启 DSH：

```yaml
- id: cachescope
  name: '@kober-basket/dsh-cachescope'
  config:
    captureInput: metadata
    includeAuxiliary: false
```

## 展示内容

- 提供方标准化的 Cache Read、未缓存输入、Cache Write、输出以及按 token 加权的缓存读取占比。
- 每次调用的 Call TTFT、中位与 P95 Call TTFT、总耗时、状态、用途、提供方、模型和可选成本估算。
- 对未变化输入、仅追加增长、系统提示词变化、工具变化和历史改写的本地前缀分类。
- 惰性展开的 JSON 层级，标记稳定候选、本地首个差异、下游内容以及没有可比较基线的区域。
- Session、用途和调用状态筛选会重新计算当前可见汇总，并将每次重试保留为独立调用。
- 可复制当前筛选的诊断元数据用于 Issue 与 Discussion，不包含完整 Prompt 正文。

## 如何理解证据

Token 条展示提供方证据。只有适配器携带对应 usage 字段时才展示 Cache Read；字段缺失不按零处理。未缓存区间是适配器标准化后的输入 token 数，只有配置全部单价后才展示成本。

JSON 颜色是 DSH 侧推断。CacheScope 只将当前逻辑输入与同一 Session、同一用途的上一条进程内调用比较。未变化区域是有利于缓存的前缀候选，但不能证明提供方将其作为 cache key，也不能证明这些具体 token 来自缓存。

Call TTFT 从 CacheScope 开始迭代模型流时计时，到首个非空 token 结束。它包含排队和网络耗时，因此只是 Prefill 代理指标，而不是独立的 Prefill 耗时。

## 配置

下表列出插件 schema 默认值。可安装组合包会将 `captureInput` 覆盖为 `full`，将 `includeAuxiliary` 覆盖为 `false`；profile 自己的 patch 始终具有最终决定权。

| 配置键 | 默认值 | 作用 |
|---|---:|---|
| `captureInput` | `metadata` | 只保留指纹和指标；设置为 `full` 时保留受限的完整逻辑输入。 |
| `maxAttempts` | `500` | 内存中最多保留的模型调用次数。 |
| `rawRetentionAttempts` | `12` | 最多允许保留完整输入的近期调用次数。 |
| `maxRawInputBytes` | `2000000` | 单次完整输入允许保留的最大 UTF-8 JSON 字节数。 |
| `refreshMs` | `1500` | 诊断页轮询间隔，单位为毫秒。 |
| `logAttempts` | `true` | 每次调用后输出一条仅含元数据的摘要。 |
| `includeAuxiliary` | `true` | 纳入压缩、标题生成和直接模型调用。 |
| `dashboard` | `true` | 存在回环 WebServer 时注册诊断页。 |
| `pricing` | 未设置 | 用于未缓存输入、Cache Read、Cache Write 和输出的可选币种及每百万 token 单价。 |

## 数据处理

- 所有记录只存在于进程内存，DSH 停止时全部消失。
- 元数据指纹使用每个进程随机生成的 HMAC 密钥，无法跨次启动比较。
- 可安装组合包会在数量与字节上限内保留完整系统提示词、工具 schema 和消息；设置 `captureInput: metadata` 可禁止保留提示词正文。
- 轮询响应仅包含元数据；浏览器通过独立接口读取当前选中的完整输入，并在指纹未变化时复用结果。
- 只有 WebServer 绑定到 `127.0.0.1` 时才注册诊断页；每个请求还必须来自回环地址并满足同源检查。

## 限制

- 提供方 usage 只给出 token 总量，不提供 cache key 或 token offset。
- 本地比较无法观察其他进程的调用，也无法观察插件开始记录前已经被淘汰的调用。
- 捕获发生在提供方专用序列化之前，因此实际协议请求可能不同。
- Call TTFT 不是提供方 Prefill 执行时间的直接测量值。

## 开发

```sh
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## 许可证

MIT
