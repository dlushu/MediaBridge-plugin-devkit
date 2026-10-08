---
name: media-bridge-plugin-dev
description: 开发 MediaBridge 插件（源/元数据/首页/字幕/输出）时的唯一入口 —— 契约、工具、骨架、面板实测全走通
---

# MediaBridge 插件开发

这是**给开发 MediaBridge 插件的人**用的 skill。你的项目里应该有这个 skill + `framework/` 框架；如果没有，先初始化。

## 开工前必读（按插件类型选读对应节）

| 类型 | 必读 |
|---|---|
| **所有插件** | [插件总契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/plugin-contract.md) —— 动作、通道、鉴权、打包 |
| 源插件（`source`） | 上面那份 + [源插件显示与定位规范](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/source-display-rules.md) |
| 首页插件（`home`） | 上面那份 + [首页插件行与条目规范](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/emby-home-plugin.md) |
| 元数据插件（`metadata`） | 总契约第六节 |
| 字幕插件（`subtitle`） | 总契约第七节 |
| 输出插件（`output`） | 总契约第四节「输出插件」 |
| 带 webui 的 | [插件 webui 前端契约](https://raw.githubusercontent.com/dlushu/MediaBridge-plugin-devkit/main/framework/contracts/plugin-webui.md) |

**契约版本**：插件在 `plugin.json` 写 `contract: 1`；契约不兼容变更会升号，面板据此区分新旧。

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
2. **契约只读**：`framework/contracts/` 是依据。发现契约有优化空间 → 直接提问开发者 → 反馈到 [media-bridge-plugins](https://github.com/dlushu/media-bridge-plugins) 仓库，不改本仓契约正文。
3. **面板不解释插件数据**：动作的入参出参按契约规定，面板只做转换（Emby DTO / 页面数据）。
4. **插件之间互不认识**：多类型包各角色放 `roles/<类型>/`，彼此不互相调用；跨插件编排靠面板 hostCall 白名单（仅 output 类型）。
5. **凭据不入库**：面板地址/密码只写 `.panel-auth.json`（已 gitignore）；缺凭据先问用户，不盲目 curl 试探。
6. **扇出放大要申报**：凡会把「1 个客户端请求」放大成「N 个上游请求」的改动（例如 detail 阶段额外联网取附加信息），先说明扇出倍数，等开发者确认再动手。
7. **可重复解析是义务**：`ref`（播放项/字幕轨的凭据）只要内容还在，随时能换出地址；缓存与并发重复由插件自己挡住（面板那份缓存只挡几秒内的连问）。
8. **一页必须填满**：客户端拿到 `items` 少于 `limit` 就判最后一页、不再翻页。上游一页不够时按窗口连续取，再切出自己这页。

## 参考实现

官方插件的**发布包**（tar.gz）在 [media-bridge-plugins](https://github.com/dlushu/media-bridge-plugins) 仓库的 `packages/<id>/` 下，可以下载参考目录结构。插件源码不公开。

## 契约问题反馈

发现契约需要改 → 告诉开发者 → 由开发者去 `media-bridge-plugins` 仓库改（那是契约的唯一来源）。本 skill 不代收、不改契约正文。
