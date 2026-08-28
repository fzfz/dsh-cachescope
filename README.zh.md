# CacheScope

[English](README.md) | 中文

**看懂一次模型调用究竟命中了多少 Prompt Cache，以及没命中时输入哪里变了。**

CacheScope 将 Provider 回传的缓存 Token 用量与相邻 DSH 逻辑输入的变化放在同一页。它记录观察到的 `llm/stream` 调用，并在不修改模型请求、不注册模型可见工具的前提下提供桌面诊断页。

![CacheScope 诊断页：Provider 缓存用量、相邻输入变化与层级输入检查器](assets/cachescope-dashboard.jpg)

*截图使用合成调用数据，Provider 数字仅用于展示。*

## 安装

将组合包安装到 Web profile，然后启动 DSH：

```sh
dsh plugin --profile web add @kober-basket/dsh-cachescope
dsh web
```

打开 [http://127.0.0.1:3080/cachescope](http://127.0.0.1:3080/cachescope)。

> **Prompt 隐私提醒：**安装包默认启用 `captureInput: full`。默认情况下，DSH 进程内存最多保留最近 12 次完整逻辑输入，每次上限为 2,000,000 UTF-8 JSON 字节。如不需要检查完整输入，请在发送敏感 Prompt 前改为下面的仅元数据配置。

```yaml
- id: cachescope
  name: '@kober-basket/dsh-cachescope'
  config:
    captureInput: metadata
```

修改 profile 后请重启 DSH。

## 快速开始：比较两轮会话

1. 在一个 DSH 对话中发送第一条消息，建立本地比较基线。
2. 在同一 Session 中发送第二条消息，期间不要更换 Provider、模型、System Prompt 或已启用工具。
3. 在 CacheScope 中选择第二次对话调用。先看顶部该调用的 Provider Cache Read 比例，再检查相邻输入诊断和带颜色的输入树。

插件观察到的第一次调用没有本地比较基线。如果 Provider adapter 没有携带 Cache Read usage 字段，Cache Read 也会保持“未报告”；字段缺失不按零处理。

表格初始只筛选对话调用。清空用途筛选即可纳入标题生成、压缩和直接模型调用。

## 可以诊断什么

- 单次调用有多少 Prompt 被报告为 Cache Read，以及未缓存输入、Cache Write、输出和当前筛选内仍保留调用的 Token 加权聚合。
- 相邻可比较调用的未缓存 Token 桶为何变化：`本次未缓存 = 上次未缓存 + ΔPrompt − ΔCache Read − ΔCache Write`。
- DSH 逻辑输入是完全相同、仅末尾追加，还是发生了 System、Tools、路由或参数变化以及历史改写。
- 哪些输入区域是稳定前缀候选、本地首个差异、受前置变化影响的下游区域，或没有可比较基线的区域。
- Call TTFT、中位和 P95 Call TTFT、总耗时、状态、用途、Provider、模型、重试和可选本地成本估算。
- Session、Provider、模型、用途、生命周期和证据筛选，诊断排序、实时跟随，以及用于 Issue 或 Discussion 的可复制元数据。

## 如何理解证据

| 证据 | 来源与含义 | 不代表 |
|---|---|---|
| 选中调用的 `Cache Read / Prompt` | DSH adapter 对该次调用 Provider usage 的标准化结果。 | 本地 Diff 比例或 DeepSeek 控制台聚合。 |
| 当前筛选的加权比例 | 对当前仍保留且可见、并携带 Cache Read 的调用计算 `Σ Cache Read / Σ Prompt`。 | Provider 控制台可能采用的不同时间窗口和调用集合。 |
| 未缓存输入 | Adapter 标准化后的未缓存输入 Token 桶。 | 回复长度，或本轮新增、变化的 Token 数量。 |
| 输入树颜色 | 与同一 Session、同一用途的上一条进程内调用比较。 | Provider 将某区域用作 cache key，或这些具体 Token 确实来自缓存。 |
| Token 对账 | 解释相邻已报告 Token 桶如何变化的算术关系。 | Provider cache key、Token offset 或缓存决策原因。 |
| Call TTFT | 从 CacheScope 开始迭代模型流到首个非空 Token 的时间。 | 独立的 Provider Prefill 耗时；其中还包含排队和网络时间。 |

Output Token 不进入任何缓存比例。输入层级展示 Provider 专用序列化之前捕获的 DSH 逻辑模型输入，因此可能与实际 wire payload 不同。

## 配置

Schema 默认值用于直接挂载插件的场景。发布的可安装组合包只会将 `captureInput` 覆盖为 `full`；profile 自己的 patch 始终具有最终决定权。

| 配置键 | Schema 默认值 | 安装包实际值 | 作用 |
|---|---:|---:|---|
| `captureInput` | `metadata` | `full` | 只保留指纹和指标，或保留受限的完整逻辑输入。 |
| `maxAttempts` | `500` | `500` | 进程内存中最多保留的调用次数，超出后淘汰旧调用。 |
| `rawRetentionAttempts` | `12` | `12` | 最多允许保留完整输入的近期调用次数。 |
| `maxRawInputBytes` | `2000000` | `2000000` | 单次完整输入允许保留的最大 UTF-8 JSON 字节数。 |
| `refreshMs` | `1500` | `1500` | 诊断页轮询间隔，单位为毫秒。 |
| `logAttempts` | `true` | `true` | 每次调用后输出一条仅含元数据的摘要。 |
| `includeAuxiliary` | `true` | `true` | 纳入压缩、标题生成和直接调用。 |
| `dashboard` | `true` | `true` | WebServer 绑定到回环地址时注册诊断页。 |
| `pricing` | 未设置 | 未设置 | 用于本地成本估算的可选币种与每百万 Token 单价。 |

### 可选价格配置

请按当前 Provider 价格表填写全部四项费率；CacheScope 不内置或更新价格表。

```yaml
- id: cachescope
  name: '@kober-basket/dsh-cachescope'
  config:
    pricing:
      currency: CNY
      uncachedInputPerMillion: 0 # 请替换为当前费率
      cacheReadPerMillion: 0 # 请替换为当前费率
      cacheWritePerMillion: 0 # 请替换为当前费率
      outputPerMillion: 0 # 请替换为当前费率
```

在依赖成本估算前，请替换全部零值。CacheScope 使用标准化 usage 字段和你填写的数值；示例不包含任何当前或推荐 Provider 价格。

## 数据处理与本机访问

- 调用记录和保留的完整输入位于 DSH 进程内存中。DSH 进程停止后，服务端副本消失。
- 完整输入可能包含 System Prompt 正文、工具 schema、消息和请求参数。设置 `captureInput: metadata` 可禁止保留 Prompt 正文。
- 元数据指纹使用每个进程随机生成的 HMAC 密钥，无法跨次启动比较。
- 轮询响应只包含元数据。诊断页通过独立接口读取当前选中的完整输入，响应使用 `Cache-Control: no-store`，展示期间内容会保留在当前页面的 JavaScript 内存中。
- 点击**复制 JSON**还会将选中的完整输入写入操作系统剪贴板；在内容被替换或清除前，它可能比页面和 DSH 进程存在得更久。
- `logAttempts` 只输出元数据摘要；这些日志是否持久保存取决于宿主日志配置。
- 只有 DSH WebServer 绑定到 `127.0.0.1` 时才注册诊断页。请求必须来自回环地址、使用预期的 `127.0.0.1:<port>` Host，并在 Origin 和 `Sec-Fetch-Site` 请求头存在时通过检查。
- 这些检查用于降低浏览器跨站访问风险，不提供身份认证，也不能隔离能够构造合规回环请求的其他本机进程。

请将 `captureInput: full` 视为允许本机访问完整模型输入。

## 技术说明与限制

- Provider usage 只暴露 Token 总量，不提供 cache key 或 Token offset。前缀稳定只是诊断证据，不是 Provider 缓存结论。
- 本地比较无法观察其他进程、插件加载前或已从内存淘汰的调用。
- 插件优先使用 DSH 跨包共享的 AgentLoop 请求身份识别对话。对于身份注册表只在模块副本内有效的旧版 DSH，携带 Session id 的未分类请求按对话处理；没有 Session id 的未分类请求仍按直接调用处理。
- 每次重试作为独立调用保留。Call TTFT 是 Prefill 代理指标，不是 Prefill 执行时间的直接测量值。

## 卸载

```sh
dsh plugin --profile web remove @kober-basket/dsh-cachescope
```

修改 profile 后请重启 DSH。

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
