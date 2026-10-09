---
name: media-bridge-plugin-dev
description: 开发 MediaBridge 插件（源/元数据/首页/字幕/输出）时的唯一入口 —— 契约、工具、骨架、面板实测全走通
---

# MediaBridge 插件开发

这是**给开发 MediaBridge 插件的人**用的 skill。你的项目里应该有这个 skill + `framework/` 框架；如果没有，先初始化。

## 契约索引（按类型选读）

| 你要做什么 | 必读 |
|---|---|
| **所有插件** | [插件总契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/plugin-contract.md) —— 通用模型：包、通道、动作、执行、缓存、webui、失败口径 |
| 源插件（`source`） | [源插件契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/contract-source.md) —— 动作清单、组/站点模型、显示与定位口径 |
| 元数据插件（`metadata`） | [元数据插件契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/contract-metadata.md) —— 注册、取元数据、取分集、搜索 |
| 首页插件（`home`） | [首页插件契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/contract-home.md) —— 行与条目规范、与 Emby 端点接线 |
| 字幕插件（`subtitle`） | [字幕插件契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/contract-subtitle.md) —— 申报轨、取内容、ref 与缓存 |
| 输出插件（`output`） | [输出插件契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/contract-output.md) —— 反向 hostCall、HTTP 编排、令牌安全 |
| 带 webui 的 | [插件 webui 前端契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/plugin-webui.md) —— 侧栏注册（`plugin.json` 的 `webui` 字段）、SDK、通道前缀、门禁 |

**webui 与侧栏**：`plugin.json` 的 `webui` 字段决定插件页面挂在哪一栏 —— 给了入口，面板就在该类型侧栏挂一个页面（设置 / 展示页）；不写就不挂。规则见总契约第一节字段表与第九节。

**契约版本**：插件在 `plugin.json` 写 `contract: 1`；契约不兼容变更会升号，面板据此区分新旧。

**开发避坑**：卡住了先看 [DEV-NOTES.md](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/DEV-NOTES.md) —— 真踩过的坑与排查口径（每条标明归属：插件 / devkit / 面板 / 环境）。

## 初始化（没有 framework/ 时）

```bash
# 方式 A：git clone 到项目根，init 落进当前目录
git clone https://github.com/dlushu/MediaBridge-plugin-devkit.git .devkit
node .devkit/framework/tools/init.js .
# 之后删掉 .devkit/（已复制走），或留着备查

# 方式 B：只下 skill + 手动放
curl -sL https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/tools/init.js \
  | node - <目标目录>
```

init 会落进：`.trae/skills/media-bridge-plugin-dev/SKILL.md`、`framework/`（工具 + 契约 + 模板）、`.gitignore` 追加、`plugins/` 目录。

## 版本更新检查

框架有版本号（`framework/framework.json`）。远端仓库更新后，本地启动 agent 时它会提醒你：
- 本地版本：`framework/framework.json` 里的 `version`
- 远端版本：`https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/framework.json`

提醒开发者是否升级；升级就是重跑一次 `init.js --upgrade`（只覆盖 `framework/` 与 skill，不动你的插件源码）。

## 开发工作流

```bash
# 1. 生成骨架
node framework/tools/new.js <id> --type source|metadata|home|subtitle|output [--name 显示名]

# 2. 按契约实现动作（动作全是如实失败的桩，逐个填）

# 3. 本地校验（契约 + 目录结构）
node framework/tools/check.js <id>

# 4. 打包（产物在 dist/）
node framework/tools/pack.js <id>

# 5. 真面板实测（先登录一次，凭据存 .panel-auth.json，gitignore 已排除）
node framework/tools/panel.js login --host http://<面板地址:端口> --password <密码>
node framework/tools/panel.js install <id>
node framework/tools/panel.js call <类型> <id> <动作> '[argsJson]'
```

**没有面板？** 在项目根拉一个隔离实例：
```bash
git clone https://github.com/dlushu/media-bridge-panel.git .panel
cd .panel && WEB_PORT=18088 DATA_DIR=../.panel-data node server.js
# 默认密码 123456，登录后去面板设置改掉
```

## 铁律（每条都来自踩坑）

1. **不编数据**：插件给不了 / 这次取失败 → 如实留空或报错，面板如实点名，不猜、不静默回退。
2. **契约正文只由仓库所有者改（看推送权）**：`framework/contracts/` 是依据。**对 devkit 仓有 push 权限者 = 所有者**，可直接改正文并记 `CHANGELOG.md`；**没有推送权限的开发者只读** —— 按契约开发，要改（加字段 / 改语义 / 改动作名 / 改失败口径）就报给所有者，别自改正文。
3. **面板不解释插件数据**：动作的入参出参按契约规定，面板只做转换（Emby DTO / 页面数据）。
4. **插件之间互不认识**：多类型包各角色放 `roles/<类型>/`，彼此不互相调用；跨插件编排靠面板 hostCall 白名单（仅 output 类型）。
5. **凭据不入库**：面板地址/密码只写 `.panel-auth.json`（已 gitignore）；缺凭据先问用户，不盲目 curl 试探。
6. **扇出放大要申报**：凡会把「1 个客户端请求」放大成「N 个上游请求」的改动（例如 detail 阶段额外联网取附加信息），先说明扇出倍数，等开发者确认再动手。
7. **可重复解析是义务**：`ref`（播放项/字幕轨的凭据）只要内容还在，随时能换出地址；缓存与并发重复由插件自己挡住（面板那份缓存只挡几秒内的连问）。
8. **一页必须填满**：客户端拿到 `items` 少于 `limit` 就判最后一页、不再翻页。上游一页不够时按窗口连续取，再切出自己这页。

## 参考实现

官方插件的**发布包**（tar.gz）在 [media-bridge-plugins](https://github.com/dlushu/media-bridge-plugins) 仓库的 `packages/<id>/` 下，可以下载参考目录结构。插件源码不公开。

## 契约问题反馈

- **有 devkit 仓 push 权限（= 所有者）**：直接改 `framework/contracts/` 正文，并在 `CHANGELOG.md` 记档（正文是本仓权威件）。
- **无 push 权限的开发者**：契约只读、按契约开发；要改就报给所有者，别自改正文。

## 面板问题反馈

开发/实测时若撞到**面板自身的 bug**，或**面板行为不利于开发**（契约没写、面板却这样、或报错吞信息、门禁/超时不对等）：

- **绝不落盘**：面板 bug **不写进本仓任何文件**（不改 docs、不记 `CHANGELOG.md`、不写 `DEV-NOTES.md`）——面板随时在变，落盘即过期误导。**只在当轮对话里**给用户报告。
- **先判归属**：确认是**面板自身**的问题（不是插件写法 / 契约 / 环境），才走这条；其余按各自路径处理。
- **不擅自改面板**：面板仓库不归本仓，只**产出问题报告**交给用户，由用户反馈给面板维护者。
- **报告要能让维护者直接复现**，尽量给全这几项：
  1. **现象**：一句话说清坏了什么；
  2. **复现步骤**：确切的命令 / 操作（含 `panel.js ...` 原样命令与参数）；
  3. **期望 vs 实际**：契约或常识上应该怎样，实际回什么；
  4. **证据**：原始回执（HTTP 状态 + JSON 体）、`error.code`、关键日志片段 —— 别只转述；
  5. **线索**：能定位到就点名（面板文件 + 行号 / 函数名）；
  6. **环境**：面板版本、插件 `id@version`、契约版本（`plugin.json` 的 `contract`）。

- **写成一段可直接粘贴的报告**给用户（不是散落在对话里），末尾可附"这是面板问题、非插件/契约问题"的结论与依据。
