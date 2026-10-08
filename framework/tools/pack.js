#!/usr/bin/env node
'use strict';
/**
 * 打包插件：把 `plugins/<id>/` 打成插件包（tar.gz + 注入逐文件 md5 的第二道校验）。
 *
 * 两种模式：
 *
 *   **开发者模式（默认）** —— 打自己的插件，产物进 `dist/`：
 *     node framework/tools/pack.js <id> [更多…]
 *     node framework/tools/pack.js --all
 *     产物：dist/<id>/<id>-<版本>.tar.gz ＋（声明了 updateUrl 时）dist/<id>/update.json
 *     不算 index.json —— 那是"插件库"的事，开发者手装走 `panel.js install`。
 *
 *   **插件库模式（`--library`）** —— 官方插件仓库（media-bridge-plugins）发版用：
 *     node framework/tools/pack.js --library <id> [更多…] [--out <仓库目录>]
 *     node framework/tools/pack.js --library --all
 *     产物写进 `--out`（默认当前目录）：packages/<id>/… + 重算 index.json（schema 2）。
 *     `--all` 会先清空 `packages/` 与 `index.json` 再全量重打（唯一会丢东西的模式）。
 *
 * 共用口径（两种模式一致）：
 *   · 源码与产物都按 id 平铺，不按类型分目录；
 *   · 打 `<id>` 前先把产物目录里 `<id>/` 整个删掉，升版本后不留新旧两个包；
 *   · 源码连契约都过不了就当场报错、不打包（打包本身是一道前置校验，见 contract.js）；
 *   · 包内那份 plugin.json 会被注入 `files`（逐文件 md5），源码里不写这个字段。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const contract = require('./contract');

/** 清单结构版本（与面板 server/modules/plugin/library.js 的 SCHEMA 是同一个数）。 */
const SCHEMA = 2;

const md5 = contract.md5;

/* -------------------------------------------------------------- 参数与目录 */

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || '').trim() : '';
}

function positionals() {
  const args = process.argv.slice(2);
  const out = [];
  const withValue = new Set(['--out', '--src']);
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      if (withValue.has(args[i])) i++;
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

function listSources(srcRoot) {
  const out = [];
  if (!fs.existsSync(srcRoot)) return out;
  for (const one of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (!one.isDirectory() || one.name.startsWith('.')) continue;
    const dir = path.join(srcRoot, one.name);
    if (!fs.existsSync(path.join(dir, 'plugin.json'))) continue;
    out.push({ spec: one.name, dirName: one.name, dir });
  }
  return out;
}

function sourceOf(srcRoot, spec) {
  const all = listSources(srcRoot);
  const want = String(spec).split('/').map((x) => x.trim()).filter(Boolean).pop() || '';
  const hit = all.find((x) => x.spec === want) || null;
  if (!hit) {
    throw new Error(
      `没有这个插件：「${spec}」${all.length ? `\n  现有的：${all.map((x) => x.spec).join('  ')}` : ''}`
    );
  }
  return hit;
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    if (contract.skipEntry(ent.name)) continue;
    const a = path.join(from, ent.name);
    const b = path.join(to, ent.name);
    if (ent.isDirectory()) copyTree(a, b);
    else fs.copyFileSync(a, b);
  }
}

/* ------------------------------------------------------------------ 打一个包 */

function packOne(one, outRoot, tmpRoot, library) {
  const m = contract.readManifest(one.dir); // 校验：契约不过就不该打出包来

  const stage = path.join(tmpRoot, `stage-${m.id}`);
  fs.rmSync(stage, { recursive: true, force: true });
  copyTree(one.dir, stage);

  /* 第二道校验：算包里每个文件的 md5，写进包内那一份 plugin.json（plugin.json 自己不算） */
  const files = {};
  for (const rel of contract.walk(stage)) {
    if (rel === 'plugin.json') continue;
    files[rel] = md5(fs.readFileSync(path.join(stage, rel)));
  }
  const declared = JSON.parse(fs.readFileSync(path.join(stage, 'plugin.json'), 'utf8'));
  declared.files = files;
  fs.writeFileSync(path.join(stage, 'plugin.json'), JSON.stringify(declared, null, 2) + '\n');

  /* 产物目录：插件库模式 packages/<id>/，开发者模式 <id>/。一个 id 一个目录，升版本不留旧包。 */
  const pkgRelDir = library ? path.join('packages', m.id) : m.id;
  const pkgDir = path.join(outRoot, pkgRelDir);
  fs.rmSync(pkgDir, { recursive: true, force: true });
  fs.mkdirSync(pkgDir, { recursive: true });

  const pkgName = `${m.id}-${m.version}.tar.gz`;
  const rel = `${pkgRelDir.split(path.sep).join('/')}/${pkgName}`;
  const target = path.join(outRoot, rel);
  /* `-C <stage> .` ⇒ 包内顶层就是包内容（不套一层插件目录名） */
  execFileSync('tar', ['-czf', target, '-C', stage, '.'], { stdio: 'pipe' });

  const buf = fs.readFileSync(target);
  fs.rmSync(stage, { recursive: true, force: true });

  /* 自更新清单（Magisk 式）：`url` 只写同目录文件名，面板按 updateUrl 所在目录解析 */
  if (m.updateUrl) {
    const updateInfo = { version: m.version, url: pkgName, md5: md5(buf) };
    const changelog = String(declared.changelog || '').trim();
    if (changelog) updateInfo.changelog = changelog;
    fs.writeFileSync(path.join(pkgDir, 'update.json'), JSON.stringify(updateInfo, null, 2) + '\n');
  }

  return {
    types: m.types,
    type: m.type,
    id: m.id,
    name: m.name,
    author: m.author,
    version: m.version,
    description: m.description,
    domain: m.domain,
    hasWebui: Object.keys(m.webui || {}).length > 0,
    depends: m.depends,
    bytes: buf.length,
    md5: md5(buf),
    path: rel,
    _files: Object.keys(files).length + 1,
    _dirName: one.dirName,
  };
}

