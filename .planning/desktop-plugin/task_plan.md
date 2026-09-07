# 必须要实现的目标
将 CacheScope 改为 DSH Desktop 原生插件，提供侧栏诊断入口、设置页和记录开关，并明确支持的 Desktop 与 Harness 版本。

# 验收清单
- 已完成：独立 worktree、实施方案和方案语义审核。
- 已完成：Host 记录开关、原生 Client、安装包构建和中英文 README。
- 已完成：Desktop 0.1.1 提交 f2a27b4 与 Harness 0.1.2-rc.1 的接口对比，以及隔离宿主安装和界面验证。
- 最终验证结果见 docs/desktop-compatibility.md。

# 非本次目标
本次不修改正式 Desktop 配置，不发布软件包，不修改 Electron 主进程。

# 已获得的授权
用户已批准方案实施、固定版本依赖安装及测试，并要求核对 Desktop 与 Harness 兼容性。用户随后授权创建 PR 并合入 main。
