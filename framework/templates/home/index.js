'use strict';
/**
 * __PLUGIN_NAME__ —— 首页插件骨架。
 *
 * 行与条目规范见 framework/contracts/emby-home-plugin.md（必读，HomeItem 字段表在第四节）；
 * 通用模型见 framework/contracts/plugin-contract.md 第八节。
 *
 * 最容易踩的坑：**一页必须按客户端窗口填满** —— items 少于 limit 客户端就判最后一页、
 * 不再翻页。按 startIndex+limit 连续取上游页，再切出自己这一页（契约第八节）。
 *
 * ctx 给这些：types / type / id / dataDir / log(...) / hostCall(...)（契约第四节）。
 */

const actions = {
  /**
   * 申报行清单：{ rows: [{ id, title, collectionType?, feed?, total?, cacheDuration?, params? }] }
   * total/episodes 拿得准才写（别写 0）；规则见规范第二节。
   */
  async rows(args, ctx) {
    return {
      ok: true,
      rows: [
        {
          id: 'main',
          title: '__PLUGIN_NAME__',
          collectionType: 'mixed', // 有 type 参数的行不要写死，见规范
          cacheDuration: 3600, // 行结果缓存归插件自己执行（秒；0=不缓存）
        },
      ],
    };
  },

  /**
   * 跑一行：{ rowId, params?, startIndex?, limit? } → { items, total, cached? }
   * items 是 HomeItem 数组（字段表见规范第四节，规范外字段面板一律丢弃）。
   */
  async run(args, ctx) {
    return { ok: false, error: { code: 'TODO', message: 'run 未实现' } };
  },

  /** webui 转发通道（契约第十二节） */
  async http(args, ctx) {
    return { status: 404, body: { ok: false, error: 'no route' } };
  },
};

module.exports = { actions };
