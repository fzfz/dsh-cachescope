# CacheScope

English | [中文](README.zh.md)

CacheScope is a prompt-cache observability plugin for DeepSeek Harness. It records each `llm/stream` attempt, combines normalized provider usage with a local comparison of adjacent DSH logical inputs, and serves a desktop dashboard without changing the model request or registering a model-visible tool.

## Install

Install the bundle into a Web profile and start that profile:

```sh
dsh plugin --profile web add @kober-basket/dsh-cachescope
dsh web
```

Open [http://127.0.0.1:3080/cachescope](http://127.0.0.1:3080/cachescope). The installable bundle retains the latest bounded complete logical inputs and excludes auxiliary title, compaction, and direct calls, so its table represents AgentLoop conversations.

To disable prompt-text retention, add this row to the profile's `cordis.patch.yml` and restart DSH:

```yaml
- id: cachescope
  name: '@kober-basket/dsh-cachescope'
  config:
    captureInput: metadata
    includeAuxiliary: false
```

## What it shows

- Provider-normalized Cache Read, uncached input, Cache Write, output, and weighted cache-read ratio.
- Per-attempt Call TTFT, median and P95 Call TTFT, total duration, status, purpose, provider, model, and optional cost estimate.
- Local prefix classification for unchanged input, append-only growth, system changes, tool changes, and rewritten history.
- A lazily expanded JSON hierarchy that marks stable candidates, the first local difference, downstream content, and regions without a comparable baseline.
- Session, provider, model, purpose, and lifecycle-status filters that recompute the visible summary while retaining retries as separate attempts.
- Copyable filtered diagnostic metadata for issues and discussions without complete prompt content.

## How to read the evidence

The token bar is provider evidence. Cache Read is displayed only when the adapter carries that usage field; an omitted field is not treated as zero. The uncached bucket is the adapter's normalized input token count, and cost appears only when all rates are configured.

The JSON colors are DSH-side inference. CacheScope compares the current logical input only with the preceding in-process call from the same Session and purpose. An unchanged region is a cache-friendly prefix candidate, not proof that the provider used it as a cache key or served those exact tokens from cache.

Call TTFT starts when CacheScope begins iterating the model stream and ends at the first non-empty token. It includes queueing and network time, so it is a Prefill proxy rather than isolated Prefill duration.

## Configuration

The table lists the plugin schema defaults. The installable bundle overrides `captureInput` to `full` and `includeAuxiliary` to `false`; a profile's own patch remains authoritative.

| Key | Default | Effect |
|---|---:|---|
| `captureInput` | `metadata` | Retain fingerprints and metrics only, or bounded exact logical inputs with `full`. |
| `maxAttempts` | `500` | Maximum model-call attempts retained in memory. |
| `rawRetentionAttempts` | `12` | Maximum recent attempts that may retain complete inputs. |
| `maxRawInputBytes` | `2000000` | Maximum UTF-8 JSON bytes retained for one complete input. |
| `refreshMs` | `1500` | Dashboard polling interval in milliseconds. |
| `logAttempts` | `true` | Print a metadata-only summary after each attempt. |
| `includeAuxiliary` | `true` | Include compaction, title generation, and direct model calls. |
| `dashboard` | `true` | Register the dashboard when a loopback WebServer is available. |
| `pricing` | unset | Optional currency and per-million rates for uncached input, Cache Read, Cache Write, and output. |

## Data handling

- Every record is process-local memory and disappears when DSH stops.
- Metadata fingerprints use a random per-process HMAC key and cannot be compared across restarts.
- The installable bundle retains complete System Prompt, tool schemas, and messages within both count and byte limits; set `captureInput: metadata` to disable prompt-text retention.
- Polling responses contain metadata only; the browser fetches the selected complete input through a separate endpoint and reuses it while the fingerprint is unchanged.
- Dashboard registration requires a WebServer bound to `127.0.0.1`; each request must also be loopback and same-origin.

## Limits

- Provider usage exposes token totals, not provider cache keys or token offsets.
- The local comparison cannot observe calls from another process or calls evicted before this plugin saw them.
- Capture occurs before provider-specific serialization, so the exact wire payload may differ.
- Call TTFT is not a direct measurement of provider Prefill execution time.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## License

MIT
