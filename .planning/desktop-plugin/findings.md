# 当前项目事实
CacheScope 已是 DSH bundle，保留内存调用记录、可选完整输入，并默认输出调用摘要日志。现有页面通过 /cachescope 访问。
# 宿主事实
dsh-desktop 启动随机回环端口的 Harness，已有插件安装和恢复机制。
# 用户补充要求
用户要求 CacheScope 页面采用 desktop 原生 UI 和交互。实施方案必须使用宿主控件、主题和页面容器。
# 目标源码证据
本机 dsh-desktop-opencode-session-20260907 的 fork remote 指向用户指定仓库，当前提交 f2a27b4461e8c15d21268533efb7b99bb9bb14f2。目标 package.json 使用 Harness 0.1.2-rc.1，dshmarket 展示 client 导出、模块工厂、设置插槽及 settings.register/get/watch 的接入方式。
# 调查异常
GitHub clone 因 SSL 连接失败退出。改用官方 raw 页面核对依赖版本，并只读检查本机目标仓库与 node_modules。未安装依赖或执行目标项目。
# 方案结论
采用 Host + Client 插件。左侧通过 sidebar.footer.action 添加入口，shell.overlay 内使用原生 Modal 展示诊断面板，settings.section 提供独立设置页。宿主 layout 未提供通用主内容页导航接口，方案明确面板不等于聊天主区路由页。
# 记录开关语义
停止新增与更新记录、停止分析与摘要日志，保留历史记录，清空比较基线，旧流在重新开启后不恢复记录。完整输入留存关闭时清理 Host 与 Client 原文。
