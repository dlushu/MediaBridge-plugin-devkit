# 更新记录

本仓（插件开发套件 devkit）的变更记录。**契约变更**（加字段 / 改语义 / 改动作名 / 改失败口径）
一律记在这里，并指向面板 / 插件仓的对应改动（见 `AGENTS.md` 铁律 6）。

版本号见 `framework/framework.json` 与 `VERSION`。

## 未发布

（暂无）

## v0.2.0 — 2026-10-19

### 契约（`framework/contracts/`）

- **`playVia` 的 `'proxy'` 语义扩到「地址客户端拿不到」两类**（原口径只管「必须带一串鉴权头才取得动」）。
  起因：红果短剧插件（`plugins/hongguo`）的媒体是**加密**的，由插件进程内的**本地解密代理**吐明文，地址恒为
  `127.0.0.1:<随机端口>` —— 它**不需要任何请求头**（实测：裸取上游 CDN 直链 **HTTP 200**、带 `Range` **206**、
  带错 `Referer` 反而 **403**；插件自己取上游只发 `Range`+`Accept-Encoding`；`play` 回的 `header` 是 `{}`），
  却**必须**由面板代取，否则客户端够不着回环地址。按原口径，这种线路只能**谎报 `proxy`**（"需要头"），
  属契约语义缺口。现补：
  - `contract-source.md` 的 `playVia` 表与判据：`'client'` = 「地址客户端能直接用」；`'proxy'` = 「地址客户端拿不到」，
    含 ① 缺鉴权头、② **只有面板够得着**（回环 / 插件进程内本地服务）；第 ② 类 **`header` 可以为空**。
    判据由「不带头发出去客户端能不能播」改为「**把地址交给客户端，它能不能自己取到并播**」。
  - 新增一条**面板义务**：第 ② 类地址**不得外转给第三方中继** —— 既然"只有面板够得着"，外转必然取不到；
    面板设置里「外转到外部字节代理」那类转发对这类 `proxy` 线路必须不生效（留在面板自己搬，或如实报错）。
  - `framework/INDEX.md` 的 `playVia` 速查行同步（指针 → `contract-source.md#L51-L99`）。
- **面板侧对应改动**：**运行行为不变、无需改代码** —— 面板对 `proxy` 一律走「代取中继」，第 ② 类本来就落在这一档；
  但**文档口径**（面板 `docs/adr/0042-auth-line-byte-relay.md`）与上面那条「外转不得吃这类地址」**需面板确认**。
- **插件侧**：`plugins/hongguo` 标 `playVia:'proxy'` 由「谎报」变为「如实」，**插件不改**；
  取证见 `plugins/hongguo/PLAN.md` §16。

## v0.1.3 — 2026-10-14

### 契约（`framework/contracts/`）

- **新增源插件直绑声明 `binds`（源插件按元数据域条目 Id 直连，跳过按名搜索）**。起因：面板取详情已优先走
  `metadata/lookup`，但第二步「源绑定」按 ADR-0003 拿**整句标题**去源站搜、按名打分（`match.js`）。对
  **搜索精度极差**的站点（实测 Pornhub：对任意查询都回一批泛化结果，首条从不是目标）按名搜必然命中 0，
  条目永远拿不到线路。根因不是插件、不是面板实现，而是**缺一条"用条目 id 直连源插件"的通道**——面板
  `agg.detail` 已有 `source+site+vodId` 快路径，但没有契约依据断言"元数据域的 entryId 就是某源插件的 vodId"
  （两类插件互不感知，连接点只能在面板）。现补：
  - `framework/contracts/plugin-contract.md` 字段表（`domain` 行后）新增可选字段 `binds`：域 id 数组，
    声明本源插件认领哪些元数据域的条目 Id。§一「可选能力的申报」的 `source` 可选项列举补 `binds`。
  - `framework/contracts/contract-source.md` 新增 `### 直绑元数据域条目 Id（binds）` 一节（落在「取数式样」
    之后），**写明两点语义**：
    1. **失败回落（契约义务）**：面板先直绑（`detail({id: entryId})`）；`detail` 失败（抛错 / `error` /
       `target` 为 `null` / `items` 为空）**必须回落**按名搜索（`search` → 打分），回落路径判据 / 分数线 /
       `maxItems` 等一切不变。多个源插件同域声明 ⇒ 都试（各算版本）。条目 Id 解不出域 / entryId 时跳过直绑。
    2. **`vod_id` 回传口径**：直绑 `detail` 须回**资源级** `detail.vod_id`；面板**不解释语法、不校验、
       不反查**，**原样**记入 `ProviderIds`（键 = 本域）并编进播放 `ref`。插件必须保证 `vod_id` 稳定可复用。
  - **新增可选字段、可选语义 ⇒ 向后兼容**：旧面板不认 `binds` 就当它不存在（退化为按名搜，行为同前），旧插件不声明它
    也不受影响，故**契约版本号仍为 `1`、不升号**。新面板消费 `binds` 即启用直绑 + 回落 + `vod_id` → `ProviderIds`。
  - **同步**：`framework/INDEX.md` §1（plugin.json 字段加 `binds`）与 §3（新增 `binds` 行）已同步，跑了
    `index-check.js`（48 引用全命中）；因字段表 +1 行、source 契约 +40 行，本节及 §3 全部后续指针已平移。

