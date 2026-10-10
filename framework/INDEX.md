# 插件速查索引（INDEX）

> 本文件是 `framework/contracts/` 的**派生 cheat-sheet**，唯一目的是「少读大文件」：定位动作 / 字段 / 口径时先查这里，不够再读契约正文对应区间。
> **权威永远是 contracts 正文**；本文件与正文冲突时以正文为准。
>
> 引用格式：`` `framework/contracts/xxx.md#L起-L止@锚点文本` `` —— 表示「权威出处在这一区间，且该区间应含锚点文本」。
> 校验：`node framework/tools/index-check.js`（逐个校验引用是否仍命中锚点 + 覆盖率）。
>
> 维护铁律：**先改契约正文 → 再同步本文件 → 跑 `index-check.js` → 在 `CHANGELOG.md` 记档**（见 `AGENTS.md` 第 6 / 10 / 11 条）。
>
> 面板消费侧的字段名与运行期口径以**面板仓实现**为准；面板随时在变，本索引**不落面板行号**（见 `AGENTS.md` 第 8 条）。

---

## 0. 路由：我要做什么 → 先看哪

| 我要做 | 先看 |
|---|---|
| 加一个动作 / 改返回信封 | 对应类型的 §该动作 + §失败口径速记 |
| 搞清楚某个动作的入参 / 出参键 | 对应类型的表格（本文） |
| 改 `plugin.json` / 目录结构 | 通用模型 · 身份与目录 |
| 搞清失败怎么表达 | 通用模型 · 失败与诊断 + §失败口径速记 |
| 反调宿主（output 类型） | 通用模型 · ctx.hostCall |
| 做 webui 设置页 | webui 前端 + 通用模型 · webui/门禁 |

---

## 1. 通用模型（所有插件）· `plugin-contract.md`

| 主题 | 入参 | 出参 / 要点 | 权威出处 |
|---|---|---|---|
| 身份与目录、`plugin.json` 字段 | — | `id` `name` `version` `types` `main` `domain` `series` `webui` `files` `depends` `ingress` `updateUrl` `contract` `description` `author` | `framework/contracts/plugin-contract.md#L34-L80@plugin.json` |
| 执行模型 | — | 常驻子进程、面板启停、不沙箱、崩溃不自动重启 | `framework/contracts/plugin-contract.md#L139-L148@执行模型` |
| 通道与入口形状 | `(args, ctx)` | `module.exports = { actions: { <动作名>: async (args,ctx)=>… } }`；ctx：`type` `id` `dataDir` `log` `hostCall` | `framework/contracts/plugin-contract.md#L152-L184@module.exports` |
| `ctx.hostCall`（反调宿主） | `target` `action` `args` | 成功 `{ok:true,value}` / 失败 `{ok:false,error:{code,message}}`；白名单外回 `NO_HOSTCALL` | `framework/contracts/plugin-contract.md#L186-L212@hostCall` |
| 按类型的动作清单入口 | — | 各类型文档各一份 | `framework/contracts/plugin-contract.md#L217-L229@按类型的动作契约` |
| 播放地址转交 | `ref` `clientHost` | 插件回真实可直连地址，面板 302 | `framework/contracts/plugin-contract.md#L233-L250@播放地址的转交` |
| 模板与域 | — | 域 id 形状 `[a-z][a-z0-9]*`；每域最多一个模板 | `framework/contracts/plugin-contract.md#L254-L270@模板与域` |
| 缓存分工 | — | 插件侧：自取数结果（有效期插件定）；面板侧：这一条目的线路结果 | `framework/contracts/plugin-contract.md#L274-L298@缓存分工` |
| webui / 设置 / 门禁 / `http` 动作 | `method` `path` `query` `body` `contentType` `host` `proto` | `{status?, body, contentType?}`；门禁默认须登录，`ingress` 声明才放开 | `framework/contracts/plugin-contract.md#L302-L362@ingress` |
| 失败与诊断（分通道口径） | — | 见 §失败口径速记 | `framework/contracts/plugin-contract.md#L366-L394@失败与诊断` |

---

## 2. 首页插件 · `home` · `contract-home.md`

| 主题 | 入参 | 出参 / 要点 | 权威出处 |
|---|---|---|---|
| 行声明 `rows` | 无 | `{ok:true, rows:[{id,title,collectionType?,feed?,total?,episodes?}]}`；`total`/`episodes` 只在 `>0` 时被采用；`total` **由插件自定义**、面板**不相加**（同 `collectionType` 多行汇总取 **max**，`mixed` 不参与） | `framework/contracts/contract-home.md#L41-L98@申报行清单` |
| 跑一行 `run` | `{rowId, params?, startIndex?, limit?}` | `{items, total, cached?}`；一页必须按窗口填满；**失败必须 `throw`** | `framework/contracts/contract-home.md#L90-L111@跑一行` |
| 行附加声明 | — | `cacheDuration`（秒，0=不缓存）、`params:[{name,title,type,value?…}]` | `framework/contracts/contract-home.md#L119-L136@params` |
| HomeItem（面板严格归一化） | — | `id`(必) `type`(必,movie/tv) `title`(必) `originalTitle` `year` `overview` `rating` `poster` `backdrop` `genres` `providerIds` `sourceLoc{source?,site,vodId}`；规范外字段丢弃 | `framework/contracts/contract-home.md#L140-L167@HomeItem` |
| 与 Emby 接线 | — | 媒体库 Id = `catpawhome_` + base64url(`<插件id>|<行id>`)；`StartIndex`/`Limit` 原样透传 | `framework/contracts/contract-home.md#L170-L186@媒体库 Id` |
| 铁律 | — | 不编假数据 / 归一化严格 / 面板不猜 | `framework/contracts/contract-home.md#L220-L225@不编假数据` |

