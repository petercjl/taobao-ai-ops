# 淘宝 AI 运营套件

面向员工的统一管理入口。研究 Skill 和工具插件各自拥有独立 npm 包、源码和发布版本；套件只维护组件清单、安装更新、Skill发现与业务路由。

## 安装与更新

```sh
npm install --global @petercjl/taobao-ai-ops
taobao-ai-ops components install --agent codex --yes --json
taobao-ai-ops doctor --json
taobao-ai-ops update check --json
taobao-ai-ops update install --agent codex --yes --json
```

SealSeek 用户改用 --agent sealseek。目标有歧义时通过 SEALSEEK_SKILLS_DIR 指定。已有非套件管理的 Skill 会阻止覆盖；明确授权迁移后用 --adopt，保留完整备份。本地修改会阻止更新。

首次安装会获取清单中全部独立组件的正式 latest。统一更新检查套件及每个组件：套件版本不变也会更新组件。已安装组件的 Skill 同步可用 skill update；该命令只同步本地安装内容，不查询注册表。日常业务调用不更新环境，任务中保持已安装版本。

组件在用户状态目录中独立安装，不随套件自身重新安装而被删除。更新先准备新安装目录，核对包身份、版本与 CLI 返回的 Skill 来源，再同步受管理 Skill。npm、来源验证或 Skill 同步失败时保留旧组件记录；Skill 同步有完整备份和恢复机制。离线检查失败时报告并保留当前环境。

## 组件

- @petercjl/yuce-category-opportunity-report：24个月类目数据与相对容量路线、增长分析、双视图 HTML。
- @petercjl/taobao-search-product-form：搜索结果数据和商品形态研究、机会判断卡及 HTML。
- @petercjl/tbcli：淘宝数据与 NAS 数据库工具，含其独立 Skill。
- @petercjl/sycmcli：店铺经营数据工具，含其独立 Skill。
- @petercjl/commerce-ui：通用 HTML 报告 Skill、模板、渲染与校验。调用 `taobao-ai-ops component run html-report ...`；Python 依赖不足时通过该入口执行 `runtime install --yes`。
- taobao-ai-operations：套件自带的管理与业务路由 Skill。

yccli 为取数时按需准备的外部工具，可用 TAOBAO_AI_OPS_YCCLI 指定；Excel 分析不需要 NAS、VPN 或平台登录。账号与授权留在包外，安装不会获得服务权限。

## 调用与开发

```sh
taobao-ai-ops components status --json
taobao-ai-ops components check --json
taobao-ai-ops skill source --name yuce-category-opportunity-report --json
taobao-ai-ops script category-research build_report.py --help
taobao-ai-ops tool run tbcli capabilities --json
```

维护者分别发布各能力包的正式 latest。新增/移除组件或调整管理机制时才发布套件。源码开发可通过 components register --name ID --path CHECKOUT --yes 注册独立组件；开发记录由 Git 管理，不会被注册表更新覆盖。已安装 npm 组件的显式接入可加 --mode npm。源码套件自身通过 Git 更新。

Node >=20。Python 研究依赖通过稳定解释器准备；TAOBAO_AI_OPS_PYTHON 可指定已配置解释器。脚本和报告模板来自实际组件目录。原生图片理解由当前 Agent 提供；缺失时报告而非缩减流程。

本地 macOS 确定性安装、更新与恢复测试单独记录；Windows/SealSeek 的真实宿主安装和端到端行为尚待验证。CI 发布前须先有可安装的类目独立包；所有发布通过 GitHub Actions OIDC。
