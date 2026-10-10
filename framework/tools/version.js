#!/usr/bin/env node
'use strict';
/**
 * 框架版本号管理（见 AGENTS.md 铁律 13）。
 *
 * 用法：
 *   node framework/tools/version.js [patch|minor|major] [--no-changelog] [--dry-run]
 *
 * 行为：
 *   - 版本号以 framework/framework.json 为权威件，同时同步根目录 VERSION（两处必须一致）
 *   - 缺省升 patch：0.1.0 → 0.1.1；minor/major 手动指定
 *   - CHANGELOG.md 的「## 未发布」段若有实质内容，自动改名为
 *     「## vX.Y.Z — YYYY-MM-DD」并在上方补一个新的空「未发布」段；空段则不动
 *
 * 只改文件，不提交 —— 提交由调用方（pre-push 钩子 / 人工）决定。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FW_JSON = path.join(ROOT, 'framework', 'framework.json');
const VERSION_FILE = path.join(ROOT, 'VERSION');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');

const argv = process.argv.slice(2);
const kind = ['minor', 'major'].includes(argv[0]) ? argv[0] : 'patch';
const noChangelog = argv.includes('--no-changelog');
const dryRun = argv.includes('--dry-run');

function fail(msg) {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function bump([maj, min, pat], k) {
  if (k === 'major') return [maj + 1, 0, 0];
  if (k === 'minor') return [maj, min + 1, 0];
  return [maj, min, pat + 1];
}

/** 读当前版本：framework.json 权威；VERSION 不一致时报警并以 framework.json 为准 */
function currentVersion() {
  if (!fs.existsSync(FW_JSON)) fail('找不到 framework/framework.json');
  const fw = JSON.parse(fs.readFileSync(FW_JSON, 'utf8'));
  const v = parseSemver(fw.version);
  if (!v) fail(`framework.json 的 version 不合法：${fw.version}`);
  if (fs.existsSync(VERSION_FILE)) {
    const v2 = parseSemver(fs.readFileSync(VERSION_FILE, 'utf8'));
    if (v2 && (v2[0] !== v[0] || v2[1] !== v[1] || v2[2] !== v[2])) {
      console.warn(`⚠ VERSION（${v2.join('.')}）与 framework.json（${v.join('.')}）不一致，以 framework.json 为准并回写 VERSION`);
    }
  }
  return v;
}

/** CHANGELOG 「未发布」段：有内容 → 落版本号；空段 → 原样返回 */
function stampChangelog(ver) {
  if (!fs.existsSync(CHANGELOG)) return null;
  const md = fs.readFileSync(CHANGELOG, 'utf8');
  const header = '## 未发布';
  const at = md.indexOf(header);
  if (at < 0) return null;

  const bodyStart = at + header.length;
  const next = md.indexOf('\n## ', bodyStart);
  const segEnd = next < 0 ? md.length : next;
  const body = md.slice(bodyStart, segEnd).trim();

  // 空段（无内容 / 只有占位文案）→ 不动 CHANGELOG
  if (!body || /^[（(][^）)]*[）)]$/.test(body.replace(/\s+/g, ''))) return null;

  const date = new Date().toISOString().slice(0, 10);
  const fresh = `${header}\n\n（暂无）\n\n## v${ver} — ${date}`;
  // 保留原未发布正文：fresh + 原正文（bodyStart…segEnd）+ 后续
  return md.slice(0, at) + fresh + md.slice(bodyStart, segEnd) + md.slice(segEnd);
}

function main() {
  const cur = currentVersion();
  const next = bump(cur, kind);
  const nextStr = next.join('.');

  const plan = [
    `framework/framework.json  ${cur.join('.')} → ${nextStr}`,
    `VERSION                  ${cur.join('.')} → ${nextStr}`,
  ];

  let nextMd = null;
  if (!noChangelog) {
    nextMd = stampChangelog(nextStr);
    plan.push(nextMd ? `CHANGELOG.md             「未发布」→「## v${nextStr}」` : 'CHANGELOG.md             未发布段为空，不动');
  }

  console.log(plan.join('\n'));
  if (dryRun) {
    console.log('（--dry-run，未写文件）');
    return;
  }

  const fw = JSON.parse(fs.readFileSync(FW_JSON, 'utf8'));
  fw.version = nextStr;
  fs.writeFileSync(FW_JSON, JSON.stringify(fw, null, 2) + '\n');
  fs.writeFileSync(VERSION_FILE, nextStr + '\n');
  if (nextMd) fs.writeFileSync(CHANGELOG, nextMd);

  console.log(`✔ 版本已升到 ${nextStr}`);
}

main();
