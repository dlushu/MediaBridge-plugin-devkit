# 插件 webui 前端契约

> 本文规定**插件自带页面（设置页等）在前端侧可以依赖什么**：面板提供的 SDK、
> 通道前缀、门禁。通用插件模型（包、动作、通道）见 [plugin-contract.md](plugin-contract.md)，
> 本文只讲**前端这一层**。SDK 的实现面板仓库 `public/sdk/`（改 SDK 是面板侧改动，插件只消费）。
>
> **入口怎么挂**：页面由 `plugin.json` 的 `webui` 字段声明 —— 给了入口，面板就在该插件
> **所属类型那一栏**下挂一个页面（设置 / 展示页）；不写就不挂。字段写法与导航规则见
> plugin-contract.md 第一节字段表与第九节。

---

## 一、SDK：唯一稳定入口

插件页面只引用这两个文件（同源绝对路径，面板托管）：

```html
<link rel="stylesheet" href="/sdk/plugin-ui.css" />
<script src="/sdk/plugin-ui.js" defer></script>
```

- **只认这两个入口**。SDK 内部用什么实现（daisyUI / 其它）、文件怎么合并拆分，由面板决定，
  插件不引用 `/vendor/` 等内部路径 —— 那些不是契约。
- **主题跟随**：`plugin-ui.js` 让插件页实时跟随面板主题（共享 localStorage 键 `mbp-theme`），
  插件页**不要自己存主题、不要另做开关**。
- **留白已统一**：`plugin-ui.css` 给 `body` 带了与面板页面一致的 padding（桌面 22/26/48，
  窄屏 16，手机 12）。插件页最外层直接写内容，**不要再套一层全页容器**。

## 二、样式可以用什么

- **CSS 变量**：面板 `style.css` 定义的主题变量（`--line`、`--fg-dim-2` 等）可直接用，
  随主题自动切换。
- **daisyUI 类**：SDK 已引入（`@layer` 内），按钮 / 输入框 / 卡片等类照常写。
- **响应式表格**：`≤480px` 时表格自动摊成卡片，列名靠单元格的 `data-label` 属性显示 ——
  插件页画表格时给每个 `<td>` 写上 `data-label="<列名>"`（操作列不写）。

## 三、通道前缀（最容易踩的坑）

页面里**不能**写 `fetch('./api/xxx')`：相对路径会相对页面自己的目录（`…/ui/`）解析，
落到静态文件路上（404）。正确写法是按页面地址算出通道前缀：

```js
// 页面在 /api/plugins/<类型>/<id>/ui/<入口>，把 /ui/… 之后切掉再拼 /api
const API = location.pathname.replace(/\/ui\/.*$/, '') + '/api';
// 之后：fetch(API + '/save', { method: 'POST', body: JSON.stringify(...) })
```

这样换插件 id、换类型都不用改。这条通道把请求转成插件的 **`http` 动作**
（入参 `{ method, path, query, body, contentType, host, proto }`，出参 `{ status?, body, contentType? }`），
面板纯转发、不解析 —— 详见 [plugin-contract.md](plugin-contract.md) 第十二节。

## 四、门禁

- `ui/**`（静态文件）与 `api/**`（转发通道）**默认都要面板登录**。
- 要放开的逐路径在 `plugin.json` 的 `ingress` 声明：`public`（匿名，只放不含秘密的产物）/
  `token`（外部访问令牌）。语义与写法见 [plugin-contract.md](plugin-contract.md) 第十二节。
- **秘密（令牌、Cookie、上游凭据）绝不允许编进 `public` 产物或页面源码**。

## 五、铁律

1. 插件页是**插件的设置/展示页**；**是否挂、挂在哪一栏由 `plugin.json` 的 `webui` 字段决定**
   （不写就不挂，规则见 plugin-contract.md 第九节），"里面是什么"归插件。
2. 页面需要的后端能力一律走第三节的 `api/**` 通道（`http` 动作），**面板不给插件另开端口**。
3. SDK 之外的面板内部资源（`/vendor/`、面板页面自身的 JS）**不是契约**，不要引用。
