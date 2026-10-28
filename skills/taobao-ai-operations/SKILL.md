---
name: taobao-ai-operations
description: Route Taobao research, sourcing and Cloud Hug brand visual production to independently managed tools; preserve evidence handoffs and explicit project-management authorization.
---

# Taobao AI operations

Input: an operator's goal, supplied workbooks or authorized data sources, optional existing research and run directory. Output: the selected node's full deliverables, a versioned run plan and, when requested, an evidence-bound handoff. This suite implements category/product research, sourcing, DMP product operating reports and Cloud Hug brand visual production, with independently registered media/canvas tools. Other business requests require a matching registered node.

## Main line

1. For a Taobao/Tmall item ID requiring operating, promotion and new/returning-customer analysis, select `dmp-product-report`; its method and standalone report contract are below. Resolve other requested business results with `taobao-ai-ops nodes list --json`. A category/monthly market question uses `category-research`; a search-result workbook and concrete research object use `product-research`. Existing product scope can enter product research directly. If no supported node covers the request, report the missing node.
   An explicit request to use `procli` for project/task information, SOP progression, knowledge reuse or result publication uses `project-management`. Preserve this child's explicit-trigger contract; offering project integration does not authorize service reads or writes. For an authorized project-backed research request, resolve the project and read its task context and compiled Wiki before selecting the business research node. Preserve the target profile, exact project/task identities, observation windows, provenance and unresolved questions in the handoff.
   A supplied analysis or compatible ViewModel requiring a reusable HTML report uses `html-report`, whose exact Skill is `compact-commerce-ui`. It supplies reporting methods, not business conclusions; existing category/product outputs keep their own declared contracts.
   A Cloud Hug brand conversion request for supplied detail pages, photography, main KV or SKU images uses `cloud-hug-style-transfer`; its brand-production contract is below.
2. Run `taobao-ai-ops doctor --node NODE --mode excel --json` for local workbooks, or `--mode nas` for live category data. Doctor checks deterministic resources; verify any listed native capabilities in the active Agent before their stage. A missing dependency ends the affected node with its exact error.
3. Resolve the exact child Skill with `taobao-ai-ops skill source --name SKILL --json`. Read its complete current SKILL.md, load its platform adapter, then follow only the child node's current reference routes. The logical dependencies are `yuce-category-opportunity-report` (method contract `yuce-category-opportunity@2.0`) and `taobao-search-product-form` (imported method `0.1.1`). Their returned artifacts and source hashes are the handoff; resolution or contract failure stops with CAPABILITY_UNAVAILABLE or OUTPUT_CONTRACT_FAILED. Return here at step 4 after the child completes. Naming a Skill alone is not execution.
4. Preserve the child's analysis, full HTML and evidence files. Use `taobao-ai-ops workflow plan --run-dir NEW_DIR --node NODE --input WORKBOOK --json` when a durable suite plan is requested; this records a plan and fixed suite/method versions, not business completion. The product node's own stage ledger remains authoritative for its detailed execution.
5. For category-to-product handoff, obtain the selected full category path and explicit search query. Use `taobao-ai-ops handoff create --node category-research --input ANALYSIS.json --candidate FULL_PATH --query QUERY --out NEW_HANDOFF.json`. It preserves the selected evidence and its source hash. Request or obtain an authorized search-result workbook before running product research. Category growth retains its category/time grain; it is not a product-growth fact.
6. Deliver the complete child result and the current next research question. A handoff with missing input is needs_input; a plan or resource probe is not verified business output.

## Project continuity through procli

The registered component `procli` owns the exact `project-management` Skill and its live CLI contracts. Resolve it with `taobao-ai-ops skill source --name project-management --json`, read its complete current instructions, capabilities and active-platform adapter, then delegate through `taobao-ai-ops component run procli ...` or `taobao-ai-ops tool run procli ...`. Resolve its live version/capabilities. Contract: project intent plus exact resolved context and optional full research artifacts in; verified task/knowledge results and source-linked next questions out. Resolution, authentication or service failure ends only the affected project operation; report the selected target without switching profiles. Return to main-line step 4 after project reads or step 6 after publication.

Tasks organize SOP work, dependencies, responsibility and acceptance; Wiki preserves reusable knowledge across independent tools. Read compiled knowledge through the child's `knowledge index/query` flow; use `--reports` for full evidence tables, with compilation/freshness limits reported. Task metadata is not a substitute for knowledge. A next-stage request should carry the project/task, research question, evidence periods and known gaps rather than requiring the employee to repeat prior conclusions.

