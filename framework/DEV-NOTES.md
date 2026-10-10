# 开发避坑 / 常见问题（DEV-NOTES）

本文件收集**开发 MediaBridge 插件时真踩到**的坑与排查口径。

- 契约（`framework/contracts/`）是"**应该怎样**"的权威件；
- 本文件是"**实际会怎样、卡住了照这条查**"的经验补丁。

**二者冲突以契约为准。** 每条都标明是"插件写法 / devkit / 环境 / 正常行为"。

> **面板自身的 bug 不在此记录**：面板随时在变，落盘会过期误导。撞到面板 bug 只在**当轮对话**里给用户一份可复现报告，由用户反馈面板维护者（见 `AGENTS.md` 第 8 条）。

---

## 1. `check.js` 一上来就挂 metadata 的 `domain`

- **症状**：`node framework/tools/check.js <id>` 报域 id 非法。
- **原因**：域 id 只认 `^[a-z][a-z0-9]*$`（小写字母开头 + 小写字母/数字），比想象中严。
- **高发**：插件 id 允许 `.` `-` `_`（如 `my-meta`），**不能直接把插件 id 当域 id 用**——这是两个不同源的规则。
- **解决**：`plugin.json` 的 `domain` 单独写一个合法域 id。`new.js` 生成 metadata 骨架时已自动洗出合法值，也支持 `--domain 域id` 指定。
- **归属**：插件（写错）/ 已由 devkit 在骨架侧兜底。

## 2. `panel.js call` 真机回 `502` + `{ok:false,error:{...}}`

- **不是链路坏了**：这是插件**按契约如实抛错**被面板翻译出来的样子。
- `home` / `subtitle` 这类通道，宿主（`runner.js`）**只认进程回执的 `r.ok`**；插件一旦 `throw`，回执 `ok:false`，面板 API 把它翻成 `HTTP 502` + 错误体。
- **怎么读**：看 `error.code`——插件自己设的 `e.code` 会**原样透传**（如 `BAD_REF` / `UPSTREAM_HTTP`）。
- **结论**：只要 `code` 是插件里显式设的，就是**我们自己的业务失败、链路是通的**。
- **归属**：正常行为（口径见总契约第十节）。

## 3. 网络请求失败只有一句 `fetch failed`，定位不到原因

- **原因（Node）**：全局 `fetch()` 网络失败**统一**抛 `TypeError: fetch failed`；**真实原因在 `e.cause` / `e.cause.code`**（如 `ENOTFOUND`、`ECONNREFUSED`）。这是 Node 行为，不是插件写错。
- **建议（插件写法）**：网络类失败**显式设 `e.code` 再 throw**（如 `e.code='UPSTREAM_DNS'`），把关键信息从 `cause` 提到 `code`/`message`，失败才可读。
- **归属**：插件最佳实践（Node `fetch` 行为）。

## 4. 直接 `curl` 插件的 `ui/` 或 `api/` 路径回 `401`

- **原因**：`ui/**`、`api/**` 默认走**面板登录门禁**；直连 `curl` 没有会话 cookie，所以 401。
- **不是缺陷**：要靠插件自己的页面（浏览器带 cookie）访问；要对外放行需在 `plugin.json` 的 `ingress` 里显式声明（见总契约第九节）。
- **归属**：正常行为。

## 5. 终端里 `node` / `git` 报 `command not found`（exit 127）

- **原因**：某些 agent 终端的 PATH 被精简，没带上 homebrew / 常用系统路径。
- **解决**：命令前先 `export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"`。
- **归属**：环境问题，与插件无关。

## 6. 各类通道"失败该怎么回"记不住

一句话锚点（**完整口径见总契约第十节**）：

- `metadata`：认 `r.ok` **加**返回体 `v.ok===false` → throw 或回 `{ok:false,error}` 皆可；
- `source`：认 `r.ok` **加**返回体 `res.error` → throw 或回带 `error` 的对象皆可；
- `home` / `subtitle`：**只认 `r.ok`** → 失败**必须 throw**（回 `{ok:false}` 会被当成"成功但没内容"）；
- `output`：用返回体 `{status}` 表达失败，不靠抛。

- **归属**：契约口径（总契约第十节）。

## 7. `home` 的 `run` 不按 `startIndex`/`limit` 填满窗口 → 首页行翻不了页

- **症状**：首页行（分类 / 榜单等）客户端向下翻页时**不出新内容**，被当成最后一页。
- **口径**（权威见 `framework/contracts/contract-home.md` §分页，这里只讲踩法）：
  - 面板与插件层**都不切片**，`startIndex`/`limit` 原样透传给插件，**取哪页、怎么拼由插件决定**。
  - 客户端拿到的 `items` **少于 `limit` 就判最后一页、不再翻**（SenPlayer 6.2.1 实测）。
    所以必须按 `startIndex`+`limit` **连续取上游页填满窗口**，够数或上游给空才停。
