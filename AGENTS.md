# Agent 须知

这是 **MediaBridge 插件开发套件**（devkit）仓库的 agent 规则。

## 核心要求

1. **契约是唯一依据，由仓库所有者维护**：`framework/contracts/` 的正文就是权威件（`framework.json` 亦如此声明）。**认权限看推送权**：对 `dlushu/MediaBridge-plugin-devkit` 有 **push 权限**的人 = 仓库所有者，**可直接修正契约正文**（改完按第 6 条记档）；**没有该仓推送权限的插件开发者只读**——按契约开发，发现契约有问题走第 6 条上报，不自行改正文。
2. **凭证不入库**：插件开发者的面板地址/密码只写项目本地 `.panel-auth.json`（已 gitignore）；永远不要在 docs 或代码里出现真实凭据。
3. **验证缺凭据先问用户，不盲目试探**：跑通面板实测链需要面板地址+密码时，先说明"要什么、为什么"，等开发者提供再操作。
4. **插件之间互不认识**：设计多类型包时，各角色代码放 `roles/<类型>/`，彼此不互相调用；跨插件编排靠面板 hostCall 白名单（output 类型才能用）。
5. **请求扇出放大不擅自做主**：凡会从一个客户端请求放大成 N 个上游请求的改动（例如在 detail 阶段额外联网取附加信息），先说明扇出倍数，等开发者确认再动手。
6. **契约变更必须上报 + 记档**：契约加了字段、改了语义、改了动作名、改了失败口径 → 这是面板侧的兼容性问题。改完 `framework/contracts/` 正文后在 `CHANGELOG.md` 记一笔，写明改了什么、为什么、指向面板/插件仓的对应变更。⚠️ 打包侧校验是面板 `server/modules/plugin/contract.js` 的**子集副本**（`framework/tools/contract.js`），字段规则两边要同步，否则"包打得出来但装不上"。
7. **插件契约版本**：`plugin.json` 的 `contract` 字段（缺省 1）声明插件按哪版契约开发。不兼容变更会升号。
8. **面板 bug 不落盘，只在当轮对话输出**：发现**面板自身**的 bug 或不利于开发的问题，**不要写进本仓任何文件**（不改 docs、不记 `CHANGELOG.md`、不写 `DEV-NOTES.md`）——面板随时在变，落盘即过期误导。只**在当轮对话里**给用户一份**可复现的问题报告**（现象 / 复现步骤 / 期望vs实际 / 原始证据 / 定位线索 / 环境），由用户反馈给面板维护者。
9. **可行性先行，先给方案再动手（铁律）**：**任何项目/需求开工前，第一件事是可行性评估 + 方案建议，不得先写代码**。评估要正面回答"在契约与运行模型下能不能成立、硬卡点在哪、代价多大"；**给至少一条路线并标出推荐项与理由**，列出需用户拍板的关键问题；缺证据先取证（读契约/读源/实测），**不臆断、不硬闯**。用户确认方案后再进入实现。多路线时明确"推荐/不建议/不可行"及各自代价。
10. **大文件取证走 subagent，结论必须落盘（铁律）**：单次读取 **>300 行**的源码 / 契约 / 面板文件，或任何预计单轮 **>~3000 token** 的取证，**必须交给 subagent 完成**，主上下文**只接收「结论 + `file#Lx-Ly` 指针」**，不得把大文件正文吸进主上下文。任何取证结论**当场**写入对应插件的 `PLAN.md` / `DEV-NOTES.md`（无插件归属的写本仓 `DEV-NOTES.md`），不得只留在对话里 —— 会话压缩会把未落盘的结论丢光，为求稳又重读大文件，再次撑爆上下文，这正是「反复压缩却不开工」的根因。
11. **先查索引，再读正文**：定位动作 / 字段 / 口径时，**先读 `framework/INDEX.md`**（派生速查表：每动作一行「入参键 → 出参键 → 权威出处指针」）；索引不够再**定点**读契约正文对应区间，不整读正文。**契约正文变更后**必须**同步** `framework/INDEX.md`，跑 `node framework/tools/index-check.js` 校验指针仍命中锚点，再按第 6 条记档。
12. **工作区布局：源码与产物同仓、都不入库；打包逐个来；发布等指令（铁律）**：本仓（官方 devkit）兼作**私有开发工作区**：
    - `plugins/` = **全部**插件源码（统一在此开发，跨仓迁移也归宿到此）；`packages/` + `index.json` = 插件库打包产物。**两者都不入库**（`.gitignore` 已列，勿再添加进 git）。
    - **打包一律逐个**：`node framework/tools/pack.js --library <id> --out .`（产物落本仓 `packages/`）。**禁用 `--library --all`** —— 它先清空 `packages/` 与 `index.json` 再全量重建，**源码缺哪个就把哪个包打没**（曾缺 `xunlei-subtitle` 源码，跑 `--all` 会把它从库里抹掉）。
    - **发布需用户明确说「推」**：届时才把 `packages/` + `index.json` 同步到 `media-bridge-plugins` 并推送；平时不动那个仓。
    - 日常链路：在 `plugins/<id>/` 改源码 → 开发包 `pack.js <id>`（出 `dist/`，手装面板实测）→ 发布包 `pack.js --library <id> --out .`。