---

## 3. 源插件 · `source` · `contract-source.md`

| 主题 | 入参 | 出参 / 要点 | 权威出处 |
|---|---|---|---|
| 动作总表 | — | `sites`(必需) `search`(仅两层式) `detail`(必需) `play`(必需) `probe`(必需) `http`(可选) | `framework/contracts/contract-source.md#L8-L23@动作总表` |
| `sites()` 两级结构 | — | `sources:[{id,name,url,mode,enabled,ok,ms,siteCount}]`；`sites:[{key,name,api,searchable,source,directLines?}]` | `framework/contracts/contract-source.md#L25-L46@两级结构` |
| 本站点五字段 | — | `source` `key` `name` `api` `directLines`（面板只认这五个） | `framework/contracts/contract-source.md#L99-L120@directLines` |
| 认证标 `vod_exact` | — | `json.list[].vod_exact === true` 时面板直接采信该候选 | `framework/contracts/contract-source.md#L122-L140@vod_exact` |
| 取数式样：一层 / 两层 | — | `directLines:false`（缺省，两层式）/ `true`（一层式） | `framework/contracts/contract-source.md#L142-L157@两层式` |
| 组名渲染 | — | `sources[].name · sites[].name`（`·` 只由渲染层插入） | `framework/contracts/contract-source.md#L172-L194@组名` |
| 搜索候选 `search` | 实例 + 站点 key + 搜索词/页码/超时 | `json.list[]`：`vod_id` `vod_name` `vod_pic` `vod_remarks`（+可选 `vod_exact`）；`vod_name` 必须是干净片名主干 | `framework/contracts/contract-source.md#L207-L233@vod_name` |
| 详情 `detail`（按季集定位） | `{…, season, episode, pick?}` | 剧集：`episodes[]`(全集) + `target`(按季集定位项，定位不到 `null`)；电影：`pick:'items'`→`items[]`，`target=items[0]` | `framework/contracts/contract-source.md#L235-L265@必须回全集` |
| 三级定位规则 | — | 命中依据写入 `target.matchedBy` ∈ `title`/`episode`/`number` | `framework/contracts/contract-source.md#L267-L286@matchedBy` |
| 版本标签：flag + 结构化字段 | — | `line.flag` 单段稳定标识；`versionLabel` 由面板写；撞名靠 `sizeBytes`/`height`/`videoCodec` 区分 | `framework/contracts/contract-source.md#L288-L312@版本标签` |
| 播放项规格 + `playVia` + `ref` | — | `playVia:'client'`(缺省)/`'proxy'`；`ref` = `<插件id>/<自定>`（面板只按第一段路由）；规格 `container` `sizeBytes` `width` `height` `videoCodec` `videoProfile` `bitDepth` `frameRate` `videoRange` `audioCodec` `channelLayout` `channels` `atmos` `bitRate`（假值 0/false/空串=没给） | `framework/contracts/contract-source.md#L51-L93@playVia` |
| 发版前自检清单 | — | 7 项（target / matchedBy / episodeCount / targetNote / items / flag / ref） | `framework/contracts/contract-source.md#L314-L327@自检清单` |

---

## 4. 元数据插件 · `metadata` · `contract-metadata.md`

