#!/usr/bin/env node
'use strict';
/**
 * 框架自更新（见 AGENTS.md 铁律 13）。
 *
 * 用法：
 *   node framework/tools/update.js --check   # 只比对版本，不改动
 *   node framework/tools/update.js           # 比对 + 下载覆盖 framework/ 与 skill
 *
 * 退出码：0 已是最新/升级成功；2 有新版本（仅 --check）；3 网络或环境出错。
 *
 * 只覆盖 framework/ 与 .trae/skills/media-bridge-plugin-dev/SKILL.md；
 * plugins/、dist/、packages/、index.json、.panel* 一律不动。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = 'dlushu/MediaBridge-plugin-devkit';
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const TARBALL = `https://codeload.github.com/${REPO}/tar.gz/refs/heads/main`;

const ROOT = path.join(__dirname, '..', '..'); // framework/tools → 项目根
const checkOnly = process.argv.includes('--check');

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

async function fetchJson(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function fetchBuffer(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function remoteVersion() {
  const fw = await fetchJson(`${RAW}/framework/framework.json`, 10_000);
  const v = parseSemver(fw.version);
  if (!v) throw new Error(`远端版本号不合法：${fw.version}`);
  return v;
}

function localVersion() {
  const p = path.join(ROOT, 'framework', 'framework.json');
  if (!fs.existsSync(p)) throw new Error('本地找不到 framework/framework.json —— 这个脚本要在已 init 的项目里跑');
  const v = parseSemver(JSON.parse(fs.readFileSync(p, 'utf8')).version);
  if (!v) throw new Error('本地版本号不合法');
  return v;
}

/** 下载 tarball → 解到临时目录 → 覆盖 framework/ 与 SKILL.md */
async function doUpgrade(verStr) {
  const buf = await fetchBuffer(TARBALL, 60_000);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-update-'));
  try {
    const tgz = path.join(tmp, 'devkit.tar.gz');
    fs.writeFileSync(tgz, buf);
    execFileSync('tar', ['-xzf', tgz, '-C', tmp]);
    const srcDir = fs.readdirSync(tmp).find((n) => n.startsWith('MediaBridge-plugin-devkit'));
    if (!srcDir) throw new Error('压缩包结构异常');
    const src = path.join(tmp, srcDir);

    // 1. framework/ 先清空再覆盖（防文件重命名后残留）
    const fwDest = path.join(ROOT, 'framework');
    fs.rmSync(fwDest, { recursive: true, force: true });
    fs.cpSync(path.join(src, 'framework'), fwDest, { recursive: true });

    // 2. SKILL.md
    const skillDest = path.join(ROOT, '.trae', 'skills', 'media-bridge-plugin-dev');
    fs.mkdirSync(skillDest, { recursive: true });
    fs.copyFileSync(path.join(src, 'SKILL.md'), path.join(skillDest, 'SKILL.md'));

    console.log(`✔ 已升级到 v${verStr}`);
    console.log('  · framework/ 已整体更新');
    console.log('  · .trae/skills/media-bridge-plugin-dev/SKILL.md 已更新');
    console.log('  · plugins/ 等本地文件未动');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  let local, remote;
  try {
    local = localVersion();
    remote = await remoteVersion();
  } catch (e) {
    console.error(`✘ 检查更新失败：${e.message}`);
    process.exit(3);
  }

  const localStr = local.join('.');
  const remoteStr = remote.join('.');
  const c = cmp(local, remote);

  if (c >= 0) {
    console.log(`✔ 框架已是最新（v${localStr}）`);
    process.exit(0);
  }

  console.log(`有新版本：v${localStr} → v${remoteStr}`);
  if (checkOnly) process.exit(2);

  try {
    await doUpgrade(remoteStr);
  } catch (e) {
    console.error(`✘ 升级失败：${e.message}`);
    process.exit(3);
  }
}

main();
