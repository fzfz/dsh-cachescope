# CacheScope for DSH Desktop

English | [中文](README.zh.md)

**CacheScope supports DSH Desktop only.** It adds a native sidebar entry, a diagnostic panel and a settings page to the desktop application. Standalone Harness CLI and browser deployments are not supported products.

## Supported versions

| Component | Supported target |
| --- | --- |
| DSH Desktop | [fzfz/dsh-desktop](https://github.com/fzfz/dsh-desktop), version **0.1.1**, revision **`f2a27b4461e8c15d21268533efb7b99bb9bb14f2`** |
| Bundled DeepSeek Harness | **0.1.2-rc.1** |
| Cordis / Schemastery | **4.0.2 / 3.18.2**, provided by that desktop |
| React / React DOM | **18.3.1**, provided by that desktop |

Compatibility is scoped to the revisions below; the desktop package version alone is insufficient.

| Desktop repository / revision | Bundled Harness | Compatibility result |
| --- | --- | --- |
| `fzfz/dsh-desktop@f2a27b4` (package version 0.1.1) | 0.1.2-rc.1 | Supported; isolated runtime installation and native UI verified |
| `dataelement/dsh-desktop@64e3dfe9cf92361b413782959170560b6491072d` (main, package version 0.1.1) | 0.1.2-rc.1 | Source interfaces match; upstream runtime integration has not been tested |
| Upstream release tag `v0.7.2` (package version 0.1.1) | 0.1.2-alpha.1 | Unsupported: does not satisfy the plugin's exact Host dependencies |
| Upstream release tag `v0.1.1` (package version 0.1.0) | 0.1.0-rc.6 | Unsupported: does not satisfy the plugin's exact Host dependencies |

Other revisions and release tags have not been validated. See the [compatibility report](docs/desktop-compatibility.md) for the upstream source comparison.

The plugin uses the desktop's settings service, Client module loader, UI controls and sidebar slots. It does not bundle another React runtime. Its Host dependencies use exact versions matching the target above.

## Install in DSH Desktop

Build a `.tgz` package from this repository, then install that package into the **web profile belonging to DSH Desktop**. Use the desktop plugin installer when it accepts a local package. The equivalent command uses the desktop's own bundled DSH entry and home directory:

```sh
DSH_HOME="<desktop Harness home>" node "<desktop bundled DSH entry>" \
  plugin --profile web add "/absolute/path/to/kober-basket-dsh-cachescope-0.1.2.tgz" --ignore-scripts
```

Restart DSH Desktop after installation. Installing into a separate global `dsh` profile does not install the plugin into the desktop.

## Open and use CacheScope

1. Click **CacheScope** in the desktop's left sidebar. The entry remains available when the sidebar is collapsed.
2. With recording enabled, send two messages in the same conversation.
3. Select a call to inspect provider-reported cache usage, timing and differences from the preceding comparable input.
4. Use the session, provider, model, purpose, status and evidence filters to narrow the list. The aggregate statistics reflect the filtered calls.

The panel uses native desktop controls and follows the desktop theme. Close it or press Escape to return to the previous conversation and draft. The retained `/cachescope` route is an existing diagnostic endpoint; users do not need to enter its URL.

## Recording settings

Open **Settings → CacheScope**.

| Setting | Default | Behavior |
| --- | --- | --- |
| Record model calls | On | Records cache usage, timing, input metadata and comparison baselines in process memory. |
| Retain complete inputs | On in the installable bundle | Retains complete logical inputs within the call-count and per-input size limits. Turning it off removes retained input text from the Host and open native panel. |
| Write call summaries to the desktop log | On | Writes metadata-only call summaries to the desktop logger. |

Changes save through desktop settings and apply immediately. Turning recording off stops new observations, input analysis and call-summary logging. Existing records remain visible; active records become **Recording stopped**. Existing desktop log lines remain unchanged.

Turning recording on records new calls only. Streams created before recording stopped cannot resume writing. The first new call has no comparison baseline. The two subordinate settings retain their saved values while recording is off. **Pause refresh** only pauses the panel's scheduled queries; it does not stop Host recording.

## Diagnostic features

- Provider Cache Read, Cache Write, uncached input, output and a token-weighted cache ratio.
- Per-call TTFT and duration, plus filtered median and P95 TTFT.
- Adjacent-input changes to System, tools, messages, model routing and request options.
- Token arithmetic explaining changes in the reported uncached input bucket.
- Input-tree colors for stable prefix, first change/addition, downstream regions and unavailable baselines.
- Complete input loading on selection, expandable JSON, retry and copying.
- Filtering, sorting by time, cache ratio or TTFT, following the newest call, manual refresh and copying filtered metadata.
- Optional cost estimates using explicitly configured prices.

Missing usage fields remain unreported, rather than becoming zero. Output tokens do not enter cache ratios. Input comparisons describe DSH logical input before provider serialization; their colors do not identify provider cache-hit positions. Call TTFT includes network and queueing time.

## Retention and advanced configuration

Call records disappear when the Harness process stops. Complete inputs can contain System text, tool schemas, messages and options. Copying an input writes it to the operating-system clipboard, where it can outlive the process.

The following composition settings remain available through the plugin configuration:

| Setting | Default | Meaning |
| --- | --- | --- |
| `maxAttempts` | `500` | Maximum retained calls. |
| `rawRetentionAttempts` | `12` | Maximum recent calls retaining complete inputs. |
| `maxRawInputBytes` | `2000000` | Maximum UTF-8 JSON bytes per retained input. |
| `refreshMs` | `1500` | Scheduled panel query interval in milliseconds. |
| `includeAuxiliary` | `true` | Include compaction, title generation and direct calls. |
| `dashboard` | `true` | Serve the existing HTML route; native-panel data queries remain available when false. |
| `pricing` | Unset | Currency and uncached-input, cache-read, cache-write and output rates per million tokens. |

The `cachescope` desktop settings namespace overrides composition values for `recordingEnabled`, `captureInput` and `logAttempts`. Complete input retention cannot exceed the retained-call limit. Query endpoints keep the existing loopback, Host and same-origin checks.

## Development and verification

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm pack --ignore-scripts
```

The Client artifact is built for the desktop module loader, not as a standalone web page. See [compatibility verification](docs/desktop-compatibility.md) for the target runtime, tests and integration results.

## License

MIT
