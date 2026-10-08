#!/usr/bin/env node
'use strict';
/**
 * 面板 API 客户端：登录 / 装包 / 手发动作 —— 真面板实测闭环的命令行侧。
 *
 * 用法（在项目根目录）：
 *   node framework/tools/panel.js login --host http://127.0.0.1:8088 --password 123456
 *   node framework/tools/panel.js status
 *   node framework/tools/panel.js list
 *   node framework/tools/panel.js install <id> [--no-enable]   # 先 pack 再上传安装
 *   node framework/tools/panel.js call <类型> <id> <动作> [argsJson] [--timeout 30000]
 *   node framework/tools/panel.js restart <类型> <id>
 *   node framework/tools/panel.js uninstall <类型> <id>
 *
 * 登录态存项目根的 `.panel-auth.json`（含 host 与会话 cookie；**已 gitignore，凭据不入库**）。
 * 面板默认密码 123456，本地实例首启后请先改密。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');

const AUTH_FILE = path.resolve('.panel-auth.json');

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || '').trim() : '';
}

function loadAuth() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveAuth(a) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(a, null, 2) + '\n', { mode: 0o600 });
}

/** 发一发 HTTP（JSON 入、JSON 出）；带登录 cookie，跟上 Set-Cookie 滑动续期 */
function request(method, urlPath, body) {
  const auth = loadAuth();
  if (!auth || !auth.host) throw new Error('还没登录：先 panel.js login --host <面板地址> --password <密码>');
  const base = new URL(auth.host);
  const lib = base.protocol === 'https:' ? https : http;
  const data = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');
  const opts = {
    method,
    hostname: base.hostname,
    port: base.port || (base.protocol === 'https:' ? 443 : 80),
    path: urlPath,
    headers: { Accept: 'application/json' },
    timeout: Number(argValue('--timeout')) || 35000,
  };
  if (data) {
    opts.headers['Content-Type'] = 'application/json';
    opts.headers['Content-Length'] = data.length;
  }
  if (auth.cookie) opts.headers.Cookie = auth.cookie;
  return new Promise((resolve, reject) => {
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        /* 滑动过期：面板每次回 Set-Cookie 就记下来 */
        const sc = res.headers['set-cookie'];
        if (sc && sc.length) {
          const m = /mbp_panel=[^;]+/.exec(sc[0]);
          if (m && auth.cookie !== m[0]) saveAuth({ ...auth, cookie: m[0] });
        }
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* 非 JSON 响应原样带回 */
        }
        resolve({ status: res.statusCode, json, text });
      });
    });
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function show(r) {
  if (r.status >= 400) {
    console.error(`✘ HTTP ${r.status}: ${r.text.slice(0, 400)}`);
    process.exit(1);
  }
  console.log(JSON.stringify(r.json !== null ? r.json : r.text, null, 2));
}

async function main() {
  const cmd = process.argv[2] || '';
  if (cmd === 'login') {
    const host = argValue('--host').replace(/\/+$/, '');
    const password = argValue('--password');
    if (!host || !password) {
      console.error('用法：panel.js login --host http://<面板地址:端口> --password <密码>');
      process.exit(2);
    }
    saveAuth({ host, cookie: '' });
    const r = await request('POST', '/api/auth/login', { password });
    if (r.status >= 400) {
      fs.rmSync(AUTH_FILE, { force: true });
      console.error(`✘ 登录失败 HTTP ${r.status}: ${r.text.slice(0, 200)}`);
      process.exit(1);
    }
    /* 登录响应里拿到 cookie 才算数（request 已顺手存了） */
    const auth = loadAuth();
    if (!auth.cookie) {
      console.error('✘ 登录响应里没有会话 cookie');
      process.exit(1);
    }
    console.log(`✔ 已登录 ${host}（会话存 .panel-auth.json）`);
    return;
  }

  if (cmd === 'status') return show(await request('GET', '/api/auth/status'));
  if (cmd === 'list') return show(await request('GET', '/api/plugins'));

  if (cmd === 'install') {
    const id = process.argv[3] || '';
    if (!id) {
      console.error('用法：panel.js install <id> [--no-enable]');
      process.exit(2);
    }
    /* 先打包（默认开发者模式产物在 dist/<id>/） */
    execFileSync('node', [path.join(__dirname, 'pack.js'), id], { stdio: 'inherit' });
    const pkg = JSON.parse(fs.readFileSync(path.resolve(`plugins/${id}/plugin.json`), 'utf8'));
    const file = path.resolve(`dist/${id}/${id}-${pkg.version}.tar.gz`);
    const buf = fs.readFileSync(file);
    const md5 = require('./contract').md5(buf);
    const enable = !process.argv.includes('--no-enable');
    const r = await request('POST', '/api/plugins/install', {
      tarball: buf.toString('base64'),
      md5,
      enable,
    });
    if (r.status >= 400) {
      console.error(`✘ 安装失败 HTTP ${r.status}: ${r.text.slice(0, 400)}`);
      process.exit(1);
    }
    console.log(`✔ 已安装 ${id} v${pkg.version}${enable ? '（已启用）' : ''}`);
    return;
  }

  if (cmd === 'call') {
    const [, , type, id, action, argsJson] = process.argv;
    if (!type || !id || !action) {
      console.error('用法：panel.js call <类型> <id> <动作> [argsJson] [--timeout 30000]');
      process.exit(2);
    }
    const body = { action };
    if (argsJson) body.args = JSON.parse(argsJson);
    if (argValue('--timeout')) body.timeoutMs = Number(argValue('--timeout'));
    return show(await request('POST', `/api/plugins/${type}/${id}/call`, body));
  }

  if (cmd === 'restart' || cmd === 'uninstall') {
    const [, , type, id] = process.argv;
    if (!type || !id) {
      console.error(`用法：panel.js ${cmd} <类型> <id>`);
      process.exit(2);
    }
    if (cmd === 'restart') return show(await request('POST', `/api/plugins/${type}/${id}/restart`, {}));
    return show(await request('DELETE', `/api/plugins/${type}/${id}`));
  }

  console.error(
    '用法：panel.js login|status|list|install|call|restart|uninstall …\n' +
      '  login --host <面板地址> --password <密码>\n' +
      '  install <id> [--no-enable]\n' +
      '  call <类型> <id> <动作> [argsJson] [--timeout ms]'
  );
  process.exit(2);
}

main().catch((e) => {
  console.error('✘ ' + ((e && e.message) || e));
  process.exit(1);
});
