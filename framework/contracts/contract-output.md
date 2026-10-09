# 输出插件契约

通用模型（包、通道、动作、执行、缓存、webui）见 [plugin-contract.md](plugin-contract.md)；
本文只管 `output` 类型插件**额外**要遵守的：反向 hostCall、HTTP 编排、令牌安全。

---

## 一、概述


- output 插件**不占端口、不接 Emby**，它就是一个"外部能匿名/持票访问的 HTTP 面 + 一组 hostCall 编排"：
  典型例子是给外部播放器（如 FW/Rex 播放器的 Widget）下发一个脚本，脚本再持**外部访问令牌**
  回头访问本插件的 `api/**`，插件经 hostCall 取首页 / 搜索 / 详情 / 播放。
- 插件自己负责：生成对外产物（脚本 / 配置）、把外部播放器的参数翻译成 hostCall 入参、
  以及把播放结果整理成对方播放器认的形状（直连地址 + `customHeaders`，由对方原生播放器直连 CDN）。
- **令牌绝不编进产物或下载 URL**：匿名产物里只能出现"怎么填令牌"的说明，不能出现明文令牌。
- **失败口径**（见总契约第十节）：`http` 动作**用返回体的 `status` 表达失败**（缺省 200），不靠抛；
  经 `ctx.hostCall` 调宿主失败时，把失败码映射成 HTTP 状态（`BAD_INPUT` / `NO_DOMAIN` / `NO_SITE` /
  `NO_SOURCE` → 400，`TIMEOUT` → 504，其余 → 502，见总契约第四节）。