- **新增「面板代取图片」（`/api/emby/img/…`）**。起因：有些图床**不带 Referer 一律 403**（实测
  `pix-cdn77.phncdn.com` 裸拉 7/7 全 403），而封面地址是面板用 `Items/{id}/Images/Primary` **302** 给客户端、
  由客户端**自己直连**取的，带不上 Referer —— 那批封面在客户端**恒空白**。此前只有两条歪路：插件里配一个
  外部 CF Worker 代理（要用户额外部署），或让**面板硬编码站点域名 + Referer**（实测踩过：把 `\.phncdn\.com$`
  当白名单、把 `www.pornhub.com` 当 Referer，那是把插件的站点知识塞进通用面板，已废弃）。现补：
  - `framework/contracts/plugin-contract.md` §一 新增 `### 面板代取图片（/api/emby/img/…）`：图片字段
    （`posterPath`/`backdropPath`/`vod_pic`/`item.poster`）可给**根相对**的
    `/api/emby/img/{host}/{path}?{上游 query}&mbh={头}`，声明「这张图请面板代取」。
    `mbh` = `base64url(JSON)` `{ referer?, userAgent? }` —— **要什么头由插件给**，面板不猜、也不许写站点域名；
    签名由面板在把地址发给客户端前补上（覆盖 `{host}/{path}/query/mbh`），取图时验它，客户端改不了头。
    缺 `mbh` 时面板用自引用 `https://{host}/` 兜底。
  - **面板侧对应变更**（`media-bridge-panel`）：新增图片中继端点 `GET /api/emby/img/{host}/{path}`
    （`server/modules/agg/stream.js` 的 `serveImage` / `signImagePath`）；出图那一跳
    （`server/modules/emby/routes.js` 的 `imagesByType`）对根相对地址补签名并补成绝对地址；
    **面板端口与实例端口都放行**该端点 —— 客户端从哪个端口连进来，302 就落在哪个端口上。
    同批修掉两处与站点无关的通用缺陷：`/api/emby/hls` 同样两端口放行；`/api/agg/hls` 补进门禁豁免（先前吃 401）。
  - **新增可选语义 ⇒ 向后兼容**：不认这个形态的面板照旧 302 到原地址（退化为客户端直连，行为同前）；
    插件不给这个形态也不受影响。故**契约版本号仍为 `1`、不升号**。
  - **插件侧**：`plugins/app.pornhub` 自 1.2.12 起把 `*.phncdn.com` 图床封面统一改写成该形态
    （不按子域挑：图床行为随时会变，拿不准时统一代取更稳）。
  - **同步**：`framework/INDEX.md` §3 新增「面板代取图片」一行；因本节 +35 行，其后全部指针已平移，
    并**顺带修正 6 条既存失效指针**（`执行模型`/`按类型的动作契约`/`播放地址的转交`/`模板与域`/`缓存分工`/
    `失败与诊断`，binds 那次同步时偏移少算了 14 行）；`index-check.js` 现 **49 引用全命中、覆盖率 100%**。

### Agent 规则（`AGENTS.md`）

