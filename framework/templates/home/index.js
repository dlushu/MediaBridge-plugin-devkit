'use strict';
/**
 * __PLUGIN_NAME__ —— 首页插件骨架。
 *
 * 契约见 framework/contracts/contract-home.md（必读，HomeItem 字段表在第四节）；
 * 通用模型见同目录 plugin-contract.md。
 *
 * 最容易踩的坑：**一页必须按客户端窗口填满** —— items 少于 limit 客户端就判最后一页、
 * 不再翻页。按 startIndex+limit 连续取上游页，再切出自己这一页（见 contract-home.md）。
 *
 * ctx 给这些：types / type / id / dataDir / log(...) / hostCall(...)（总契约第四节）。
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
   *
   * 失败**抛异常**（带 `e.code`）：首页宿主**不认** `{ok:false,error}` 这种业务信封，
   * 它直接读 `value.items` / `value.total` —— 回信封会被当成"成功但这一行是空的"（总契约第十节）。
   */
  async run(args, ctx) {
    const e = new Error('run 未实现：按 startIndex/limit 取上游页，回 { items, total }');
    e.code = 'TODO';
    throw e;
  },

  /** webui 转发通道（总契约第九节） */
  async http(args, ctx) {
    return { status: 404, body: { ok: false, error: 'no route' } };
  },
};

module.exports = { actions };