- **两个真实踩点**：
  1. **别把"上游每页条数"当常数**：要**用响应实测每页条数**，页码算 `floor(startIndex/perPage)+1`、
     页内偏移算 `startIndex%perPage`。hongguo 曾按 `PAGE_SIZE=40` 硬算页码，而上游列表页实测 **24 条/页**：
     又用 `items.length(24) < 40` 判"已是末页"→ 永远只取第 1 页；`startIndex>0` 还从 `raw[index=startIndex]`
     二次叠偏移 → 直接回空。
  2. **上游根本不给分页时，插件要自己本地分页**：有的榜单页是**单页固定条数、无 `?page=`**
     （hongguo 榜单页 99 条、`?page=2` 同内容）。不能只回第一页、也不能被内部 `slice(0,40)` 截断——
     应**抓整页后在插件内按 `startIndex/limit` 分页**，`total` 回全量，客户端才能翻到全部。
- **实例**：`plugins/hongguo/PLAN.md §10`（红果短剧首页 8 行全踩中）。
- **归属**：插件写法（权威口径见 `contract-home.md`）。

## 8. metadata 不回 `year` / `premiereDate` → 客户端「年份 / 首播」显示 0

- **症状**：条目的年份 / 首播日期在客户端显示 `0`（或空）。
- **口径**（权威见 `framework/contracts/contract-metadata.md#L24`）：metadata 的「名字与时间」要回
  **主标题 / 原始标题 / 年份 / 首播日期**。落地键名（对齐 tmdb、missav 参考实现）：
  - 条目：`year`（4 位字符串）+ `premiereDate`；
  - **季对象**（`seasons[]`）与**分集**（`season` 动作的 `episodes[]`）同样各带 `year` / `premiereDate`。
- **格式**：`premiereDate` 用面板口径 ISO 串 `YYYY-MM-DDT00:00:00.0000000Z`
  （tmdb `ISO_SUFFIX` 与 missav 一致）；`year` 取前 4 位。**别只回裸 `YYYY-MM-DD`**，与参考实现不一。
- **必做（每个 metadata 插件都要自动做的添加）**：上游只要有**发行 / 首播时间**（含 unix 秒时间戳、
  日期串），就**同时映到 `year` + `premiereDate`**。
  - 时间戳示例：hongguo 官方 `seriesDetail.first_visible_time`（unix 秒）→
    `premiereDateOf()`（`plugins/hongguo/lib/service.mjs`）：`new Date(sec*1000).toISOString().slice(0,10)` 再拼后缀。
- **拿不到就如实留空**：缺失字段会被下游兜底成 `0`，所以**取得到就必须回**；确实没有（上游不给）才留空，**别编**。
- **实例**：`plugins/hongguo/PLAN.md §11`（红果三合一的 metadata lookup/season）。
- **归属**：插件写法（权威口径见 `contract-metadata.md`）。

## 9. `home` 的 HomeItem 不回 `year` → 卡片年份显示 `0`（且 `rows` 不申报 `total` → 库角标/汇总计数缺失）

- **症状**：首页卡片标题下的**年份一律显示 `0`**；媒体库角标（`Views.ChildCount`，即"总库数"）在**库没被点开时**显示占位 `1`、
  客户端"媒体库数量"汇总（`Items/Counts`）为 `0`。
- **口径**：`HomeItem` 的 `year` 是**数字**（`0` / 非法会被丢弃 —— 但**丢了不是"不显示"**，见下）；`rows` 的 `total` 见
  `framework/contracts/contract-home.md`（`total` = 这个库**总共有多少条**，与 `run` 的 `total` 同口径，
  **只在 `> 0` 时被采用，取不到就不写，别写 0**）。
- **必做（每个 home 插件都要自动做的添加）**：
  - **home 条目只要有年份就回 `year`（数字）**。⚠️ 面板把条目转 Emby DTO 时是
    `ProductionYear: Number(f.year) || 0` —— **不回 `year` 就等于渲染 `0`**（不是留空）。所以上游有年份就**必须回**。
  - **`rows` 里能拿准库规模就申报 `total`**（面板据此在客户端**还没点开库**时就显示真数；不申报则该行未点开时占位 `1`）。
    申报 `total` 通常要**联网取一次上游库规模**（属扇出，动手前先跟用户确认），并配插件侧缓存压频率。
- **`total` 完全由插件自定义，面板不计算、不相加**（只是面板事实，不是插件要遵守的规则）：面板汇总时对
  **同 `collectionType`** 的多行 `total` **取最大值**、`mixed` 行不参与（面板 `server/modules/emby/home/index.js`
  `libraryTotals()`）。报什么数完全由开发者依「这个库有多大」自行决定，多行同类型时可以自选：
  - 想让客户端**显示成合计 / 相加** → 这几行**都申报同一个合计值**（hongguo 短剧 + 漫剧就是这么做的）；
  - 想让每行**显示各自真数** → 各报各的，汇总取其中**较大**者。权威口径见 `framework/contracts/contract-home.md`（`total` 段）。
- **踩点（数据要带过"边界"才在）**：数据在解析层拿到了，不等于服务层拿得到 —— hongguo 的
  `mirrorCards` 把上映日期放进 `_text`，而 `publicItems` 会剥掉所有 `_` 前缀键，**跨 worker HTTP 就没了**。
  要让字段活到出参，必须在解析层就落成**正式字段**。实例：`plugins/hongguo/PLAN.md §13`。
- **归属**：插件写法（权威口径见 `contract-home.md`）。
