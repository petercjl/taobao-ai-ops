# 淘宝 AI 运营套件

面向员工的统一管理入口。研究 Skill 和工具插件各自拥有独立 npm 包、源码和发布版本；套件只维护组件清单、安装更新、Skill发现与业务路由。

## 安装与更新

将提示词发送给准备使用的 Agent，安装与检查由 Agent 完成。

> 请安装 npm 包 @petercjl/taobao-ai-ops。

> 请更新 npm 包 @petercjl/taobao-ai-ops。

> 检查 taobao-ai-ops 的安装和组件是否可用。

支持 Codex、SealSeek 和 WorkBuddy；Agent 解析对应的实际技能目录。已有非套件管理的 Skill 会阻止覆盖；明确授权迁移后用 --adopt，保留完整备份。本地修改会阻止更新。

首次安装会获取清单中全部独立组件的正式 latest。统一更新检查套件及每个组件：套件版本不变也会更新组件。已安装组件的 Skill 同步可用 skill update；该命令只同步本地安装内容，不查询注册表。日常业务调用不更新环境，任务中保持已安装版本。

组件在用户状态目录中独立安装，不随套件自身重新安装而被删除。更新先准备新安装目录，核对包身份、版本与 CLI 返回的 Skill 来源，再同步受管理 Skill。npm、来源验证或 Skill 同步失败时保留旧组件记录；Skill 同步有完整备份和恢复机制。离线检查失败时报告并保留当前环境。

## 组件

- @petercjl/yuce-category-opportunity-report：24个月类目数据与相对容量路线、增长分析、双视图 HTML。
- @petercjl/taobao-search-product-form：搜索结果数据和商品形态研究、机会判断卡及 HTML。
- @petercjl/dmp-product-report：商品资料、经营、推广与新老客成交结构分析，自包含HTML报告；依赖套件管理的tbcli。
- @petercjl/tbcli：淘宝数据与 NAS 数据库工具，含其独立 Skill。
- @petercjl/sycmcli：店铺经营数据工具，含其独立 Skill。
- @petercjl/commerce-ui：通用 HTML 报告 Skill、模板、渲染与校验。调用 `taobao-ai-ops component run html-report ...`；Python 依赖不足时通过该入口执行 `runtime install --yes`。
- @petercjl/procli：项目 SOP、任务依赖与成果归档，配套 `project-management` Skill。任务卡组织工作，项目 Wiki 积累可复用的证据与结论。
- @petercjl/sealseek-media-cli：生图、生视频、已有素材贴入及画板操作，配套 `sealseek-media` Skill。应用层负责素材选择与布局；接入不修改宿主的默认生图生视频路由。该组件需要 Node.js >=22。
- @petercjl/cloud-hug-style-transfer：抱抱云朵社品牌视觉转换，提供完整品牌素材、人物设定、摄影排版方法和效果验收流程。实际生图需要宿主参考图编辑能力。
- taobao-ai-operations：套件自带的管理与业务路由 Skill。

yccli 为取数时按需准备的外部工具，可用 TAOBAO_AI_OPS_YCCLI 指定；Excel 分析不需要 NAS、VPN 或平台登录。账号与授权留在包外，安装不会获得服务权限。

## 项目主线与知识复用

procli 是跨业务节点的公共能力：先读取项目的任务与已编译 Wiki，确定本次研究问题，再调用对应的独立研究工具；用户授权归档后，通过 `task publish` 将完整成果关联到指定项目和任务，供下一阶段读取。

任务卡保存工作说明、责任人、依赖、状态和验收要求；钉钉文档与可选 HTML 面向人；完整报告 Wiki 与节点累计知识面向 Agent，保留数据口径、观察窗口、来源、分歧和待验证问题。普通 `task update` 只编辑任务字段；成果发布需要内容包与独立授权，报告完成也不等于任务已审批。

```sh
taobao-ai-ops skill source --name project-management --json
taobao-ai-ops tool run procli directory list --json
taobao-ai-ops component run procli knowledge index --project "项目名称" --json
```

向 Agent 明确说“用 procli”，并指定项目、任务及读取或归档目标。按当前 `project-management` Skill 解析真实名称和目标环境。项目读写需项目服务授权；发布钉钉文档还需官方 dws 与对应权限。服务不可访问时报告原目标错误并停止该操作，已有 Excel 研究可独立进行。套件不自动创建所有 SOP 任务、执行整条业务链或向项目写入研究结果；现有项目的真实 SOP 与依赖以 procli 读取结果为准。

## 开发者合同参考：调用与开发

```sh
taobao-ai-ops components status --json
taobao-ai-ops components check --json
taobao-ai-ops skill source --name yuce-category-opportunity-report --json
taobao-ai-ops script category-research build_report.py --help
taobao-ai-ops tool run tbcli capabilities --json
taobao-ai-ops skill source --name sealseek-media --json
taobao-ai-ops component run sealseek-media capabilities --json
```

