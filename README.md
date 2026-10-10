# MediaBridge Plugin Devkit

面向外部开发者的 **MediaBridge 插件开发套件**：契约文档、工具链、骨架模板与 Trae skill，
一个仓库 + 一个 skill 文件 = 插件开发到测试的一条龙入口。

## 快速开始（只凭一个文件）

1. 把 `SKILL.md` 放进你项目的 `.trae/skills/media-bridge-plugin-dev/SKILL.md`。
2. 在 agent 对话里直接说"初始化 MediaBridge 插件开发环境"，agent 会帮你落框架、选类型、生成骨架。
3. 或者手动：clone 本仓库 → `node framework/tools/init.js` 落进你的项目。

## 这个仓库里有什么

```
SKILL.md                           # 自包含开发入口（所有引用都走 GitHub 绝对地址）
AGENTS.md                          # 给 AI agent 的约束
VERSION                            # 框架版本（更新提醒的比对对象）
framework/
  framework.json                   # 元信息：版本号 + 来源戳
  contracts/                       # 插件契约（依据，开发前必读）
    plugin-contract.md             # 插件总契约：通用模型（包、通道、动作、缓存、webui）
    contract-source.md             # 源插件契约（动作 + 显示与定位口径）
    contract-metadata.md           # 元数据插件契约
    contract-home.md               # 首页插件契约（行与条目规范）
    contract-subtitle.md           # 字幕插件契约
    contract-output.md             # 输出插件契约
    plugin-webui.md                # 插件 webui 前端契约（侧栏注册、SDK、通道前缀、门禁）
  DEV-NOTES.md                     # 开发避坑 / 常见问题（真踩过的坑与排查口径，非契约）
  INDEX.md                         # 速查索引（派生 cheat-sheet：每动作一行「入参 → 出参 → 出处指针」）
  tools/
    contract.js                    # 声明文件校验（面板 contract.js 的子集副本）
    check.js                       # 本地契约校验
    index-check.js                 # 校验 INDEX.md 的 #Lx-Ly@锚点 是否仍命中
    pack.js                        # 打 tar.gz + 注入 files 校验（--library 模式生成 index.json）
    panel.js                       # 面板 API 客户端：login / install / call / list
    init.js                        # 把框架落进开发者的项目
    new.js                         # 生成插件骨架
  templates/
    source/                        # 源插件骨架
    metadata/                      # 元数据插件骨架
    home/                          # 首页插件骨架
    subtitle/                      # 字幕插件骨架
    output/                        # 输出插件骨架
```

## 开发者工作流

```bash
# 0. 初始化框架（一次）
node framework/tools/init.js

# 1. 生成骨架
node framework/tools/new.js mysource --type source --name "我的源"

# 2. 开发 → 按 contracts/ 实现动作
#   开发时随时自查
node framework/tools/check.js mysource

# 3. 打包（默认产物放 dist/，用于手装测试）
node framework/tools/pack.js mysource

# 4. 连面板实测（先登录一次）
node framework/tools/panel.js login --host http://127.0.0.1:8088 --password 123456
node framework/tools/panel.js install mysource
node framework/tools/panel.js call source mysource sites
node framework/tools/panel.js call source mysource search '{"wd":"三体"}'
```

## 没有面板？

可以在项目根拉一个面板实例到 `.panel/` 子目录（隔离，不打乱开发环境）：

```bash
git clone https://github.com/dlushu/media-bridge-panel.git .panel
cd .panel && WEB_PORT=18088 DATA_DIR=../.panel-data node server.js
```

然后在 devkit 里用 `panel.js login --host http://127.0.0.1:18088 …` 连它。

## 插件库发布

本仓库的 `pack.js` 也支持 `--library` 模式（与官方插件仓库 `media-bridge-plugins` 的产物完全兼容）：

```bash
node framework/tools/pack.js --library --all --out <media-bridge-plugins 仓库目录>
```

这会写出 `packages/` 与 `index.json`（schema 2），与官方仓库的打包脚本同一套口径。

## 协议

AGPL-3.0-only（与面板仓库一致）。