- **新增跨类型通则「可选能力的申报」**。起因：`home` 插件缺 `feed`，契约只写清 `feed` 是**可选**、
  不申报也合规，**没写"不申报的代价"**，容易被读成"可省"——结果是客户端首页**推荐位 / 轮播恒空**。
  同类问题不止 `feed`（`metadata` 的 `genreItems`、字幕多语言轨、`updateUrl` 等皆然）。现补：
  - `framework/contracts/plugin-contract.md` §一 新增 `### 可选能力的申报（跨类型通则）`：**有能力就
    申报**（漏申报＝客户端**白少一块**，如无 `feed` 则推荐位恒空、无 `genreItems` 则类型栏不可点）；
    **发现即提醒**（开发 / 评审时主动对照可选项，有能力却漏申报的当场指出）；**绝不硬造**（没能力 /
    取不到就如实留空，不许为凑满可选字段编数据）。**不新增字段、不改语义、不改动作名，属合规澄清，
    不升号。**
  - `framework/contracts/contract-home.md` 的 `feed` 段改为**指向该通则**，不再单列一份重复建议。
- **面板侧无需改动**（面板既有行为即"把不带库 Id 的 `SortBy` 路由到第一个声明 `feed` 的行，无声明则回空"）。
- **同步**：`framework/INDEX.md` §1 通用模型新增该行并按 `+13` 修正本节全部指针；§8 出处指针同步平移。

### Agent 规则（`AGENTS.md`）

- **新增第 14 条铁律「动插件必核对『可选申报』，缺了当场提醒」**：新建 / 修改 / 评审 / **打包**任何插件时，
  主动对照该插件的可选字段 / 动作清单，**有能力却没申报的当场向用户点名提醒**；提醒 ≠ 强制，确属没能力
  就留空，**严禁编数据**。这条把"缺 `feed` 要主动提"从一次性对话升级为**对任何插件、任何可选项都成立**的
  常规动作。
- 实例：`plugins/javdb`（官方 App API 无 random 端点，当前 9 行均未申报 `feed` → 推荐位恒空）。

## v0.1.2 — 2026-10-10

### 契约（`framework/contracts/`）

- **`contract-home.md`：写清 `total` 由插件自定义 + 面板跨行汇总口径**。此前只写了 `total` 的含义
  （"这个库有多大"）与「`>0` 才采用」，**没写面板对同一 `collectionType` 的多行 `total` 如何汇总**——
  于是「一个插件有多个同类型库、想让客户端显示为合并 / 相加」时无据可依。现补：`total` **完全由插件
  自定义**（面板不做任何计算、不相加）；汇总时**同一 `collectionType` 的多个行取 `total` 最大者、不参与相加**，
  `mixed` 行不参与 —— 故想要"相加"就让这几行**都申报同一个合计值**，想要各自真数就各报各的。属**口径澄清**
  （不改字段、不改形状，不升号）。**面板侧无需改动**（即面板 `server/modules/emby/home/index.js`
  `libraryTotals()` 的既有行为）。
  **同步**：`framework/INDEX.md` §2 首页 `rows` 行补该口径并修正既有指针偏移。
  实例：`plugins/hongguo`（短剧 + 漫剧两行申报同一合计值 → 客户端汇总显示为两者相加）。

- **`contract-metadata.md`：把「年份 / 首播日期」落到具体键名与格式**。「取元数据」的「名字与时间」
  与「取一季分集」的「首播」此前只写了语义（年份、首播日期），没点键名与格式，导致插件常漏回 →
  客户端「年份 / 首播」显示成 `0`。现明确：`year`（4 位字符串）+ `premiereDate`（面板口径 ISO 串
  `YYYY-MM-DDT00:00:00.0000000Z`）；上游给发行 / 首播时间（含 unix 秒时间戳）就必须同时映这两个键，
  取不到才留空。属**兼容澄清**（键名/格式与面板既有行为、tmdb / missav 参考实现一致，不是新语义）。
  **面板侧无需改动**。
  **同步**：`framework/INDEX.md` 元数据两行（`#L21-L31`、`#L40-L43`）补键名 + 格式；
  `framework/DEV-NOTES.md` 新增 §8（踩坑与排查口径）；`framework/templates/metadata/index.js`
  的 `lookup`/`season` 骨架注释带上该提醒（新插件落地即自带）。
  实例：`plugins/hongguo`（官方 `first_visible_time` → `year`+`premiereDate`）。

