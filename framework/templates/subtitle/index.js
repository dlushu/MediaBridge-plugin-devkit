'use strict';
/**
 * __PLUGIN_NAME__ —— 字幕插件骨架。
 *
 * 契约见 framework/contracts/plugin-contract.md 第七节：
 * 能力就两件事 —— 申报有哪些轨（tracks）、给出某条轨的内容（fetch）。
 * 一条字幕一种语言算一条，多语言是契约能力；报空数组 = 这个目标没有字幕。
 *
 * ref 是这条轨自己的凭据（<插件id>/<自己定的东西>），必须可重复解析；
 * 内容缓存归插件自己（tracks / fetch 会被反复调到）。
 *
 * ctx 给这些：types / type / id / dataDir / log(...) / hostCall(...)（契约第四节）。
 */

const actions = {
  /**
   * 申报字幕轨：入参是这一集的坐标 { name, originalName, year, season, episode }
   * （电影没有季集号时 season/episode 为 null）→ [{ lang, format, label?, ref }]
   */
  async tracks(args, ctx) {
    return []; // 没有可报的就回空数组，面板如实不填轨
  },

  /** 取字幕内容：{ ref } → { body, contentType? }；body 是 UTF-8 字符串（srt/ass/vtt） */
  async fetch(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'fetch 未实现' } };
  },
};

module.exports = { actions };