When the user explicitly authorizes archiving to an exact project/task, prepare the current child's publication bundle, preserving the complete report and its evidence, and use `task publish`: preview, inspect the target and coverage, then publish with the same bundle/key and verify readback. Existing sources require cumulative synthesis with source citations. The child owns DingTalk creation, optional HTML attachment, full report Wiki, cumulative node knowledge and task-card summary; the Agent owns evidence-based meaning. Handle partial/unknown writes only through the child's recovery flow. Ordinary `task update` is a field edit, and publication is separate from submission/reviewer approval. The shell neither copies these business rules into runtime code nor automatically executes every SOP node. New tools can join project workflows through these contracts while retaining independent analysis methods.

## SealSeek media and canvas capability

The `sealseek-media-tools` node registers `@petercjl/sealseek-media-cli` and its canonical `sealseek-media` Skill. For an explicitly routed SealSeek media/canvas operation, resolve `taobao-ai-ops skill source --name sealseek-media --json`, read the complete current Skill and active adapter, then discover the installed child contract through `taobao-ai-ops component run sealseek-media capabilities --json`. Invoke operations through that component entry, retaining the child's arguments and authorization requirements. Node.js 22+ is required for this component; installation does not authorize access to SealSeek.

Contract: explicit prompt/references or existing-media URLs, canvas identity, placement and operation authorization in; task/element identifiers, verified writes or structured errors out. Applications own asset selection, prompts, layouts and project state; the child owns service execution, authentication, validation and recovery. Provider and model selection follow the host/user policy. Registering this component changes no image/video default routes. Ordinary component calls retain installed versions; use the shell update path for managed components. Return to main-line step 4 with the operation result, or step 6 for a direct capability request. The independently released competitor-visual application is registered as `competitor-visual-canvas`.

## Execution and branches

Component scripts run via `taobao-ai-ops script NODE SCRIPT ...`; supplied Excel does not require platform accounts. Optional platform calls use `taobao-ai-ops tool run TOOL ...` so the shell selects the installed independent component. Accounts, warehouse access and write permissions remain external. The category child's database-consent and additive-import boundaries apply in its NAS route.

When a child was installed by the shell, forward its CLI examples through `taobao-ai-ops component run COMPONENT ...`, retaining all remaining arguments. This resolves the actual independent package even when its CLI is not on PATH or another global version exists. Use the shell's unified update entry for shell-managed components; a child's standalone global updater belongs only to independent global installations.

The shared HTML component is `@petercjl/commerce-ui`. Load `compact-commerce-ui` through named Skill source resolution, then invoke `taobao-ai-ops component run html-report ...` for template discovery, schema, rendering, validation and custom pack lifecycle. Inputs are source evidence and report intent or a live-contract ViewModel; outputs are a new JSON, HTML and validation results. Missing runtime/contract/browser capabilities retain the child's explicit failure boundary. Return to step 4 after reporting. Compatible shared improvements belong in that independent package; adding a component belongs in the shell registry.

The shell registers independent npm packages; each owns its method, resources and release. Ordinary tasks use installed versions. On an explicit install/update request, use `taobao-ai-ops skill install --agent AGENT` or `taobao-ai-ops update install --agent AGENT --yes`; the latter checks both shell and every registered component's stable latest version even when the shell is unchanged. Inspect returned versions and managed Skill state. Registry failure preserves current components; local edits stop synchronization. Missing components return COMPONENT_NOT_INSTALLED and require authorized installation before returning to step 2. Development registrations update through their Git owners and are reported separately. Skill source resolves to each component's own canonical package, not a shell copy.

Current node selection and source resolution are deterministic contracts, with method judgment owned by each child Skill. The package manifest is the node registry and shared contracts are maintained in the package's contracts directory. Do not load unrelated node methods at startup.

Missing native image observation stops product visual analysis; an unverified substitute cannot satisfy it. Changed upstream evidence invalidates its downstream comparison. Node-specific evidence disagreements are resolved by the child QA before returning to step 4.

## QA and maintenance

Confirm the selected node, actual source path, method version, source hashes and full output contract. Keep every Skill's tests independent and exercise suite installation, dependency closure and handoffs separately. Suite targets are implemented, with actual Agent/OS runtime evidence recorded separately. Clean-context regression requires an explicit user request. New business nodes enter the suite registry only with an independent I → S → O, execution and QA contract.

## Competitor visual collection