- **`contract-metadata.md`：把「分类」里的 `genreItems` 明确为可选字段**。此前写「类型名列表 **与带 id
  的类型项**」，读起来像**必须**给 `genreItems`；但上游常**只有类型名、没有 id**（如 hongguo），硬凑 id
  反而要编假 id。现补：`genreItems`（带**数字** id 的类型项，客户端据此把"类型"做成可点链接）**由插件依
  上游实际情况自定** —— 上游有 id 就一并给，**只有名字、没有 id 时可以不给**（面板照收 `genres`，客户端
  只是这一栏点不进去，不会报错、更不要编假 id）。附一条面板事实：给了 id 等于承诺"点类型能进列表"，而该
  列表端点**面板尚未实现、会 501**（ADR-0056 界内待补）。属**兼容放宽**（不改字段形状、不新增语义，
  **不升号**）。**面板侧无需改动**（面板 `server/modules/emby/service.js` 本就是「有 `genreItems` 才映射、
  没有就走骨架默认 `[]`」的既有行为）。
  **同步**：`framework/INDEX.md` §4 元数据「分类」要点补「`genreItems` 可选」，并修正本节各引用因插入
  正文产生的行号偏移。
  实例：`plugins/hongguo`（上游无类型 id，只回 `genres`，不提供 `genreItems`）。

## v0.1.1 — 2026-10-10

一轮"用一条真实字幕插件跑完整一条龙"的实战暴露并修正的问题。
（实战插件：迅雷字幕，`subtitle` 类型，实现放仓库外的开发目录，不入本仓。）

### 契约（`framework/contracts/`）

- **失败回执新增可选 `cause` 字段**（`plugin-contract.md` 第十节）：异常上若带 `cause`，
  面板一并带回 `error.cause = { code?, message? }`。Node `fetch()` 失败时 `e.message` 恒为
  `fetch failed`，真因（`ENOTFOUND` / `bad port` 等）在 `e.cause` —— 此前宿主 `runner.js`
  只取 `code` / `message`，把它压成通用的 `PLUGIN_ERROR: fetch failed`。属**兼容追加**（加可选字段，不升号）。
  **面板侧对应改动**：`server/modules/plugin/runner.js` 动作异常回执透传 `cause`（面板仓）。
- **新增"各通道怎么表达失败"总表**（`plugin-contract.md` 第十节）：此前契约只零散提到"失败照实"，
  没规定 throw 与"业务信封"的边界。现明确五类通道口径 ——
  - `metadata`：认 `r.ok` **加**返回体 `v.ok===false` → throw 或回 `{ok:false,error}` 皆可；
  - `source`：认 `r.ok` **加**返回体 `res.error` → throw 或回带 `error` 的对象皆可；
  - `home` / `subtitle`：**只认宿主 `runner.js` 的 `r.ok`，不看返回体 `ok`**（直接把 `value`
    当数据用）→ 失败**必须 throw**，回 `{ok:false,error}` 会被当成"成功但没内容"；
  - `output`：用返回体 `{status}` 表达失败，不靠抛。
  **面板侧无需改动**：这是把面板既有行为写进契约，不是新语义。
- `contract-home.md` / `contract-subtitle.md` / `contract-source.md` / `contract-output.md` /
  `contract-metadata.md`：在各自动作处补上上述失败口径的**内联提醒**（含 metadata 的 `http`
  入参出参、subtitle 设置页指向与 `webui` 的关系）。
- `plugin-contract.md` 第九节：导航举例补全五类（原先只举了部分），并修正一处过期交叉引用
  （"见第十四节"→"见第十一节"）。
- `plugin-webui.md`：开头补"入口怎么挂由 `plugin.json` 的 `webui` 字段决定、挂在所属类型那一栏"，
  第五节铁律同步（"是否挂、挂哪栏"由 `webui` 决定，不写就不挂）。
- `AGENTS.md` 铁律 1 / 6：改为自洽口径 —— 契约正文是本仓权威件、**由仓库所有者维护**
  （插件开发者只读、走上报）；契约变更改完正文后记本文件，并同步打包侧校验副本。

### 工具（`framework/tools/`）

- **`new.js`**：生成 `metadata` 骨架时，`domain` 不再直接套用插件 id。插件 id 允许 `.` `-` `_`，
  而域 id 只认 `^[a-z][a-z0-9]*$` —— 原实现会让**任何带 `-` 的 metadata 骨架一上来就 check 失败**。
  现改为按 id 洗出合法域 id，并支持 `--domain 域id` 指定、非法即报错退出。
