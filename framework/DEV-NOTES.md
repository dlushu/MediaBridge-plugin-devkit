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