A request to collect product main images, main videos, SKU images and detail images into Infinite Canvas or explicitly requested Boardmix selects `competitor-visual-canvas`. Resolve `taobao-ai-ops skill source --name competitor-visual-canvas --json`, read its complete current Skill and active adapter, then follow its main line through `taobao-ai-ops component run competitor-visual-canvas ...`. The child accepts Taobao IDs or Taobao/Tmall links, owns the media manifest, four regional Frames per product, layout and append state, and returns source evidence, verified canvas URL and coverage gaps. Use competitor-visual-canvas 0.1.7+ with tbcli 0.11.1+ and boardmixcli 0.1.6+ for the Boardmix branch. The default target is Infinite Canvas; explicit Boardmix intent selects Boardmix. The shell installs both target capabilities and passes its registered CLI entries to the application. At runtime load only the selected target's current capability Skill: `tbcli` plus `sealseek-media` for Infinite Canvas, or `tbcli` plus `boardmixcli` for Boardmix. The application owns new collection, append, video backfill, layout, state and acceptance; the capability owns browser startup, login recovery and native media operations. Authentication, validation and writes stay with those capability packages. Missing collection or canvas capability stops the affected node with CAPABILITY_UNAVAILABLE; do not duplicate its integrations. Return to main-line step 4 for optional continuity or step 6 for delivery. Ordinary requests add to the child's selected existing canvas when asked to continue; new canvas creation follows the child's explicit user intent.

## Audio production

The `seedaudio-tools` node registers the independent `@petercjl/seedaudiocli` package and its canonical `seedaudiocli` Skill. Install with `taobao-ai-ops skill install --agent codex --name seedaudiocli` (or the actual SealSeek target). Discover its source with `taobao-ai-ops skill source --name seedaudiocli --json`, read the complete current Skill and relative resources, then invoke `taobao-ai-ops component run seedaudiocli ...` or `tool run seedaudiocli ...`. Return task IDs and output files to the caller's audio acceptance flow. A missing component requires `components install --agent AGENT --yes`; missing credentials require importing the administrator-provided file through the component CLI.

Before every audio component invocation, the suite checks stable latest, installs a newer component into a separate generation and synchronizes registered managed Skill targets. Configuration and task history remain in user directories. Registry/install failures retain the previous version. Local development checkouts remain Git-managed. `TAOBAO_AI_OPS_AUTO_UPDATE=0` pins the installed set for a specific run. Other components keep their declared update policy. The suite owns installation and invocation; the audio package owns provider integration, validation, authentication, generation and recovery. Prompts and output acceptance belong to the caller.

## 1688 货源与选品应用

按用户目标选择独立组件。单次关键词/图片/链接查询和明确筛选用 `1688cli`；从关键词或参考图形成商品库、视觉分类和报告用 `1688-product-sourcing`；从兼容 `product-opportunities.json` 形成六类策略组合用 `1688-opportunity-sourcing-research`。两项应用均通过原子能力获取平台事实，功能包只负责注册、依赖与安装更新。

执行前运行 `taobao-ai-ops skill source --name <精确Skill名称> --json`，完整读取返回路径的当前 SKILL.md，按其要求解析依赖和相对资源，执行它的主线后回到本路由的交付节点。缺少组件用 `components install --agent <agent> --yes`；契约不兼容保留错误并停止该分支。

输入输出：关键词/图找货应用接收用户需求和约束，交付 HTML、完整商品 JSON 和查询视觉证据；六类应用接收兼容机会交接文件，交付类别组合报告及 sourcing-candidates.json。只有输入契约实际兼容时才串联上游研究结果，不把其他 JSON 当作机会交接文件。

调用应用用 `taobao-ai-ops component run <component> <arguments...>`，原子查询可用 `taobao-ai-ops tool run 1688cli products search "关键词"`。应用方法和模板由各自 npm 包拥有，独立升级。

## 抱抱云朵社品牌视觉制作

用户要求把旧详情页、产品摄影、主 KV 或 SKU 转为抱抱云朵社品牌视觉，或按当前模特设定延展画面时，选择 `cloud-hug-style-transfer` 节点。它由独立 npm 包 `@petercjl/cloud-hug-style-transfer` 拥有；套件只负责安装更新、精确来源解析、调用与检查。

先通过 `taobao-ai-ops skill source --name cloud-hug-style-transfer --json` 获取规范来源，完整读取当前 SKILL.md，按其中节点加载本轮参考与当前宿主适配，再回到本套件主线。执行前运行 `taobao-ai-ops doctor --node cloud-hug-style-transfer --json`：它核对组件资源、完整性及必需的 sealseek-media-cli 依赖，宿主仍须核验实际看图、命令执行及结果交付能力。组件业务 CLI 通过 `taobao-ai-ops component run cloud-hug-style-transfer ...` 调用；生图由 @petercjl/sealseek-media-cli 及其当前规范 sealseek-media Skill 统一执行，品牌判断由应用负责。

输入为当次源图、商品依据和用户目标，可补充已确认文案、比例和版式要求。输出为本轮约定数量的独立成图及简短验收说明，或仅要求的转换规划。品牌方法、人物与产品约束、素材选择、摄影与排版顺序、提示词、任务恢复及效果验收由子 Skill 的当前主线承接。遇到来源/合同不兼容、缺失资产或宿主能力不可用时，保留子层结构化错误并停止受影响阶段；满足条件后回到子层执行节点，完成后返回套件主线第 6 步交付。

