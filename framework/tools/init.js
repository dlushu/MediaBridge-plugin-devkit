#!/usr/bin/env node
'use strict';
/**
 * 初始化 / 升级：把开发框架落进一个插件项目目录。
 *
 * 用法：
 *   node <devkit>/framework/tools/init.js [目标目录]   # 默认当前目录（首次安装）
 *   node <devkit>/framework/tools/init.js --upgrade [目标目录]   # 只更新 framework/ 与 skill
 *   curl -sL <init.js 地址> | node - --upgrade [目标目录]       # 零克隆升级
 *
 * 首次落进去的东西：
 *   framework/                                  工具 + 模板 + 契约文档（带版本戳）
 *   .trae/skills/media-bridge-plugin-dev/       SKILL.md（agent 的开发入口）
 *   .gitignore                                  追加 .panel* / dist 条目（已存在则跳过重复行）
 *   plugins/                                    插件源码目录（空目录占位）
 *
 * 升级只覆盖 framework/ 与 SKILL.md —— 插件源码、面板实例（.panel/）原样保留。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const REPO = 'dlushu/MediaBridge-plugin-devkit';
const TARBALL = `https://codeload.github.com/${REPO}/tar.gz/refs/heads/main`;

const rawArgs = process.argv.slice(2);
const upgrade = rawArgs.includes('--upgrade');
const args = rawArgs.filter((a) => !a.startsWith('--'));
const TARGET = path.resolve(args[0] || process.cwd());

/** 本脚本若从 devkit 仓里跑：SRC_ROOT 有效；curl 管道跑时 SRC_ROOT 不存在 */
const SRC_ROOT = path.resolve(__dirname, '..', '..');
const HAVE_LOCAL_SOURCE = fs.existsSync(path.join(SRC_ROOT, 'framework', 'framework.json'));

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    const a = path.join(from, ent.name);
    const b = path.join(to, ent.name);
    if (ent.isDirectory()) copyTree(a, b);
    else fs.copyFileSync(a, b);
  }
}

/* ---------------- 首次安装 ---------------- */

function freshInstall() {
  if (!HAVE_LOCAL_SOURCE) {
    console.error('✘ 找不到 framework/ —— 首次安装要从 devkit 仓库里跑这个脚本（或用 curl 管道配 --upgrade 之外的方式）');
    process.exit(1);
  }
  copyTree(path.join(SRC_ROOT, 'framework'), path.join(TARGET, 'framework'));

  const skillDir = path.join(TARGET, '.trae', 'skills', 'media-bridge-plugin-dev');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(path.join(SRC_ROOT, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

  /* .gitignore 追加（凭据与本地产物不入库） */
  const giPath = path.join(TARGET, '.gitignore');
  const want = ['dist/', '.panel/', '.panel-data/', '.panel-auth.json'];
  let gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
  for (const line of want) {
    if (!gi.split('\n').includes(line)) gi += (gi && !gi.endsWith('\n') ? '\n' : '') + line + '\n';
  }
  fs.writeFileSync(giPath, gi);

  fs.mkdirSync(path.join(TARGET, 'plugins'), { recursive: true });

  const v = JSON.parse(fs.readFileSync(path.join(SRC_ROOT, 'framework', 'framework.json'), 'utf8')).version;
  console.log(`✔ 框架 v${v} 已落进 ${TARGET}`);
  console.log('  · framework/          工具 + 契约文档');
  console.log('  · .trae/skills/        agent 开发入口');
  console.log('\n下一步：node framework/tools/new.js <插件id> --type source|metadata|home|subtitle|output');
}

/* ---------------- 升级 ---------------- */

/** 本地已有 update.js → 直接交给它（它永远跟本地框架同版，负责拉远端新版） */
function upgradeViaLocalTool() {
  const tool = path.join(TARGET, 'framework', 'tools', 'update.js');
  if (fs.existsSync(tool)) {
    const r = spawnSync(process.execPath, [tool], { stdio: 'inherit' });
    process.exit(r.status ?? 0);
  }
}

/** curl 管道升级（本地没有 framework/）：下载 tarball，覆盖 framework/ + SKILL.md */
async function upgradeViaTarball() {
  console.log('下载框架包 …');
  const res = await fetch(TARBALL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devkit-init-'));
  try {
    const tgz = path.join(tmp, 'devkit.tar.gz');
    fs.writeFileSync(tgz, buf);
    execFileSync('tar', ['-xzf', tgz, '-C', tmp]);
    const srcDir = fs.readdirSync(tmp).find((n) => n.startsWith('MediaBridge-plugin-devkit'));
    if (!srcDir) throw new Error('压缩包结构异常');
    const src = path.join(tmp, srcDir);

    const fwDest = path.join(TARGET, 'framework');
    fs.rmSync(fwDest, { recursive: true, force: true });
    copyTree(path.join(src, 'framework'), fwDest);

    const skillDest = path.join(TARGET, '.trae', 'skills', 'media-bridge-plugin-dev');
    fs.mkdirSync(skillDest, { recursive: true });
    fs.copyFileSync(path.join(src, 'SKILL.md'), path.join(skillDest, 'SKILL.md'));

    const v = JSON.parse(fs.readFileSync(path.join(fwDest, 'framework.json'), 'utf8')).version;
    console.log(`✔ 已升级到 v${v}（framework/ 与 SKILL.md；其他文件未动）`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  if (!upgrade) {
    freshInstall();
    return;
  }
  // 有本地 update.js 就交给它；否则（curl 管道 / 旧版无 update.js）走 tarball
  if (HAVE_LOCAL_SOURCE) upgradeViaLocalTool();
  try {
    await upgradeViaTarball();
  } catch (e) {
    console.error(`✘ 升级失败：${e.message}`);
    process.exit(3);
  }
}

main();
