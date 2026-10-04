# 淘宝 AI 运营

面向淘宝电商工作者的独立 SOP Skill 套件。当前开发版本包含运营路由、预策类目机会研究和淘宝搜索商品形态研究。类目研究支持本地 Excel 与授权 NAS/预策取数；商品研究接受搜索结果表。每个节点独立执行，报告保留其原有方法和完整证据。

```sh
taobao-ai-ops nodes list --json
taobao-ai-ops doctor --node category-research --mode excel --json
taobao-ai-ops doctor --node product-research --json
taobao-ai-ops skill source --name yuce-category-opportunity-report --json
taobao-ai-ops skill install --agent codex --profile research --json
```

预发布通道为 `next`，适合研究流程试用；跨 Agent 的完整验收范围见下文。安装后按需运行 `skill install`，服务访问仍需单独配置。

```sh
npm install --global @petercjl/taobao-ai-ops@next
taobao-ai-ops version
taobao-ai-ops skill install --agent codex --profile research --json
```

开发时用 `node bin/taobao-ai-ops.mjs` 执行。Node >=20，Python 依赖见 requirements.txt，可运行 `python -m pip install -r requirements.txt`；可通过 TAOBAO_AI_OPS_PYTHON 指定稳定解释器。CLI 也发现 Agent 管理的 Python 和已有商品研究环境。已有独立 Skill 先检查 `skill status`；明确授权迁移后使用 `--adopt`，CLI 会保留恢复点。

新安装默认在 macOS 使用链接、Windows 使用受管理副本。已有 Skill 迁移使用 `--adopt`，完整备份并校验；受管理本地修改会阻止覆盖。SealSeek 根目录可用 SEALSEEK_SKILLS_DIR 指定，发现歧义时会明确报错。

```sh
taobao-ai-ops script category-research build_report.py --help
taobao-ai-ops script product-research clean_search_export.mjs SOURCE.xlsx CLEANED.xlsx
taobao-ai-ops tool run tbcli capabilities --json
taobao-ai-ops workflow plan --run-dir NEW_RUN --node product-research --input SOURCE.xlsx --json
```

tbcli 0.10.4 与 sycmcli 0.3.1 是固定版本依赖，通过套件解析的实际入口调用，执行时关闭其独立自动更新。yccli 是按需发现的外部工具，可由 TAOBAO_AI_OPS_YCCLI 指定。Excel 分析不要求 NAS、VPN 或平台登录。服务账号和业务数据由使用者提供，包内不含凭证。

节点的业务判断和图像审阅由 Agent 完成。doctor 验证确定性运行资源，并将原生图像能力列为需当前 Agent 核实；它不宣称完整业务回归通过。目标为 Codex/macOS、SealSeek/macOS 与 Windows，统一套件的真实跨 Agent 验收尚待完成。

套件手动检查更新，运行期间使用固定版本；开发源码通过 Git 更新。已发布全局安装可用 `update install --agent AGENT --yes` 更新同一 npm prefix 的包与受管理 Skill，失败恢复旧包。安装、更新不发布商品或修改广告。

目前合并范围是研究链第一批。供应链、内容制作、经营复盘按后续阶段接入。来源记录在 suite-manifest.json；旧独立包仍保留作历史与过渡，后续维护以本套件的迁入节点为准。
