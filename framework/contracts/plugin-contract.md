# 插件契约

> **契约版本：1**。本文描述的是面板与插件之间的**现行契约**（不是规划）：不兼容变更
> （删字段、改语义、改动作名）会让版本号 +1；兼容追加（加可选字段、加可选动作）不升号。
> 插件在 `plugin.json` 用 `contract` 字段声明自己按哪版开发。
> 决策依据见面板仓库 [docs/adr/](https://github.com/dlushu/media-bridge-panel/tree/main/docs/adr) 的 0028~0035；
> 制定过程的存档见插件仓库 [plugin-arch-draft.md](https://github.com/dlushu/media-bridge-plugins/blob/main/docs/plugin-arch-draft.md)
> 与 [plugin-migration-plan.md](https://github.com/dlushu/media-bridge-plugins/blob/main/docs/plugin-migration-plan.md)。

本文是插件契约的**唯一来源**：插件能做什么、面板会怎么调它、哪些必须遵守。代码里不放本文没写的字段或行为。

配套：面板仓库的 [ARCHITECTURE.md](https://github.com/dlushu/media-bridge-panel/blob/main/ARCHITECTURE.md)（分层与依赖方向）与
[develop.md](https://github.com/dlushu/media-bridge-panel/blob/main/docs/develop.md)（开发环境与实现要点）、
[contract-home.md](contract-home.md)（首页插件的行与条目规范）。

---

## 一、定位与边界

| 角色 | 是什么 |
|---|---|
| **插件** | 一个可安装、可卸载的包，跑在自己的常驻子进程里，提供若干**动作** |
| **面板** | 宿主：安装校验、启停、把请求转成"对插件的动作调用"、把结果转成 Emby DTO 或页面数据 |
| **模板** | 一份配置数据文件（站点集合 + 打分过滤参数），按**域**被选用 |

**铁律（与项目既有取向一致）**

1. **不编数据**：插件给不了、或这次取失败，面板一律**如实留空并点名**，不猜、不静默。
2. **面板不解释插件的数据**：动作的入参出参由本文规定；插件内部怎么取数、怎么组织，面板不关心。
3. **不为未发布的东西留兼容**：契约、字段名、动作名该改就改，不留双读分支。

---

## 二、插件的身份与目录

- **类型**：`metadata`（元数据）、`source`（源）、`home`（首页插件）、`output`（输出：给外部播放器/外部消费方的出口插件）、`subtitle`（字幕：为播放目标申报字幕轨并给出内容）。
- **身份** = `插件 id`。一个 id 只有一个目录、一个进程、一个开关、一份数据；
  但一个包可以**同时是多个平级类型**（`types: ["home","metadata","source"]`，见 [ADR-0046](https://github.com/dlushu/media-bridge-panel/blob/main/docs/adr/0046-plugin-multiple-types.md)）。
  旧的单类型包（只写 `type`）仍然全部兼容。
- **目录布局**（都在数据目录下；v2 起拍平，不再按类型分目录）：

  ```
  plugins/<插件 id>/                  包本体（代码 + 自带 webui 静态文件 + 声明文件）
  plugins/<插件 id>/data/             插件自己的数据目录（设置与缓存都在这里）
  ```

  多类型包各角色的代码建议放在 `roles/<类型>/` 子目录，**写盘的文件名按角色隔开**
  （例如 `data/home-settings.json`、`data/metadata-settings.json`）——共享一份数据，但不能互相踩文件。

- **包**：一个 `tar.gz`。安装 = 解到 `plugins/<插件 id>/`（解出来的目录多一层也认）。
  **两道校验**（与源包同一套，见 [ADR-0015](https://github.com/dlushu/media-bridge-panel/blob/main/docs/adr/0015-source-bundle-integrity.md)）：
  ① 包本身的 md5（发布方给的那个，可省）；② 清单里 `files` 声明的**逐个文件** md5。
  任一道对不上就**当场拒绝**，不"先装上再说"、也不拿实际值去覆写清单假装成功。
- **包里的 `plugin.json`**（缺它装不上）：

  | 字段 | 必填 | 说明 |
  |---|---|---|
  | `id` | 是 | 反向域名风格，**全局唯一**（身份就是 id） |
  | `name` | 是 | 显示名 |
  | `version` | 是 | 版本 |
  | `types` | 是* | 类型数组，如 `["metadata","home"]`；顺序即展示顺序，第一个是"代表类型"。*旧包可只写单个 `type`，按单元素数组兼容 |
  | `main` | — | 入口文件，默认 `index.js` |
  | `domain` | 含 `metadata` 类型时必填 | 它注册的**域 id**（条目 Id 的前缀，形状 `[a-z][a-z0-9]*`，见 [ADR-0031](https://github.com/dlushu/media-bridge-panel/blob/main/docs/adr/0031-metadata-by-domain.md)）。**域 id 比插件 id 严**：只认小写字母开头 + 小写字母/数字，**不能直接拿插件 id 复用**（插件 id 允许 `.` `-` `_`） |
  | `series` | — | 元数据角色：剧集式（默认 `true`）还是电影式 |
  | `webui` | — | webui 入口。单类型包可写字符串（`ui/index.html`）；多类型包写 **`{ 类型: 入口 }`** 映射（`{"home":"roles/home/ui/index.html"}`），哪个类型给了入口，侧栏就在哪一栏挂一个页面 |
  | `files` | — | `{ 相对路径: md5 }` —— 给了就逐文件核对（第二道校验） |
  | `depends` | — | 依赖的域 id 或 `类型:id`；**缺依赖如实失败并点名**，不半启动 |
  | `ingress` | — | 外部 HTTP 入口的鉴权声明 `{ public: [], token: [] }`，只对 `ui/**`、`api/**` 两条路径生效；缺省全走面板登录门禁。写法与语义见第九节 |
  | `updateUrl` | — | **插件自更新清单**地址（http(s)，Magisk 式，见下）；不写就只能从插件库更新 |
  | `contract` | — | 本插件按哪版契约开发（整数，当前 `1`；缺省按 `1`）。契约做不兼容演进时，面板据此区分新旧插件 |
  | `description` | — | 一句话说明 |
  | `author` | — | 作者署名（插件库与管理页里显示；不写就不显示这一行） |

- **插件不随面板发行**：面板的 Release 包里**只有面板本体**，装完是**零插件** ——
  插件从**插件仓库**（默认 `dlushu/media-bridge-plugins`，可用 `PLUGIN_REPO` 换）的「插件库」页安装，
  或者在管理页上传一个 `.tar.gz` 手装（见下）。仓库里**只收打好的包与清单**，不收插件源码。
- **卸载是真的卸掉**：进程停掉、目录删掉，重启之后面板**不会**把它装回来
  （原先的开机同步内置插件已删除，见 [ADR-0035](https://github.com/dlushu/media-bridge-panel/blob/main/docs/adr/0035-plugin-library.md)）。
- **插件的设置与缓存都由插件自己管**（都在它自己的 `data/` 下）。面板里的"清空插件数据"
  就是**删这个目录**。

### 插件从哪来：插件库与手动安装

两条来路，做的都是"解一个 `tar.gz` 装进 `plugins/<id>/`"，区别只在包从哪来。

| 来路 | 入口 | 包从哪来 | 记的 `origin` |
|---|---|---|---|
| **插件库** | 「插件」栏的「插件库」页 | 插件仓库的清单与包 | `library` |
| **手动安装** | 「插件」栏的「管理」页 | 本地上传的 `.tar.gz` | `manual` |

- **清单**：插件仓库根目录一个 `index.json`（`schema: 2`），逐条给出 `types` / `id` / `name` /
  `author` / `version` / `description` / `domain` / `hasWebui` / `depends` / `bytes` / `md5` / `path`
  （`schema: 1` 的旧清单逐条只有一个 `type`，面板归一化成 `types:[type]`，照常可用）。
  每条 `path` 形如 `packages/<id>/<id>-<版本>.tar.gz`（**源码与产物都按 id 平铺，不按类型分目录**）。面板拉它是为了**列出来供挑**；
  **拉不到就如实报错**（页面把原因写出来），不静默回退到内置列表。
- **列表**：`GET /api/plugins/library`（带 `?refresh=1` 绕过 60 秒缓存重拉清单）。
  每条会标出 `installed` / `installedVersion` / `installedOrigin` / `hasUpdate` / `sourceUrl`。
- **安装**：`POST /api/plugins/library/install`，body `{ type, id, version?, enable? }` ——
  按清单里的 `path` 取包，走**同一套两道校验**装进数据目录；`enable` 为真则装完就启用。
- **包怎么来的**：由本开发套件的 `framework/tools/pack.js` 产出 ——
  它把 `plugins/<id>/` 打成一个 `tar.gz`，**顺手把 `files`（逐文件 md5）注入包里的 `plugin.json`**
  （手写的清单里没人声明 `files`，第二道校验原先形同虚设）；插件库模式下再写出 `index.json`。
  ⇒ 官方插件仓库 [media-bridge-plugins](https://github.com/dlushu/media-bridge-plugins) 里只收**产物**
  （包与清单），插件源码不进版本库。

### 插件自更新（Magisk 式 `updateUrl`）

除了插件库，插件还能**自己声明去哪查新版** —— 和 Magisk 模块在模块里写更新地址同一个路子：

1. 插件在 `plugin.json` 写 `updateUrl`，指向一个自己的小清单（http(s)）。官方仓库插件默认指向
   `packages/<id>/update.json`，`pack.js --library` 打包时**自动生成**这个文件（与包同目录）。
2. 清单形状：

   ```json
   { "version": "1.0.2",
     "url": "fwrex-1.0.2.tar.gz",
     "md5": "（可选；包整体 md5，给了就当第一道校验）",
     "changelog": "（可选；一句话更新说明）" }
   ```

   `url` 可以写绝对 http(s) 地址，也可以写**同目录文件名**（打包工具默认这么写，
   面板按 `updateUrl` 所在目录解析），换成别的托管镜像也不用改包。
3. 管理页对声明了 `updateUrl` 的插件显示「更新」按钮：`GET /api/plugins/<类型>/<id>/update-check`
   查清单（60 秒缓存，`?refresh=1` 绕过），有新版时确认后 `POST /api/plugins/<类型>/<id>/update`
   一键下载换装。**插件库（`index.json`）不参与这条链路**，包没被任何仓库收录也能自更新。
4. **自动查 + 一键全更**：管理页打开时自动查一遍，之后每 5 分钟再查（页面关掉就停），
   查出新版的插件在行里标「可更新 vX」、按钮变成「更新到 vX」，卡头那颗「全部更新（N）」
   一次把有新版的都装上（**串行**，每次更新都要停旧起新；中途失败不打断后面的，最后一起报）。
   批量查走 `GET /api/plugins/updates`（一次查完所有声明了 `updateUrl` 的已装插件，单个失败
   不牵连其余，结果里带 `error`）。装完覆盖安装的那条 60 秒缓存会被作废，页面立刻显示新版本。
5. 安全口径：`updateUrl` 与清单里的 `url` 都只收 http(s)（相对文件名解析完也必须是 http(s)）；
   下载的包仍走**同一套两道 md5 校验**；更新包的 `(类型, id)` 必须与已装插件一致、
   清单声明的版本必须与包内 `plugin.json` 一致 —— 不允许借"更新"把包换成另一个身份。
6. **装完自动重启**：覆盖安装（手动上传 / 插件库更新 / 自更新，三条路同一套）会先等旧进程真的退出、
   换新包，再按原来的启用状态把新进程起回来；原来没启用的装完仍不启用。

---

## 三、执行模型

- 插件**跑在自己的常驻子进程**里，由面板启动与停止。
- **不沙箱**：插件能读写自己的目录、能联网、能起进程 —— 与"像 Linux 装包"同一个模型
  （权限前提与风险见 [ADR-0028](https://github.com/dlushu/media-bridge-panel/blob/main/docs/adr/0028-plugin-system.md)）。
- **"面板停、插件就停"由宿主保证**：子进程属于面板，面板退出时直接终止它们，不依赖插件配合。
- 插件**自己**再起的东西（例如源插件内部部署的实例）必须在收到停止指令时自行清理，
  否则会变成孤儿进程、继续占着端口。
- 面板要管 N 个进程（启停、健康、日志；**进程崩了只记账、不自动重启**）。这层复用现有源托管的做法
  （启动 / 嗅探端口 / 留尾部日志 / 停止）。

---

## 四、面板与插件之间的通道

- 走**管道**（Node 的 child IPC；非 Node 插件可用"stdin/stdout 每行一条 JSON"）。
  **不占端口**、**不用鉴权**（只有父子能碰）、更快。既有实现见首页插件的宿主
  （`job` / `rpc` / `rpcResult` / `done` 消息）。
- **动作名**：走管道之后没有"网址"，端点名就是**一个动作标识**。对比：

  ```
  现状：POST http://<源地址><站点 api>/search   { wd, page }
  之后：{ action: 'search', site: …, wd, page }
  ```

  动作名一律用**语义名**（`站点清单` / `搜索` / `取播放项` / `解析地址` / …），
  不写成 `/config`、`/search` 这类路径样式 —— 免得后来者以为还要发 HTTP。
- 插件**内部**要不要给自己的实例开端口，是插件自己的事；面板不参与分配、也不依赖它。
- 插件入口的形状：`module.exports = { actions: { 动作名: async (args, ctx) => 返回值 } }`。
  多类型包把动作**按角色分组**：`actions: { home: { rows, run, http }, metadata: { … } }`
  —— 同一个 `actions` 对象要么全扁平（单类型包）、要么全分组；宿主按消息里的 `role` 进对应分组，
  没带 role 再回退扁平表。多类型包的推荐写法是薄入口 + `roles/<类型>/` 各导出一份 `actions`：

  ```js
  module.exports = { actions: {
    home: require('./roles/home').actions,
    metadata: require('./roles/metadata').actions,
  } };
  ```

  `ctx` 给这些：`types`（自己的全部类型）/ `type`（代表类型，兼容旧代码）/ `id`（自己是谁）、
  `dataDir`（自己的数据目录）、`log(...)`（写进面板日志）、
  `hostCall(target, action, args)`（**反向调用宿主**，白名单制，见下）。
  进程环境变量同理：`MBP_PLUGIN_TYPES`（逗号分隔）为主，旧的单个 `MBP_PLUGIN_TYPE` 继续给。
  面板**只做**"把请求转成动作、把返回值转回去"，不做别的（加载与分发由宿主的 `runner.js` 负责）。
- 调试口径：面板把**每次请求与回复写进日志**（沿用现有源"留子进程尾部日志"的做法）。

### 插件反向调用宿主：`ctx.hostCall`

插件之间**仍然不能互相调用**；但 output 这类"出口"插件需要把面板已有的能力（首页榜单、聚合搜索 /
详情 / 播放）转给外部消费方，所以宿主在管道上开了一条**反向通道**，且只暴露**白名单**里的动作：

```
ctx.hostCall(target, action, args) -> Promise<{ ok: true, value } | { ok: false, error: { code, message } }>
```

- 消息形状：插件 → 宿主 `{ type:'hostCall', id, target, action, args }`；
  宿主 → 插件 `{ type:'hostCallReply', id, ok, value? , error? }`（`id` 由插件侧递增、自行配对）。
  30 秒超时，宿主与插件两侧各自计时；宿主不在线 / 管道已断时调用 reject。
- 当前白名单（以宿主代码 `server/modules/plugin/host-api.js` 为准）：

  | target | action | 入参 | value |
  |---|---|---|---|
  | `home` | `plugins` | — | 已装的 `home` 插件清单 `[{id,type,name,enabled,running}]` |
  | `home` | `rows` | `{pluginId}` | 该首页插件申报的行 |
  | `home` | `run` | `{pluginId,rowId,startIndex,limit}` | `{items,total,dropped,dup,cached}`（items 已按 HomeItem 归一化） |
  | `agg` | `sites` | — | 聚合站点清单 |
  | `agg` | `search` | `{domain,keyword,page?}` | 聚合搜索结果 |
  | `agg` | `detail` | `{domain, ...}`（source/site/vodId 快路径，或 name/year；剧集带 `season`/`episode`） | 聚合详情 |
  | `agg` | `play` | `{domain,ref,clientHost?}` | `{urls,header,parse,nonHttp}` |

- 白名单之外的 `target/action` 一律回 `NO_HOSTCALL`；**不转发任意内部调用、不暴露文件系统**。
- output 插件的 `http` 动作应当把 hostCall 的失败码如实映射成 HTTP 状态
  （`BAD_INPUT`/`NO_DOMAIN`/`NO_SITE`/`NO_SOURCE` → 400，`TIMEOUT` → 504，其余 → 502）。


---

## 五、按类型的动作契约

通用部分（包、通道、动作模型、生命周期、缓存、webui、失败口径）以本文为据；
**每种类型的动作清单与类型专属口径**各自一份：

| 类型 | 契约文档 |
|---|---|
| `source`（源） | [contract-source.md](contract-source.md) |
| `metadata`（元数据） | [contract-metadata.md](contract-metadata.md) |
| `home`（首页） | [contract-home.md](contract-home.md) |
| `subtitle`（字幕） | [contract-subtitle.md](contract-subtitle.md) |
| `output`（输出） | [contract-output.md](contract-output.md) |
| webui 前端（跨类型） | [plugin-webui.md](plugin-webui.md) |

---

## 六、播放地址的转交

播放时客户端打的是**面板自己的端点**（本项目的形状是 Emby 那套 `…/videos/{ItemId}/stream`，
版本 Id 里带着 `ref`）。面板把 `ref` 通过管道转给插件，插件回一个**真实可直连地址**，
面板 **302** 过去（面板不扛流量，见 [ADR-0006](https://github.com/dlushu/media-bridge-panel/blob/main/docs/adr/0006-redirect-for-playback.md)）。

- **host 必须是面板**：客户端要能访问那个地址，而面板的端口是已发布、确定可达的；
  插件自己的端口没有发布。客户端因此感知不到插件，也不需要知道插件在哪。
- **只做 302**：插件给不出"客户端可直连的地址"（例如必须带 header / cookie）时，
  面板**如实回"该源需要代理，暂不支持"**，不静默失败。
- **`ref` 由插件输出、插件自己管**：只要内容还在，插件随时能把它换成一个地址
  （可重复解析是**插件的义务**）；地址缓存与有效期也由插件自己处理。
- **面板把「客户端访问用的主机名」一起给插件**（`clientHost`）：本地部署的实例回的是
  `127.0.0.1:<端口>`，那个地址对客户端毫无意义 —— 插件拿它拼成
  `http://<客户端访问用的域名>:<实例端口>/…`（端口原样保留，部署时已发布到宿主）。
  这一步原来是面板在做（它当时还知道实例端口），`ref` 转交之后面板不知道了，所以跟着搬进插件。
- **播放项必须带一个显示名**（聚合站给线路名，直查那类自己决定：片名 / 集号 / 站点名都行）。
  **面板只负责把它传到客户端 —— 不起名、不编**；插件想不出名字就如实留空。

---

## 七、模板与域


- 元数据插件注册一个**域 id**（就是条目 Id 的前缀，形状 `[a-z][a-z0-9]*`）。面板按域名把
  "条目 → 模板 → 站点"连起来。**面板层是元数据插件与源插件之间唯一的连接点**，
  两类插件互不感知。
- **分派**：条目前缀决定用哪个元数据插件。**认不出的前缀 ⇒ 如实空并点名缺哪个插件**
  （不回退到别的域、不猜、不静默）。

- **模板就是一份配置数据文件**，内容 = **选中的站点 + 打分过滤参数 + 超时与并发**
  （超时与并发也按模板走：不同域的内容、不同的站点，合适的超时本来就不一样）；
  **它自己的 id 就是这套模板的身份**（随机生成、之后固定）。
- **每个域最多一个模板**（一对一）；**一个模板可以被多个域共用**；
- **某个域没有配模板 ⇒ 如实为空并点名**（那个域的内容搜不到；不挑兜底、不猜）；
  **同一个站点可以出现在多个模板里**（站点表要能看出"它被哪几套模板用了"）。
- 站点身份按 **"插件 + 站点 key"** 记，不用端口或实例名之类会变的东西 ——
  插件重装、换端口之后模板照样对得上。

---

## 八、缓存分工

**两级，各管一段。**

| 位置 | 缓存什么 | 有效期 | 谁决定 |
|---|---|---|---|
| **插件侧** | 它自己的取数结果 | 插件自己定 | 插件（面板不干预） |
| **面板侧** | **这一条目的线路结果**（面板聚合出来的那份） | **按天，默认 1 天**（可改） | 面板设置 |

- 面板侧那份的 `key` 里带上**所有影响结果的参数**（打分参数、线路过滤、模板、站点集合……）⇒
  **改了参数 key 就变、旧结果立即失效**，不需要人工清缓存。
- **判据是"只要有线路就存"**，不要求"所有站点都通"（见 [ADR-0032](https://github.com/dlushu/media-bridge-panel/blob/main/docs/adr/0032-cache-two-levels.md)）。
  代价如实记着：一次"缺了几条线路"的结果会在缓存里留最长一个有效期。
- **插件应当自己缓存，把常见查询做到秒回** —— 这是义务。面板侧那份只挡住
  "客户端点一次播放连问三遍"（几秒内），**超出的热度全压在插件身上**。
- **播放地址（`play` 的解析结果）同样要缓存** —— 面板不缓存地址（地址会过期，面板那份只到
  "集 id"为止，见第六节），而客户端**一次播放会打好几发**（起播探测、断开重连、拖动进度各发一次
  HTTP），每发都落到 `play`。转存 / 换链这类解析既慢又可能有副作用，不缓存就等于每发都重新解析一遍；
  失败的那一发不该缓存（否则把一次超时钉在有效期里）。有效期由插件自己定。
- 解析同一集还会被**并发打到**（客户端同时开好几个连接）：缓存这一层要顺带把并发重复挡住 ——
  同一发在跑时其余请求等它的结果，不要各解析一遍。
- 面板要**按插件记录每次聚合的耗时**（日志 + 统计），否则"慢插件"查不出来。
- 站点级超时与失败跳过按 **"插件 / 注册的站点"** 记账（沿用现有那套逻辑）。
- **测速的归属要分清**：**测速的结果值（站点统计）是面板级共享的一份**，不跟模板走；
  **测速的开关与间隔在面板设置里**。

---

## 九、webui、设置与门禁

- 插件的 webui 是**静态文件**，放在插件包里、由面板托管；**插件不提供端口**。
- **导航**：插件注册了 webui 就在导航显示一个入口，"里面是什么"是插件自己的事；
  面板只判断"有没有注册 webui"。入口放在它**所属类型那一栏**下面
  （元数据插件挂「元数据」栏、源插件挂「源」栏、首页插件挂「首页」栏、
  输出插件挂「输出」栏、字幕插件挂「字幕」栏）。多类型包按 `webui` 映射**逐类型**挂，
  哪个类型给了入口就挂哪一栏；一栏下没有入口的子项时该栏不显示。
  入口是**扫插件目录里的声明文件**发现的（给显示名、排序、指向哪个页面），没有中心注册表 ——
  参照 LuCI 的做法（见第十一节）。
- **设置**：**声明归插件、存储也归插件**（都在插件自己的 `data/` 里）。
- **两条路径**（默认都在 `/api/` 下 ⇒ **受面板登录门禁**；插件可在 `plugin.json` 用
  `ingress` 逐路径放开，见下）：

  | 路径 | 作用 |
  |---|---|
  | `GET /api/plugins/<类型>/<id>/ui/**` | 插件的 webui 静态文件（`/ui/` 之后相对 **webui 入口所在目录**解析，所以页面里 `./x.js` 就是 `ui/x.js`） |
  | `ANY /api/plugins/<类型>/<id>/api/**` | **转发给插件**：面板把这一次请求转成**动作 `http`**（见下） |

- **ingress 声明**（`plugin.json` 可加；不写 = 两条路径都要面板登录 cookie）：

  ```json
  { "ingress": { "public": ["api/widget.js"], "token": ["api/**"] } }
  ```

  - 名单条目是相对路径，形如 `ui/xxx` / `api/xxx`，支持 `*`（单层内任意）与 `/**`（任意层级）；
    写不合法（越界 `..`、绝对路径、别的段名）会在安装时按坏清单拒绝。
  - `public`：**完全匿名**，谁都能访问（只该放不含秘密的静态产物，例如一个脚本）。
  - `token`：要**外部访问令牌**（或有效登录 cookie）。令牌由面板生成
    （`mbp_` + 48 位十六进制；面板设置页可取 / 重置，重置后旧票立即失效），
    三种携带方式等价：query `?token=`、`Authorization: Bearer`、`X-Access-Token` 头。
    对不上或没带 ⇒ 401。`public` 命中优先于 `token`。
  - 两条名单都没命中的路径，照旧走面板登录门禁。
  - **安全口径**：令牌只能证明"有权访问这个插件的 ingress"，不等于面板登录态 ——
    插件经 hostCall 能做的事以宿主白名单为限；秘密（令牌、Cookie）绝不允许编进 `public` 产物。

- **转发用的动作名固定是 `http`**，入参 / 出参：

  ```
  入参  { method, path, query, body, contentType, host, proto }
        · path   = `/api/` 之后的那一段（例如 `/save`）
        · query  = 普通对象（URL query；面板已剥掉用于鉴权的 token 键，不会下发给插件）
        · body   = **UTF-8 字符串**（不是 Buffer；插件侧 JSON.parse(body) 就能用）
        · host/proto = 这次外部请求的 Host 头与协议（output 插件拼自描述地址时用）
  出参  { status?, body, contentType? }
        · status 缺省 200；body 是对象就按 JSON 回，是字符串就按 contentType 回
  ```

- ⚠️ **页面里不能用 `fetch('./api/xxx')`**：那条相对路径是相对**页面自己的目录**（`…/ui/`）解析的，
  会变成 `…/ui/api/xxx` 而落到静态文件那一条路上（404）。要按页面地址**算出通道前缀**：
  页面在 `/api/plugins/<类型>/<id>/ui/<入口>`，把 `/ui/…` 之后切掉再拼 `/api` 就是它 ——
  这样换 id、换类型都不用改（写法见任一源插件的 webui 顶部那段 `API` 常量）。
- ⇒ 页面里写 `fetch(API + '/xxx')` 就行。**面板不解析内容** ——
  插件想怎么设计自己的接口都行，插件的设置声明与存储也都在它自己那边（见下）。
- **调试台**：管理页可以手发一条动作（`POST /api/plugins/<类型>/<id>/call`），
  面板同样**不解释**动作与参数 —— 原样转过去、原样显示回来。
- **门禁**：webui 的静态资源与上面那条转发通道**默认都必须受面板登录门禁**；
  只有 `ingress` 名单逐路径声明了的，才能匿名（`public`）或凭外部访问令牌（`token`）放开
  （当前静态文件是免登录的，不能让插件的设置页变成公开页面）。
- ⚠️ **两个层级要分开**：**插件设置页**属于插件（管理它自己的实例）；
  **实例配置中心**属于实例。导航**不再给每个运行中的实例单独开子页**，收进插件的设置页内部。

---

## 十、失败与诊断

- **失败如实**：插件报失败，面板如实记日志、如实空；不编造、不静默回退。

### 各通道怎么表达失败（口径不同，别弄混）

面板把到来请求转成动作调用，再按**通道**把返回值转回去。公共底座是宿主的 `runner.js`：
动作**正常 return** → 回 `{ ok: true, value }`；动作**抛异常** → 回 `{ ok: false, error }`
（异常上的 `code` 原样透传；异常若带 `cause`，面板也一并带回 `error.cause = { code?, message? }` ——
Node `fetch()` 失败时 `e.message` 恒为一句 `fetch failed`，真因（如 `ENOTFOUND`）在 `e.cause`，别丢）。
各通道在这之上再决定要不要认"业务信封"：

| 通道 | 面板怎么判失败 | 插件该怎么报失败 |
|---|---|---|
| metadata（`lookup` / `season` …） | `runner` 的 `r.ok`（抛异常会变 false）**加**返回体的 `v.ok === false` | throw，**或**回 `{ ok:false, error:{code,message} }` |
| source（`search` / `detail` / `play` …） | `runner` 的 `r.ok`（抛异常）**加**返回体上的 `res.error` | throw，**或**回一个带 `error` 的对象 |
| home（`rows` / `run`） | **只认 `runner` 的 `r.ok`，不看返回体的 `ok`**（直接读 `value.rows` / `value.items`） | **必须 throw** —— 回 `{ok:false,error}` 会被当成"成功但这一行是空的" |
| subtitle（`tracks` / `fetch`） | **只认 `runner` 的 `r.ok`，不看返回体的 `ok`**（直接把 `value` 当轨数组 / `{body,contentType}` 用） | **必须 throw** —— 回 `{ok:false,error}` 会被当成"成功但没给内容" |
| output（`http`） | 看返回体的 `{ status, body }`（`status` 缺省 200） | 用 `status` 表达失败码（映射见第四节宿主调用失败码表），不靠抛 |

一句话记法：**"信封式"通道（metadata / source）throw 与返回信封等效；"裸值式"通道
（home / subtitle）只能 throw —— 它们把返回值本身当数据，多套一层信封就等于把失败说成空。**
`throw` 时在 `error` 上挂 `code` 便于面板归类日志与状态码。

- **可选诊断字段**：插件返回里可以带诊断信息（如"这次含预热""内部等了多久"），
  面板**照实写进日志，但不参与打分**。`init` 这类内部逻辑搬进插件之后，
  那些"看不见的等待"需要留一条线索。
- **测速与超时**：站点级超时；连续失败的站点跳过一段时间、到期自动再试
  （沿用现有那套口径），勾选不受影响。

---

## 十一、参考：LuCI 插件怎么注册它的 web UI

OpenWrt 的 LuCI 插件（`luci-app-*`）是同类做法，可借鉴（来源：LuCI 仓库 `applications/luci-app-example`）。

| 路径 | 作用 |
|---|---|
| `/usr/share/luci/menu.d/luci-app-xxx.json` | **菜单声明** |
| `/usr/share/rpcd/acl.d/luci-app-xxx.json` | **权限声明**（能调哪些接口；不对就 "Access denied"） |
| `/www/luci-static/resources/view/xxx/*.js` | **前端页面** |
| `/usr/share/rpcd/ucode/xxx.uc` | 后端 RPC |
| `/etc/uci-defaults/80_xxx` | 首次安装时创建默认配置 |

菜单声明形如：

```json
"admin/example/form": {
  "title": "Form View",
  "order": 1,
  "action": { "type": "view", "path": "example/form" }
}
```

- **设置存哪**：`/etc/config/xxx` —— **插件自己的配置文件**，schema 由插件自己定，
  LuCI 不认识这些字段。
- **卸载**：菜单是**扫 `menu.d` 目录发现**的，没有中心注册表 ⇒ 删包时文件一起没 ⇒ 菜单项自动消失。

**借鉴三点**：入口是"文件声明 + 宿主扫描"；设置由插件自己存自己管；
权限要显式声明（对应本项目的"这些页面要登录才能看"）。

---

## 十二、与现有实现的对应

| 现在 | 之后 |
|---|---|
| 源的包在 `sources/`、清单在 `sources.json` | `plugins/<id>/`，一个 id 一个目录（多类型统一） |
| 源跑在子进程、监听端口，面板用 HTTP 打它 | 插件跑在子进程，面板走**管道**、用**动作名**调用 |
| 猫源协议写死在面板（`core/catpaw.js` + agg 里几处 URL 拼接） | 收进**源插件**；面板只做"编辑参数 + 打分过滤" |
| 某个上游的元数据写死在面板（面板里带它的域常量与图片基地址） | 收进**元数据插件**；面板按域分派 |
| `agg.json` 里一套全局站点勾选与打分参数 | **模板**（站点 + 参数）按**域**选用 |
| 详情快照（小时级，判据"全站都通"） | **线路结果缓存**（按天默认 1 天，判据"有线路就存"） |
| 每个运行中的源各有一个「配置中心」子页 | 收进**插件设置页**内部 |
| 客户端拿到的播放地址由面板解析坐标后 302 | 面板把 `ref` 转给插件、插件回地址，面板仍只 302 |
| 源包在 `sources/`，逐个文件下载 + 一道 md5 | 插件包在 `plugins/<id>/`，`tar.gz` + 两道 md5，装/卸/启停都走管理页 |