/* -------------------------------------------------- 清单重算（仅插件库模式） */

function collectPackages(outRoot) {
  const root = path.join(outRoot, 'packages');
  const out = [];
  const walkDir = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walkDir(full);
      else if (ent.name.endsWith('.tar.gz')) out.push(full);
    }
  };
  if (fs.existsSync(root)) walkDir(root);
  return out.sort();
}

function entryOfPackage(file, outRoot, tmpRoot) {
  const stage = path.join(tmpRoot, 'unpack');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  execFileSync('tar', ['-xzf', file, '-C', stage], { stdio: 'pipe' });
  const m = contract.readManifest(stage); // 包里那份带 files ⇒ 逐文件核对
  const buf = fs.readFileSync(file);
  fs.rmSync(stage, { recursive: true, force: true });
  return {
    types: m.types,
    type: m.type,
    id: m.id,
    name: m.name,
    author: m.author,
    version: m.version,
    description: m.description,
    domain: m.domain,
    hasWebui: Object.keys(m.webui || {}).length > 0,
    depends: m.depends,
    bytes: buf.length,
    md5: md5(buf),
    path: path.relative(outRoot, file).split(path.sep).join('/'),
  };
}

function rebuildIndex(outRoot, tmpRoot) {
  const seen = new Map();
  const plugins = collectPackages(outRoot).map((f) => entryOfPackage(f, outRoot, tmpRoot));
  for (const e of plugins) {
    if (seen.has(e.id)) throw new Error(`packages/ 里存在两个 id=${e.id} 的包（${seen.get(e.id)} 与 ${e.path}），先删掉旧的`);
    seen.set(e.id, e.path);
  }
  plugins.sort((a, b) => (a.types[0] === b.types[0] ? a.id.localeCompare(b.id) : a.types[0].localeCompare(b.types[0])));
  const clean = plugins.map(({ types, id, name, author, version, description, domain, hasWebui, depends, bytes, md5, path: p }) => {
    const row = { types, id, name, author, version, description, domain: domain || undefined, hasWebui, depends, bytes, md5, path: p };
    for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
    return row;
  });
  const index = { schema: SCHEMA, generatedAt: new Date().toISOString(), plugins: clean };
  fs.writeFileSync(path.join(outRoot, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  return plugins;
}

/* ---------------------------------------------------------------------- 主 */

function main() {
  const library = process.argv.includes('--library');
  const all = process.argv.includes('--all');
  const specs = positionals();
  const srcRoot = path.resolve(argValue('--src') || 'plugins');
  const outRoot = path.resolve(argValue('--out') || (library ? process.cwd() : 'dist'));

  if (!all && !specs.length) {
    console.error(
      '用法：node framework/tools/pack.js <id> [更多…] [--src plugins] [--out dist]\n' +
        '      node framework/tools/pack.js --all\n' +
        '      node framework/tools/pack.js --library <id>|--all [--out <插件仓库目录>]'
    );
    process.exit(2);
  }
  fs.mkdirSync(outRoot, { recursive: true });

  let sources;
  try {
    if (all) {
      if (library) {
        fs.rmSync(path.join(outRoot, 'packages'), { recursive: true, force: true });
        fs.rmSync(path.join(outRoot, 'index.json'), { force: true });
      } else {
        fs.rmSync(outRoot, { recursive: true, force: true });
        fs.mkdirSync(outRoot, { recursive: true });
      }
      sources = listSources(srcRoot);
      if (!sources.length) throw new Error(`没有找到任何插件：${srcRoot}/<id>/plugin.json`);
    } else {
      sources = specs.map((s) => sourceOf(srcRoot, s));
    }
  } catch (e) {
    console.error('✘ ' + ((e && e.message) || e));
    process.exit(1);
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-pack-'));
  const entries = [];
  try {
    for (const one of sources) entries.push(packOne(one, outRoot, tmpRoot, library));
    let indexCount = 0;
    if (library) indexCount = rebuildIndex(outRoot, tmpRoot).length;
    entries.sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type.localeCompare(b.type)));

    console.log(`\n产物 → ${outRoot}\n`);
    for (const e of entries) {
      if (e._dirName !== e.id) console.log(`  ⚠ 目录名与 plugin.json 的 id 不一致：…/${e._dirName} → ${e.id}`);
      console.log(
        `  ${e.types.join('/').padEnd(20)} ${e.id.padEnd(10)} v${String(e.version).padEnd(8)} ${String(e._files).padStart(3)} 文件  ` +
          `${String(e.bytes).padStart(8)}B  md5 ${e.md5.slice(0, 8)}…`
      );
    }
    console.log(
      library
        ? `\n  本次打 ${entries.length} 个；index.json 已按 packages/ 重算，共 ${indexCount} 个插件。`
        : `\n  本次打 ${entries.length} 个。装到面板：node framework/tools/panel.js install <id>`
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