| 主题 | 入参 | 出参 / 要点 | 权威出处 |
|---|---|---|---|
| 动作总表 | — | `注册`(必需) `取元数据`(必需) `取一季分集`(必需) `搜索`(必需) `http`(可选) | `framework/contracts/contract-metadata.md#L8-L19@动作总表` |
| 取元数据字段（按用途分组） | 条目坐标（一次一个） | 身份 / 名字与时间（`year` 4 位 + `premiereDate` 面板口径 ISO 串 `YYYY-MM-DDT00:00:00.0000000Z`；上游给发行/首播时间就必须同时映这两个键）/ `searchTitle` / 简介 / 图片（海报+背景+图集）/ 分类（`genres` 名列表 + `genreItems` 带数字 id 类型项，**`genreItems` 可选**：上游无 id 可不给）/ 规模与评分 / 详情页那批（标语、状态、时长、分级、制作公司带 id、国家、关键词、外部 id、预告、演职、相似推荐） | `framework/contracts/contract-metadata.md#L21-L39@取元数据` |
| 相似推荐字段 | — | 每项：`entryId` `type` `title` `year` `overview` `communityRating` `posterPath` `backdropPath`；拿不到如实回空数组 | `framework/contracts/contract-metadata.md#L41-L44@相似推荐` |
| 取一季分集字段 | 条目坐标 + 季号 | 集号 / 集名 / 简介 / 首播（`premiereDate`，同上口径；可一并给 `year`）/ 剧照 / 评分 / 时长 | `framework/contracts/contract-metadata.md#L46-L49@取一季分集` |
| 能力申报 | — | 申报「会哪些 / 缺哪些」+ 剧集式 / 电影式 | `framework/contracts/contract-metadata.md#L51-L54@能力申报` |
| 条目外链 `links` | — | `[{name,url}]`；占位符 `{type}`→movie/tv、`{id}`→编号（面板 URL 编码） | `framework/contracts/contract-metadata.md#L56-L68@links` |
| 条目 Id | — | 形状由**面板**统一规定，插件只提供编号 + 声明剧集式/电影式 | `framework/contracts/contract-metadata.md#L74-L78@条目 Id` |

---

## 5. 字幕插件 · `subtitle` · `contract-subtitle.md`

| 主题 | 入参 | 出参 / 要点 | 权威出处 |
|---|---|---|---|
| 动作总表 | `tracks`：坐标+超时 / `fetch`：`{ref}` | `tracks`→`[{lang,format,label?,ref}]`；`fetch`→`{body,contentType?}` | `framework/contracts/contract-subtitle.md#L8-L23@动作总表` |
| `tracks` 字段 | `{name, originalName, year, season, episode}` | `lang`(必) `format`(必,srt/ass/ssa/vtt) `label?` `ref`(必)；多语言是契约能力，报空数组合法 | `framework/contracts/contract-subtitle.md#L25-L46@申报哪些轨` |
| `ref` 凭据 | — | 形状 `<插件id>/<自定>`，不透明；可重复解析是插件义务 | `framework/contracts/contract-subtitle.md#L48-L56@凭据` |
| `fetch` 取内容 | `{ref}` | `{body,contentType?}`；`body` 是字符串；**失败必须 `throw`**（不认 `{ok:false}`） | `framework/contracts/contract-subtitle.md#L58-L67@给出某条轨的内容` |
| 缓存与设置 | — | 字幕内容缓存归插件自己；webui 挂「字幕」栏 | `framework/contracts/contract-subtitle.md#L69-L86@缓存` |

---

## 6. 输出插件 · `output` · `contract-output.md`

| 主题 | 入参 | 出参 / 要点 | 权威出处 |
|---|---|---|---|
| 概述与失败口径 | — | 不占端口 / 不接 Emby；`http` 用返回体 `status` 表失败（不靠抛）；hostCall 失败码映射 `BAD_INPUT/NO_DOMAIN/NO_SITE/NO_SOURCE`→400、`TIMEOUT`→504、其余→502 | `framework/contracts/contract-output.md#L8-L19@失败口径` |

---

## 7. webui 前端 · `plugin-webui.md`

| 主题 | 入参 | 出参 / 要点 | 权威出处 |
|---|---|---|---|
| SDK 入口 | — | 唯一稳定入口 | `framework/contracts/plugin-webui.md#L13-L28@SDK` |
| 样式可用范围 | — | — | `framework/contracts/plugin-webui.md#L29-L36@样式` |
| 通道前缀（易踩坑） | — | 不能 `fetch('./api/x')`，要拼 `API + '/x'` | `framework/contracts/plugin-webui.md#L37-L51@通道前缀` |
| 门禁 | — | 静态资源与转发通道默认须登录 | `framework/contracts/plugin-webui.md#L52-L58@门禁` |

---

## 8. 失败口径速记

| 通道 / 类型 | 失败怎么表达 |
|---|---|
| `metadata`（`lookup`/`season`…） | 信封式：`throw`（带 `e.code`）**或**回 `{ok:false,error:{code,message}}`，两者等效 |
| `source`（`search`/`detail`/`play`…） | 信封式：`throw` **或**回带 `error` 的对象 |
| `home`（`rows`/`run`） | 裸值式：**只能 `throw`**（回 `{ok:false}` 会被当「成功但空行」） |
| `subtitle`（`tracks`/`fetch`） | 裸值式：**只能 `throw`**（回 `{ok:false}` 会被当「成功但没内容」） |
| `output`（`http`） | 看返回体 `{status, body}`（`status` 缺省 200），用 `status` 表失败，不靠抛 |

出处：`framework/contracts/plugin-contract.md#L370-L388@必须 throw`

---

## 9. 维护

1. 改契约正文（`framework/contracts/*.md`）。
2. 同步本文件对应行的 §区间 / 锚点。
3. `node framework/tools/index-check.js` —— 全绿再走下一步。
4. `CHANGELOG.md` 记档（改了什么、为什么、指向面板/插件仓的对应变更）。
