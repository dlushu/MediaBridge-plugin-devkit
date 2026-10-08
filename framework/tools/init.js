#!/usr/bin/env node
'use strict';
/**
 * 初始化：把开发框架落进一个插件项目目录。
 *
 * 用法：
 *   node <devkit>/framework/tools/init.js [目标目录]     # 默认当前目录
 *   node <devkit>/framework/tools/init.js --upgrade       # 只覆盖 framework/ 与 skill（更新框架）
 *
 * 落进去的东西：
 *   framework/                                  工具 + 模板 + 契约文档（带版本戳）
 *   .trae/skills/media-bridge-plugin-dev/       SKILL.md（agent 的开发入口）
 *   .gitignore                                  追加 .panel* / dist 条目（已存在则跳过重复行）
 *   plugins/                                    插件源码目录（空目录占位）
 *
 * 不动目标目录里的任何其它文件 —— 你的插件源码、面板实例（.panel/）都原样保留。
 */
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '..', '..'); // devkit 根
const FW_SRC = path.join(SRC_ROOT, 'framework');
const SKILL_SRC = path.join(SRC_ROOT, 'SKILL.md');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TARGET = path.resolve(args[0] || process.cwd());

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

function main() {
  if (!fs.existsSync(path.join(FW_SRC, 'framework.json'))) {
    console.error('✘ 找不到 framework/ —— 这个脚本要从 devkit 仓库里跑（framework/tools/init.js）');
    process.exit(1);
  }
  copyTree(FW_SRC, path.join(TARGET, 'framework'));

  const skillDir = path.join(TARGET, '.trae', 'skills', 'media-bridge-plugin-dev');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(SKILL_SRC, path.join(skillDir, 'SKILL.md'));

  /* .gitignore 追加（凭据与本地产物不入库） */
  const giPath = path.join(TARGET, '.gitignore');
  const want = ['dist/', '.panel/', '.panel-data/', '.panel-auth.json'];
  let gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
  for (const line of want) {
    if (!gi.split('\n').includes(line)) gi += (gi && !gi.endsWith('\n') ? '\n' : '') + line + '\n';
  }
  fs.writeFileSync(giPath, gi);

  fs.mkdirSync(path.join(TARGET, 'plugins'), { recursive: true });

  const v = JSON.parse(fs.readFileSync(path.join(FW_SRC, 'framework.json'), 'utf8')).version;
  console.log(`✔ 框架 v${v} 已落进 ${TARGET}`);
  console.log('  · framework/          工具 + 契约文档');
  console.log('  · .trae/skills/        agent 开发入口');
  console.log('\n下一步：node framework/tools/new.js <插件id> --type source|metadata|home|subtitle|output');
}

main();
