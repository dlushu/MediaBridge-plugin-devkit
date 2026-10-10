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

/**
 * 行声明（含参数声明）——**只发不带 params 的形状给面板**（见 publicRow）。
 * 每行 = 客户端一个媒体库；params 声明这一行哪些参数可调，设置页据此渲染「行参数」卡。
 */
const ROWS = [
  {
    id: 'main',
    title: '__PLUGIN_NAME__',
    collectionType: 'mixed', // 有 type 参数的行不要写死，见规范
    cacheDuration: 3600, // 行结果缓存归插件自己执行（秒；0=不缓存）
    params: [
      { name: 'count', title: '每行条数', type: 'count', value: 20 },
      {
        name: 'type',
        title: '媒体库类型',
        type: 'enumeration',
        value: 'movie',
        enumOptions: [
          { value: 'movie', title: '电影' },
          { value: 'tv', title: '剧集' },
        ],
      },
    ],
  },
];

/** 发给面板的行形状：面板只要这几个键，params / functionName 是本插件内部的事，不带 */
function publicRow(row) {
  const out = { id: row.id, title: row.title };
  if (row.collectionType) out.collectionType = row.collectionType;
  if (row.feed) out.feed = row.feed;
  if (row.cacheDuration != null) out.cacheDuration = row.cacheDuration;
  return out;
}

/** 只留声明过的行 / 参数（防止网页 POST 任意键进设置文件） */
function sanitizeRowParams(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const row of ROWS) {
    const src = input[row.id];
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    const vals = {};
    for (const p of row.params || []) {
      if (!Object.prototype.hasOwnProperty.call(src, p.name)) continue;
      vals[p.name] = p.type === 'count' ? Number(src[p.name]) || 0 : String(src[p.name] ?? '');
    }
    if (Object.keys(vals).length) out[row.id] = vals;
  }
  return out;
}

const actions = {
  /**
   * 申报行清单：{ rows: [{ id, title, collectionType?, feed?, total?, cacheDuration? }] }
   * total/episodes 拿得准才写（别写 0，0 会被当空库）；规则见规范第二节。
   * ⚠️ 申报 `total` 一般要**联网取一次上游库规模**（属扇出，动手前先跟用户确认），
   * 再配插件侧缓存压住次数；取不到就不写这个字段。
   * `total` 报什么**完全由你自己定**（面板不做计算、不相加）。仅一条面板事实供参考：
   * 汇总时**同一 `collectionType` 的多行取最大者**，故想让客户端把这些行显示成"合计 / 相加"，
   * 就让这几行**都报同一个合计值**；想各显示各的真数，就各报各的。
   */
  async rows(args, ctx) {
    return { ok: true, rows: ROWS.map(publicRow) };
  },

  /**
   * 跑一行：{ rowId, params?, startIndex?, limit? } → { items, total, cached? }
   * items 是 HomeItem 数组（字段表见规范第四节，规范外字段面板一律丢弃）。
   * ⚠️ HomeItem 的 `year` 是**数字**、能拿到就**必须回**：面板 `ProductionYear = Number(f.year) || 0`，
   * 不回就是客户端卡片上的年份 `0`（不是留空）。列表/详情页能拿到年份时务必带上。
   *
   * 失败**抛异常**（带 `e.code`）：首页宿主**不认** `{ok:false,error}` 这种业务信封，
   * 它直接读 `value.items` / `value.total` —— 回信封会被当成"成功但这一行是空的"（总契约第十节）。
   */
  async run(args, ctx) {
    const e = new Error('run 未实现：按 startIndex/limit 取上游页，回 { items, total }');
    e.code = 'TODO';
    throw e;
  },

  /** webui 转发通道（总契约第九节）：设置页的读写走这里 */
  async http(args, ctx) {
    const method = String(args.method || 'GET').toUpperCase();
    const p = String(args.path || '/').replace(/\/+$/, '') || '/';
    let body = {};
    if (args.body) {
      try {
        body = JSON.parse(args.body);
      } catch {
        return { status: 400, body: { ok: false, error: '请求体不是 JSON' } };
      }
    }

    /* 首屏：连接设置 + 行清单（含参数声明）+ 用户存过的行参数 */
    if (p === '/state' && method === 'GET') {
      const s = readSettings(ctx);
      return {
        body: {
          settings: { baseUrl: s.baseUrl || '' },
          rows: ROWS.map((r) => ({
            id: r.id,
            title: r.title,
            collectionType: r.collectionType || '',
            feed: r.feed || '',
            cacheDuration: r.cacheDuration || 0,
            params: r.params || [],
          })),
          rowParams: s.rowParams || {},
        },
      };
    }

    /* 保存：连接字段 + 行参数（行参数整份替换，且只留声明过的行 / 参数） */
    if (p === '/settings' && method === 'POST') {
      const next = Object.assign({}, readSettings(ctx));
      if (body.baseUrl !== undefined) next.baseUrl = String(body.baseUrl || '').trim();
      if (body.rowParams !== undefined) next.rowParams = sanitizeRowParams(body.rowParams);
      writeSettings(ctx, next);
      return { body: { ok: true } };
    }

    return { status: 404, body: { ok: false, error: 'no route' } };
  },
};

module.exports = { actions };
