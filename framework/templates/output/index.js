'use strict';
/**
 * __PLUGIN_NAME__ —— 输出插件骨架。
 *
 * 契约见 framework/contracts/contract-output.md：
 * 不占端口、不接 Emby —— 它是"外部能匿名/持票访问的 HTTP 面 + 一组 hostCall 编排"。
 * 典型产物：给外部播放器下发的脚本/配置，经 hostCall 取首页/搜索/详情/播放。
 *
 * hostCall 白名单（见 contract-output.md）：home.plugins / home.rows / home.run /
 * agg.sites / agg.search / agg.detail / agg.play。白名单之外一律 NO_HOSTCALL。
 * hostCall 失败码如实映射成 HTTP 状态：BAD_INPUT/NO_DOMAIN/NO_SITE/NO_SOURCE → 400，
 * TIMEOUT → 504，其余 → 502。
 *
 * ⚠️ 令牌绝不编进产物或下载 URL：匿名产物里只放"怎么填令牌"的说明。
 */

const actions = {
  /**
   * 对外 HTTP 面：外部请求经面板转发进来（总契约第九节）。
   * 入参 { method, path, query, body, contentType, host, proto }；
   * host/proto 用来拼自描述地址（这次外部请求实际打到的地址）。
   */
  async http(args, ctx) {
    if (args.path === '/ping') {
      /* 示例：经 hostCall 问宿主能力 */
      const r = await ctx.hostCall('agg', 'sites', {});
      if (!r.ok) return { status: 502, body: { ok: false, error: r.error } };
      return { body: { ok: true, sites: r.value } };
    }
    return { status: 404, body: { ok: false, error: 'no route' } };
  },
};

module.exports = { actions };
