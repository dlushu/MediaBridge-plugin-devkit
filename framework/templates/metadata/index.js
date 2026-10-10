'use strict';
/**
 * __PLUGIN_NAME__ —— 元数据插件骨架。
 *
 * 契约见 framework/contracts/contract-metadata.md：
 * 要提供哪些字段（按用途分组那张表）、能力申报、条目外链申报都在那里。
 * 拿不到就如实留空 / 如实失败，不编数据（铁律第一条）。
 *
 * ctx 给这些：types / type / id / dataDir / log(...) / hostCall(...)（总契约第四节）。
 */
const fs = require('fs');
const path = require('path');

/* 设置：声明归插件、存储也归插件（自己的 data/ 目录，总契约第九节） */
function readSettings(ctx) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ctx.dataDir, 'settings.json'), 'utf8'));
  } catch {
    return {};
  }
}
function writeSettings(ctx, obj) {
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  fs.writeFileSync(path.join(ctx.dataDir, 'settings.json'), JSON.stringify(obj, null, 2));
}

const DOMAIN = '__PLUGIN_DOMAIN__'; // 域 id = 条目 Id 前缀（形状 [a-z][a-z0-9]*）；改了就是另一个域

const actions = {
  /** 注册：域 id + 能力清单 + 剧集式/电影式 + 图片基地址 + 条目外链模板（见 contract-metadata.md） */
  async register(args, ctx) {
    return {
      domain: DOMAIN,
      series: true, // 电影式回 false
      name: '__PLUGIN_NAME__',
      version: '0.1.0',
      language: 'zh-CN',
      imageBase: '', // 客户端取图由面板代取，拼串要用这个基地址
      capabilities: {
        /* 会哪些、缺哪些如实申报 —— 面板据此区分"给不了"与"这次取失败" */
      },
      links: [
        /* { name: '站点', url: 'https://<站点>/item/{id}' } —— {type}/{id} 由面板填 */
      ],
    };
  },

  /**
   * 取元数据：一次一个条目坐标；字段清单见 contract-metadata.md（身份/名字/简介/图片/分类/详情页那批）。
   * ⚠️ 「年份 / 首播」必须回：`year`（4 位字符串）+ `premiereDate`（ISO 串 `YYYY-MM-DDT00:00:00.0000000Z`）。
   * 上游只要给发行 / 首播时间（含 unix 秒时间戳）就同时映这两个键——缺了客户端显示成 0（见 DEV-NOTES §8）。
   */
  async lookup(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'lookup 未实现' } };
  },

  /** 取一季分集：集号/集名/简介/首播/剧照/评分/时长；拿不到如实留空。分集的「首播」同样给 `year` + `premiereDate`。 */
  async season(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'season 未实现' } };
  },

  /** 搜索：按词给候选；面板搜索层按窗口取上游页，插件只要认 page */
  async search(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'search 未实现' } };
  },

  /** webui 转发通道（总契约第九节）：设置页的读写走这里 */
  async http(args, ctx) {
    if (args.path === '/save' && args.method === 'POST') {
      writeSettings(ctx, JSON.parse(args.body || '{}'));
      return { body: { ok: true } };
    }
    if (args.path === '/settings') return { body: readSettings(ctx) };
    return { status: 404, body: { ok: false, error: 'no route' } };
  },
};

module.exports = { actions };
