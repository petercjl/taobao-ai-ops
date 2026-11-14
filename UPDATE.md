# 更新淘宝 AI 运营工具集

把以下提示词发送给当前使用的 Agent：

> 更新 @petercjl/taobao-ai-ops 及其成员包。

已在 sealwork 订阅并启动时，默认每六小时检查壳和全部成员。即使壳版本没有变化，成员也会独立检查。管理员新增成员后发布成员包、登记清单并发布壳；既有成员更新只发布该成员即可。普通业务调用使用已经选定的版本。

自动安装稳定兼容版本：1.x 及以上保持主版本，0.x 保持次版本，拒绝降版。跨兼容边界保留当前版本，并在插件详情报告需要显式选择的版本。关闭自动更新时冻结当前集合；停止时取消发现与自动检查，保留代码以便再次启动；移除清理该订阅自己的代码。

宿主安装完整候选后，在任务和审批空闲时切换并刷新 Skill。下载失败、离线、候选验证失败、用户修改过受管 Skill 或宿主刷新失败时，保留上一套。更新只涉及选定宿主的订阅目录，配置和凭据留在包外。插件详情显示实际成员版本及上次检查结果。

开发者：每次检查都以当前壳的注册表为准，与 previous 回执比较成员身份、版本和所需 Skill；`collection prepare` 返回独立候选，宿主验证后才激活。回执中的运行环境必须跟随 CLI 调用，当前任务内保持同一版本。新集合入口不接管历史全局 npm 安装；历史安装继续通过其已声明的维护入口操作。

开发者：迁移已批准的跨兼容版本组件时，在collection check/prepare中显式传入 `--accept-component-upgrades ID,ID` 并保留previous回执。该参数仅批准列出的组件升级，不批准降级；其余不兼容组件继续保留原版本。DMP快照v2迁移选择 `tbcli,dmp-product-report`，候选doctor通过后再激活。

开发者：当前宿主解析 Skill 父目录后通过 `--target-dir` 明确传入；任意有效 Agent 标识均使用 generic 适配。`skill install/update --owned` 仅同步套件自有路由 Skill，其 `.runtime/bin/taobao-ai-ops.mjs` 是目标独占入口。完整成员使用 collection prepare 的宿主独占版本目录。历史 link 模式迁移为实体副本并保留备份。版本与 SHA-256 核验后，由宿主确认发现；未确认时为 pending。

## Component release channels

Hosts default to latest and may explicitly select next for an individual registered component. `collection check` and `collection prepare` accept `--component-channels` with a JSON mapping such as `{"cloud-hug-style-transfer":"next"}`. A channel-switch transaction retains other existing component versions; ordinary whole-collection updates continue to check them. The receipt records each selected channel; subsequent checks retain it. An explicit channel switch authorizes selecting that channel's version, including a return from a prerelease to a lower stable version. Same-channel downgrades remain blocked. A missing next release returns CHANNEL_UNAVAILABLE and preserves the active collection. Hosts activate one verified generation and keep one discoverable Skill entry per logical name.
