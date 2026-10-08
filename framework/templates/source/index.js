'use strict';
/**
 * __PLUGIN_NAME__ —— 源插件骨架。
 *
 * 动作契约见 framework/contracts/plugin-contract.md 第五节；
 * 显示与定位的硬性口径（组/站点命名、候选清洗、季集定位、版本标签）见
 * framework/contracts/source-display-rules.md —— 每一条都踩过坑，先读再写。
 *
 * ctx 给这些：types / type / id / dataDir / log(...) / hostCall(...)（契约第四节）。
 */
const fs = require('fs');
const path = require('path');

/* 设置：声明归插件、存储也归插件（自己的 data/ 目录，契约第十二节） */
function dataFile(ctx, name) {
  return path.join(ctx.dataDir, name);
}
function readSettings(ctx) {
  try {
    return JSON.parse(fs.readFileSync(dataFile(ctx, 'settings.json'), 'utf8'));
  } catch {
    return {};
  }
}
function writeSettings(ctx, obj) {
  fs.mkdirSync(ctx.dataDir, { recursive: true });
  fs.writeFileSync(dataFile(ctx, 'settings.json'), JSON.stringify(obj, null, 2));
}

const actions = {
  /** 站点清单：组（sources[]）→ 站点（sites[]），两组数组一次回（契约第五节） */
  async sites(args, ctx) {
    const cfg = readSettings(ctx);
    return {
      sources: [{ id: 'default', name: '__PLUGIN_NAME__', url: cfg.baseUrl || '', mode: 'remote', enabled: true }],
      sites: [
        /* { key, name, api, searchable: true, source: 'default', directLines: false } */
      ],
    };
  },

  /** 候选（仅两层式站点）：返回 macCMS 形状 { list: [...] }；候选清洗见显示规范第二节 */
  async search(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'search 未实现' } };
  },

  /** 取播放项：线路 → 选集，每个播放项带 ref 与显示名；季集定位见显示规范第三节 */
  async detail(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'detail 未实现' } };
  },

  /**
   * 解析地址：ref → 真实可直连地址 { urls, header, parse }。
   * ref 必须可重复解析（契约第九节）；解析结果与并发重复由插件自己缓存挡住（契约第十一节）。
   */
  async play(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'play 未实现' } };
  },

  /** 站点测速：通不通 + 多快，一发探针 */
  async probe(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'probe 未实现' } };
  },

  /** webui 转发通道（契约第十二节）：path 是 /api/ 之后那段，body 是 UTF-8 字符串 */
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
