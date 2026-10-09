'use strict';
/**
 * __PLUGIN_NAME__ —— 字幕插件骨架。
 *
 * 契约见 framework/contracts/contract-subtitle.md：
 * 能力就两件事 —— 申报有哪些轨（tracks）、给出某条轨的内容（fetch）。
 * 一条字幕一种语言算一条，多语言是契约能力；报空数组 = 这个目标没有字幕。
 *
 * ref 是这条轨自己的凭据（<插件id>/<自己定的东西>），必须可重复解析；
 * 内容缓存归插件自己（tracks / fetch 会被反复调到）。
 *
 * ctx 给这些：types / type / id / dataDir / log(...) / hostCall(...)（总契约第四节）。
 */

const actions = {
  /**
   * 申报字幕轨：入参是这一集的坐标 { name, originalName, year, season, episode }
   * （电影没有季集号时 season/episode 为 null）→ [{ lang, format, label?, ref }]
   */
  async tracks(args, ctx) {
    return []; // 没有可报的就回空数组，面板如实不填轨
  },

  /**
   * 取字幕内容：{ ref } → { body, contentType? }；body 是 UTF-8 字符串（srt/ass/vtt）。
   *
   * 失败**抛异常**（带 `e.code`）。字幕桥把动作的返回值**直接**当 `{ body, contentType? }` 用，
   * **不认** `{ ok: false, error }` 这种业务信封（那是元数据类型的约定）—— 回那种对象会被
   * 当成"成功但没给 body"，客户端只看到 502，真实失败原因丢失。
   * 想"给一段说明性内容"就正常 return；想"如实报失败"就 throw。
   */
  async fetch(args, ctx) {
    const e = new Error('fetch 未实现：按 ref 取字幕内容，回 { body, contentType? }');
    e.code = 'TODO';
    throw e;
  },

  /**
   * webui 转发通道（总契约第九节）：设置页的读写走这里。
   * 语言 / 基地址等等是插件自己的配置，声明与存储都归插件（见 contract-subtitle.md 第七节）。
   */
  async http(args, ctx) {
    return { status: 404, body: { ok: false, error: 'no route' } };
  },
};

module.exports = { actions };
