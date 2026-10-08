# Agent 须知

这是 **MediaBridge 插件开发套件**（devkit）仓库的 agent 规则。

## 核心要求

1. **契约只读**：devkit `framework/contracts/` 里的文档是**依据**，不是可改对象。发现契约有问题 → 向开发者提问 → 由开发者反馈到 `media-bridge-plugins` 仓库。devkit 里**不改契约正文**。
2. **凭证不入库**：插件开发者的面板地址/密码只写项目本地 `.panel-auth.json`（已 gitignore）；永远不要在 docs 或代码里出现真实凭据。
3. **验证缺凭据先问用户，不盲目试探**：跑通面板实测链需要面板地址+密码时，先说明"要什么、为什么"，等开发者提供再操作。
4. **插件之间互不认识**：设计多类型包时，各角色代码放 `roles/<类型>/`，彼此不互相调用；跨插件编排靠面板 hostCall 白名单（output 类型才能用）。
5. **请求扇出放大不擅自做主**：凡会从一个客户端请求放大成 N 个上游请求的改动（例如在 detail 阶段额外联网取附加信息），先说明扇出倍数，等开发者确认再动手。
6. **契约变更必须上报**：契约加了字段、改了语义、改了动作名 → 这是面板侧的兼容性问题；文档改完（新仓里不动契约正文）后在 `CHANGELOG.md` 记下这件事，指向面板/插件仓的对应变更。
7. **插件契约版本**：`plugin.json` 的 `contract` 字段（缺省 1）声明插件按哪版契约开发。不兼容变更会升号。

## 事实来源

| 主题 | 去哪找 |
|---|---|
| 插件总契约（通用模型） | `framework/contracts/plugin-contract.md` |
| 各类型契约 | `framework/contracts/contract-{source,metadata,home,subtitle,output}.md` |
| 插件 webui 前端契约（SDK、通道前缀、门禁） | `framework/contracts/plugin-webui.md` |
| 面板实现与分层 | 面板仓库 `ARCHITECTURE.md` / `docs/develop.md` |
| 设计决策 ADR | 面板仓库 `docs/adr/` |
| 官方插件参考实现 | 插件仓库 `plugins/<id>/`（不对外公开源码，但参考其发布包的目录结构） |
