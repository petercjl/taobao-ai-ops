# 安装淘宝 AI 运营工具集

把以下提示词发送给当前使用的 Agent：

> 安装 @petercjl/taobao-ai-ops，并安装配套 Skill。

当前 Agent 先解析自己的 Skill 目录与可用能力，再读取包的安装合同。安装包含完整 Skill 资源、CLI 与依赖；安装完成后由当前宿主验证 Skill 发现与实际入口。配置、登录和业务服务授权分别办理。

支持能力集合合同的宿主可订阅包根的 `sealwork.collection.json`。sealwork 的插件页添加完整 npm 包名，启动后默认自动更新壳和成员，并安装以后登记的新成员。它使用宿主独占的整套版本目录，保留已有单独安装的 Skill；停止订阅后这些独立安装仍可使用。

开发者合同：`collection check --previous <collection.json> --json` 只检查；`collection prepare --directory <new-directory> --previous <collection.json> --yes --json` 生成候选。首次安装省略 previous。宿主提供 Node 和 `npm_execpath` 指向的 npm CLI，不运行 npm 生命周期脚本；宿主负责任务隔离、候选验证、激活、原生 Skill 刷新和失败回退。候选回执包含完整成员、所有 Skill、目标自有 CLI 入口与运行环境。Skill 和成员方法仍由各自包拥有。

目录必须是新目录。安装失败删除本次候选；未知结果先检查候选回执和实际入口，避免重复安装。安装成功与宿主发现确认分别记录。
