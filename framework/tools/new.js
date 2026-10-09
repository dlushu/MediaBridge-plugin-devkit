#!/usr/bin/env node
'use strict';
/**
 * 生成插件骨架：从 framework/templates/<类型>/ 复制一份到 plugins/<id>/。
 *
 * 用法（在项目根目录）：
 *   node framework/tools/new.js <id> --type source|metadata|home|subtitle|output [--name 显示名] [--domain 域id]
 *
 * `--domain` 只对 metadata 有用：元数据的域 id 就是条目 Id 前缀，形状 `[a-z][a-z0-9]*`
 * （比插件 id 严——id 允许 `.` `-` `_`，域 id 不允许）。缺省按插件 id 去掉非法字符推出来。
 *
 * 骨架只是"能跑起来的最小形态"：动作全是如实失败的桩，按契约文档逐个实现。
 * 多类型包：先生成主类型，再按契约第二节把其它角色放 roles/<类型>/、
 * plugin.json 的 types / webui 改成数组与映射（见 framework/templates/ 里各角色的写法）。
 */
const fs = require('fs');
const path = require('path');
const contract = require('./contract');

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || '').trim() : '';
}

function copyTree(from, to, fill) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, ent.name);
    const b = path.join(to, ent.name);
    if (ent.isDirectory()) copyTree(a, b, fill);
    else fs.writeFileSync(b, fill(fs.readFileSync(a, 'utf8')));
  }
}

function main() {
  const id = (process.argv[2] || '').startsWith('--') ? '' : process.argv[2] || '';
  const type = argValue('--type');
  const name = argValue('--name') || id;
  if (!id || id.startsWith('--') || !type) {
    console.error('用法：node framework/tools/new.js <id> --type source|metadata|home|subtitle|output [--name 显示名] [--domain 域id]');
    process.exit(2);
  }
  if (!contract.ID_RE.test(id)) {
    console.error(`✘ id 不合法：「${id}」（字母开头，字母数字与 . _ -，2~64 位）`);
    process.exit(1);
  }
  if (!contract.TYPES.includes(type)) {
    console.error(`✘ 类型只认：${contract.TYPES.join(' / ')}`);
    process.exit(1);
  }
  /* 元数据的域 id 比插件 id 严（只许字母数字），缺省按 id 洗出来，也可用 --domain 指定 */
  let domain = '';
  if (type === 'metadata') {
    domain = argValue('--domain') || id.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!/^[a-z][a-z0-9]*$/.test(domain)) {
      console.error(`✘ 域 id 不合法：「${domain}」（字母开头的字母数字，如 mydomain；用 --domain 指定）`);
      process.exit(1);
    }
  }
  const tpl = path.join(__dirname, '..', 'templates', type);
  const dest = path.resolve('plugins', id);
  if (fs.existsSync(dest)) {
    console.error(`✘ 已存在：plugins/${id}/`);
    process.exit(1);
  }
  copyTree(tpl, dest, (s) =>
    s.split('__PLUGIN_ID__').join(id).split('__PLUGIN_NAME__').join(name).split('__PLUGIN_DOMAIN__').join(domain)
  );
  console.log(`✔ 骨架已生成：plugins/${id}/（${type}${domain ? `，域 id ${domain}` : ''}）`);
  console.log('  下一步：按 framework/contracts/ 实现动作 → node framework/tools/check.js ' + id);
}

main();
