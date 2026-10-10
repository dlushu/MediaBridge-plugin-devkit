#!/usr/bin/env node
'use strict';
/**
 * INDEX 指针校验：确保 `framework/INDEX.md` 里的每个 `file#Lx-Ly@锚点` 引用仍然命中。
 *
 * 用法（在项目根目录）：
 *   node framework/tools/index-check.js
 *
 * 校验三件事：
 *   1. 引用指向的文件存在；
 *   2. 行区间合法（1 ≤ 起 ≤ 止 ≤ 文件总行数）；
 *   3. 该区间内仍含锚点文本（契约改版后区间漂移会在此暴露）。
 * 另做覆盖率检查：framework/contracts/ 下每份契约都必须被 INDEX 引用到。
 * 全绿 exit 0；任何一项不过 exit 1。
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEX_FILE = path.join(ROOT, 'framework', 'INDEX.md');
const CONTRACTS_DIR = path.join(ROOT, 'framework', 'contracts');

// 形如：`framework/contracts/xxx.md#L12-L34@锚点文本`
const REF_RE = /`(framework\/[^`#\n]+)#L(\d+)-L(\d+)@([^`\n]*)`/g;

function readLines(abs) {
  return fs.readFileSync(abs, 'utf8').split(/\r?\n/);
}

function main() {
  if (!fs.existsSync(INDEX_FILE)) {
    console.error(`找不到索引文件：${path.relative(ROOT, INDEX_FILE)}`);
    process.exit(1);
  }
  const text = fs.readFileSync(INDEX_FILE, 'utf8');

  const refs = [];
  let m;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text)) !== null) {
    refs.push({ rel: m[1], start: Number(m[2]), end: Number(m[3]), anchor: m[4].trim(), at: m.index });
  }

  if (!refs.length) {
    console.error('INDEX 里没有找到任何 `file#Lx-Ly@锚点` 引用（格式约定见文件头部说明）。');
    process.exit(1);
  }

  const lineOf = (idx) => text.slice(0, idx).split('\n').length;
  let bad = 0;
  const seen = new Set();

  for (const r of refs) {
    seen.add(r.rel);
    const where = `INDEX.md:${lineOf(r.at)} → ${r.rel}#L${r.start}-L${r.end}`;
    const abs = path.join(ROOT, r.rel);

    if (!fs.existsSync(abs)) {
      console.error(`  ✘ ${where}：文件不存在`);
      bad++;
      continue;
    }
    const lines = readLines(abs);
    if (!(r.start >= 1 && r.start <= r.end && r.end <= lines.length)) {
      console.error(`  ✘ ${where}：行区间越界（该文件共 ${lines.length} 行）`);
      bad++;
      continue;
    }
    const slice = lines.slice(r.start - 1, r.end).join('\n');
    if (r.anchor && !slice.includes(r.anchor)) {
      console.error(`  ✘ ${where}：区间内未命中锚点「${r.anchor}」`);
      bad++;
      continue;
    }
    console.log(`  ✔ ${r.rel}#L${r.start}-L${r.end} @ ${r.anchor}`);
  }

  // 覆盖率：每份契约都要被引用到
  if (fs.existsSync(CONTRACTS_DIR)) {
    for (const f of fs.readdirSync(CONTRACTS_DIR).filter((n) => n.endsWith('.md')).sort()) {
      const rel = `framework/contracts/${f}`;
      if (!seen.has(rel)) {
        console.error(`  ✘ 覆盖率：${rel} 未被 INDEX 引用`);
        bad++;
      }
    }
  }

  if (bad) {
    console.error(`\nINDEX 校验失败：${bad} 项。请同步 framework/INDEX.md 后再提交。`);
    process.exit(1);
  }
  console.log(`\n共 ${refs.length} 个引用，全部命中；契约文件覆盖率 100%。`);
}

main();