维护者分别发布各能力包的正式 latest。新增/移除组件或调整管理机制时才发布套件。源码开发可通过 components register --name ID --path CHECKOUT --yes 注册独立组件；开发记录由 Git 管理，不会被注册表更新覆盖。已安装 npm 组件的显式接入可加 --mode npm。源码套件自身通过 Git 更新。

Node >=20。Python 研究依赖通过稳定解释器准备；TAOBAO_AI_OPS_PYTHON 可指定已配置解释器。脚本和报告模板来自实际组件目录。原生图片理解由当前 Agent 提供；缺失时报告而非缩减流程。

本地 macOS 确定性安装、更新与恢复测试单独记录；Windows/SealSeek 的真实宿主安装和端到端行为尚待验证。CI 发布前须先有可安装的类目独立包；所有发布通过 GitHub Actions OIDC。

The independent `competitor-visual-canvas` component collects Taobao/Tmall visual media into regional Infinite Canvas or explicitly selected Boardmix Frames. Boardmix uses the independent `@petercjl/boardmixcli` component for browser/login recovery, image and native-video imports, and explicit object operations. The shell installs the full dependency closure and forwards its registered capability entries to the application. Select its node for new collection or append; it owns application layout/state and uses the registered capability dependencies. WorkBuddy accepts the same suite lifecycle through `--agent workbuddy`; host execution evidence remains separate.

## Audio production

The `seedaudio-tools` node registers the independent `@petercjl/seedaudiocli` package and its canonical `seedaudiocli` Skill. Install with `taobao-ai-ops skill install --agent codex --name seedaudiocli` (or the actual SealSeek target). Discover its source with `taobao-ai-ops skill source --name seedaudiocli --json`, read the complete current Skill and relative resources, then invoke `taobao-ai-ops component run seedaudiocli ...` or `tool run seedaudiocli ...`. Return task IDs and output files to the caller's audio acceptance flow. A missing component requires `components install --agent AGENT --yes`; missing credentials require importing the administrator-provided file through the component CLI.

Before every audio component invocation, the suite checks stable latest, installs a newer component into a separate generation and synchronizes registered managed Skill targets. Configuration and task history remain in user directories. Registry/install failures retain the previous version. Local development checkouts remain Git-managed. `TAOBAO_AI_OPS_AUTO_UPDATE=0` pins the installed set for a specific run. Other components keep their declared update policy. The suite owns installation and invocation; the audio package owns provider integration, validation, authentication, generation and recovery. Prompts and output acceptance belong to the caller.

## 1688 components

- `1688cli`: atomic read-only product/supplier query and explicit filtering.
- `1688-product-sourcing`: keyword/reference-image sourcing application.
- `1688-opportunity-sourcing-research`: six-category portfolio application from compatible opportunity handoffs.

Each component is an independent `@petercjl` npm package with its own canonical Skill. Use `skill source --name NAME`, `component run NAME ...`, or `tool run 1688cli ...`. The research profile includes all three and their Skill dependency closure. `components install --agent workbuddy --yes` supports the WorkBuddy managed target, alongside Codex and SealSeek; runtime QA remains host-specific.

## 抱抱云朵社品牌视觉制作

安装或更新套件时，独立组件 `@petercjl/cloud-hug-style-transfer` 纳入统一管理，仍保留独立版本和维护来源。已有套件用户更新后即可发现该节点。附上待转换图片；商品关键结构或文案不清楚时补充实拍或准确文字。

> 用抱抱云朵社风格转换处理所附图片。

只需要规划时：

> 用抱抱云朵社风格转换，为所附图片做转换规划。

套件检查组件来源与素材完整性，子 Skill 按当前品牌方法执行。Codex、SealSeek、WorkBuddy 的实际生成能力以各自宿主预检为准，安装成功不代表生成效果已验证。套件不复制该组件的品牌图片、方法或提示词；独立包的兼容更新通过显式套件更新进入。


## 达摩盘商品经营报告

> 用dmp-product-report分析商品【商品ID】，生成完整HTML报告。

当前Agent通过 `dmp-product-report` 节点加载独立报告Skill，按需确认本店锚点。商品资料从橙色淘宝买家浏览器读取，DMP统计从蓝色商家电商浏览器读取；报告包含5张主图、店铺与页面指标，以及经营、推广、人群的四周期对比和8周趋势。子应用负责分析方法、独立模板、原始证据与最终校验。套件统一管理报告包和tbcli，保留独立包的升级边界。

开发者入口：`taobao-ai-ops doctor --node dmp-product-report --json`、`taobao-ai-ops component run dmp-product-report ...`。