独立包与素材不复制到套件。普通业务使用已安装版本；显式套件更新获取该组件的正式 latest 并同步受管 Skill。本应用依赖 sealseek-media-cli（0.6.1+）和配套 sealseek-media Skill；缺失或不兼容时暂停整个应用任务，给出“请安装 npm 包 @petercjl/sealseek-media-cli。”，安装并复查通过后恢复。模型和服务授权遵循媒体包当前合同，其他应用的生图路由保持各自合同。


## 宿主管理的能力集合

当前宿主通过能力集合订阅安装时，宿主提供的 collection-runtime 回执声明本任务的 runtimeEntry 与 environment。调用所选 CLI 时使用该入口和环境，依照当前 Skill 完成业务；壳通过自己的组件记录解析成员。业务期间保持该版本集合。安装、定期更新、启停、移除和热刷新由宿主订阅管理；本 Skill 负责业务路由及子 Skill 的完整当前主线。

维护时，壳独立检查全部注册成员，无需壳先发布新版本。新建成员包发布后登记并发布壳；既有成员的后续更新只发布成员即可。首次订阅默认允许安装以后登记的新成员，业务登录、付费与外部操作继续遵循各能力的授权。离线、合同或安装失败保留当前集合，并回到失败阶段恢复；不要通过业务调用替换正在使用的集合。

## Boardmix operations

For explicit Boardmix file, media or object operations, select `boardmix-tools`. Resolve `taobao-ai-ops skill source --name boardmixcli --json`, load the complete current Skill and discover live capabilities through `taobao-ai-ops component run boardmixcli capabilities --json`. Invoke its exact operations through that component entry. Inputs are the user-authorized file/media/object targets and placement; outputs are verified identifiers and readback evidence or structured recovery errors. Installation does not authorize service access. Collection and layout decisions remain with the competitor-visual application. Return to main-line step 6 after the capability completes.


## DMP 商品经营报告

用户提供淘宝/天猫商品ID，希望查看竞品经营趋势、推广方式/力度/效果、新老客成交结构或完整商品经营HTML报告时，选择 `dmp-product-report` 节点。独立拥有包为 `@petercjl/dmp-product-report`，逻辑Skill为 `dmp-product-report`；所需能力是 `@petercjl/tbcli` 的 DMP snapshot v2 与 itemSummary v1。兼容起点分别为报告包0.2.0、tbcli 0.12.0。

先运行 `taobao-ai-ops skill source --name dmp-product-report --json`，完整读取返回的当前Skill，按该Skill按需加载知识、适配与tbcli依赖，再运行 `taobao-ai-ops doctor --node dmp-product-report --json`。Doctor检查套件所选报告组件、Python与tbcli合同，不查询经营数据或证明账号权限。缺失/不兼容时保留结构化错误，恢复后回到预检；不借用另一全局tbcli来掩盖依赖问题。

通过 `taobao-ai-ops component run dmp-product-report ...` 执行子CLI主线。套件将其已注册tbcli入口传入应用；宿主能力集合的子Skill回执也包含同一依赖入口，任务内保留该版本集合。商品名称、链接、5张主图、店铺、已售、入口价和评价数由橙色淘宝买家浏览器读取；DMP统计由蓝色商家电商浏览器读取，两个角色的会话参数分别保留。登录和验证码由用户在对应窗口处理。

输入为目标商品ID，可补充报告日与新输出目录；已有证据可按子合同离线build/finalize。接口需要的本店商品参数由tbcli自动从当前账户发现，报告仅采用目标商品侧数据。输出包括自包含HTML、商品资料、近7天/前7天、近30天/前30天及8个完整自然周证据、CSV、ViewModel、分析和校验。run产生draft后继续按子Skill完成分析和finalize；一句结论与编号证据、经营策略解读及最终概览均由子应用的当前知识方法承接。返回套件主线第4步保留成果或第6步交付。

报告模板和分析知识继续由独立报告包维护，运行不依赖commerce-ui。套件负责注册、安装更新、精确Skill来源解析、依赖传递和预检。商品资料的页面展示口径与DMP分期统计分别解释；本次可用范围以平台实际返回为准。

### DMP配套版本迁移

用户授权更新DMP报告和取数链路时，检查当前集合的blocked成员。若报告包0.2与tbcli 0.12因跨兼容版本而保留旧版，使用旧回执和 `collection prepare --accept-component-upgrades tbcli,dmp-product-report` 明确迁移这两个组件；其他不兼容组件维持原选择。核对候选DMP doctor及真实版本后再切换宿主入口。该操作按用户已授权的组件范围执行，不扩大到其他Agent或未选组件。