- **`panel.js`**：修正 `call` / `restart` / `uninstall` 子命令的 `argv` 取值 —— 原实现少跳一位，
  把子命令名 `call` 当成了类型，`call` 这条命令实际不可用。
- **`index-check.js`（新增）**：校验 `framework/INDEX.md` 里每个 `file#Lx-Ly@锚点` 引用仍命中
  （文件存在 / 区间合法 / 区间含锚点），并检查 `framework/contracts/` 覆盖率。契约改版导致区间
  漂移会在此暴露。用法：`node framework/tools/index-check.js`。

### 模板（`framework/templates/`）

- **`home/index.js`**：`run` 桩由回 `{ok:false,error}` 改为 **throw**（对齐 home 宿主失败口径，
  见上；回信封会被当成"成功但这一行是空的"）。
- **`subtitle/index.js`**：`fetch` 桩由回 `{ok:false,error}` 改为 **throw**（同理）；补 `http`
  动作桩（设置页通道）。
- **`subtitle/plugin.json`**：补 `webui` 字段，骨架即带设置页入口（挂「字幕」栏）。
- **`metadata/plugin.json` + `index.js`**：`domain` 改用 `__PLUGIN_DOMAIN__` 占位（配合 `new.js`）。
- **`output/` 与 `subtitle/`**：补 `ui/index.html` 设置页骨架（此前这两类模板缺 `ui/`，
  与 `webui` 字段不配套）。

### 文档

- 新增 `framework/INDEX.md`：**速查索引**（派生 cheat-sheet）。按 5 个类型把每动作压成一行
  「入参键 → 出参键 → 权威出处指针」，定位动作 / 字段时先查它，不够再定点读契约正文对应区间，
  避免整读大契约。**不是权威件**，与正文冲突以正文为准；正文变更后须同步本索引。
  `README.md` 目录树与 `SKILL.md` 契约索引已加指向它的入口。
- `AGENTS.md`：新增第 10 条 —— **大文件取证走 subagent + 结论必须落盘（铁律）**（单次 >300 行
  或 >~3000 token 的取证一律交 subagent，主上下文只收「结论 + `file#Lx-Ly`」；结论当场写入
  `PLAN.md` / `DEV-NOTES.md`）；新增第 11 条 —— **先查索引再读正文**（先读 `framework/INDEX.md`，
  改正文后同步索引并跑 `index-check.js`）。两条针对「反复压缩却不开工」的根因。
- 新增 `framework/DEV-NOTES.md`：**开发避坑 / 常见问题**（独立于契约，面向"卡住了照这条查"），
  收录本轮实测真踩到的 6 条，逐条标明归属（插件写法 / devkit / 环境 / 正常行为）。
- `plugin-contract.md` 第一节字段表 `domain` 行：补"**域 id 比插件 id 严**（只认 `[a-z][a-z0-9]*`），
  **不能直接拿插件 id 复用**"——这是本轮 A 项骨架必挂的根因，此前契约未点明两套规则不同源。
- `SKILL.md`：契约索引后加"开发避坑"指针；铁律 2 与末尾"契约问题反馈"口径同步为自洽版本
  （与 `AGENTS.md` 铁律 1/6 一致：契约正文由仓库所有者维护、插件开发者只读/上报）；
  新增"**面板问题反馈**"一节 —— 撞到面板 bug / 不利开发时，先判归属，产出**可复现的问题报告**
  （现象 / 复现步骤 / 期望vs实际 / 原始证据 / 定位线索 / 环境）交给用户反馈给面板维护者；
  **明确面板 bug 不落盘、只在当轮对话输出**。
- `AGENTS.md`：新增第 8 条 —— **面板 bug 不落盘**（不改 docs / 不记 `CHANGELOG.md` / 不写
  `DEV-NOTES.md`），只当轮对话输出可复现报告给用户反馈面板维护者（面板随时在变，落盘即过期误导）。
- `AGENTS.md` 第 1 条 / `SKILL.md` 铁律 2 + "契约问题反馈"：**契约修改权限按推送权判定** ——
  对 `dlushu/MediaBridge-plugin-devkit` 有 **push 权限**者 = 仓库所有者（可直接改契约正文 + 记档）；
  **无该仓推送权限**的开发者只读、按契约开发、发现问题上报，别自改正文。
- `README.md`：目录结构补 `DEV-NOTES.md`。
