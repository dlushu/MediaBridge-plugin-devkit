#!/usr/bin/env node
'use strict';
/**
 * 本地契约校验：插件开发者在打包前自查。
 *
 * 用法（在项目根目录）：
 *   node framework/tools/check.js               # 校验 plugins/ 下全部
 *   node framework/tools/check.js <id> [更多…]   # 只校验指定的
 *
 * 不合法就抛出 BAD_MANIFEST，exit 1；全通过就列出 id / name / version / types。
 */
const path = require('path');
const fs = require('fs');
const contract = require('./contract');

const PLUGINS_DIR = path.resolve('plugins');

function listAll() {
  const out = [];
  if (!fs.existsSync(PLUGINS_DIR)) return out;
  for (const ent of fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
    const dir = path.join(PLUGINS_DIR, ent.name);
    if (!fs.existsSync(path.join(dir, 'plugin.json'))) continue;
    out.push({ id: ent.name, dir });
  }
  return out;
}

function main() {
  const specs = process.argv.slice(2);
  const all = specs.length ? [] : listAll();
  if (specs.length) {
    for (const s of specs) {
      const dir = path.join(PLUGINS_DIR, s);
      if (!fs.existsSync(path.join(dir, 'plugin.json'))) {
        console.error(`找不到插件目录：plugins/${s}/plugin.json`);
        process.exit(1);
      }
      all.push({ id: s, dir });
    }
  }
  if (!all.length) {
    console.log('plugins/ 下没有插件。用法：node check.js [id …]');
    return;
  }
  for (const it of all) {
    try {
      const m = contract.readManifest(it.dir);
      console.log(`  ✔ ${m.id.padEnd(10)} v${String(m.version).padEnd(8)} ${m.types.join('/')}`);
    } catch (e) {
      console.error(`\n  ✘ ${it.id}: ${e.message}`);
      process.exit(1);
    }
  }
  console.log(`\n共 ${all.length} 个，校验通过。`);
}
main();