13. **版本号：所有者推送自动升，开发者用 update.js 自更新（铁律）**：
    - 版本号两处一致：`framework/framework.json`（权威）+ 根 `VERSION`；改版本一律走 `node framework/tools/version.js [patch|minor|major]`，不手改。
    - **所有者**：`git config core.hooksPath framework/hooks` 启用钩子后，推 main 时若待推提交没改版本号 → 自动升 patch、连 CHANGELOG「未发布」（有内容则落版本号+日期）新提一个 commit，需重新 push 一次；minor/major 手动先升。
    - **开发者**：每次插件开发开工先跑 `node framework/tools/update.js --check`，有新版经用户同意后 `update.js`（只覆盖 `framework/` 与 SKILL.md，不碰 `plugins/`）。旧到没有该工具的，`curl …/init.js | node - --upgrade`。
14. **动插件必核对「可选申报」，缺了当场提醒（铁律）**：**新建 / 修改 / 评审 / 打包任何插件**时，主动对照该插件的**可选**字段 / 可选动作清单（见 `plugin-contract.md` §一「可选能力的申报」+ 各类型契约），**插件有能力却没申报的，当场向用户点名提醒**（例：`home` 插件未申报任何 `feed` ⇒ 客户端推荐位 / 轮播恒空；`metadata` 未给 `genreItems` ⇒ 类型那栏不可点）。**提醒 ≠ 强制**：确属没能力就如实留空；**严禁为凑满可选字段编数据**（呼应契约第一条铁律）。

## 事实来源

| 主题 | 去哪找 |
|---|---|
| **速查索引（先查这个）** | `framework/INDEX.md`（派生 cheat-sheet，每动作一行：入参键 → 出参键 → 权威出处指针） |
| 插件总契约（通用模型） | `framework/contracts/plugin-contract.md` |
| 各类型契约 | `framework/contracts/contract-{source,metadata,home,subtitle,output}.md` |
| 插件 webui 前端契约（侧栏注册、SDK、通道前缀、门禁） | `framework/contracts/plugin-webui.md` |
| 面板实现与分层 | 面板仓库 `ARCHITECTURE.md` / `docs/develop.md` |
| 设计决策 ADR | 面板仓库 `docs/adr/` |
| 官方插件参考实现 | 插件仓库 `plugins/<id>/`（不对外公开源码，但参考其发布包的目录结构） |
| 索引指针校验 | `node framework/tools/index-check.js`（校验 `INDEX.md` 的 `#Lx-Ly@锚点` 是否仍命中） |
