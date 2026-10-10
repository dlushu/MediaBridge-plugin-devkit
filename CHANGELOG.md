# 更新记录

本仓（插件开发套件 devkit）的变更记录。**契约变更**（加字段 / 改语义 / 改动作名 / 改失败口径）
一律记在这里，并指向面板 / 插件仓的对应改动（见 `AGENTS.md` 铁律 6）。

版本号见 `framework/framework.json` 与 `VERSION`。

## 未发布

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
