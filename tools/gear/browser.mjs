/**
 * Navegador headless mínimo (Edge/Chrome via CDP, sem dependências) para as
 * ferramentas do pacote de itens: abre uma página, roda JS nela e tira prints.
 *
 * @example
 * const b = await openBrowser({ width: 1280, height: 720 });
 * await b.goto('http://localhost:5173/tools/item-lab.html');
 * await b.waitFor('window.lab?.ready');
 * await b.screenshot('saida.jpg');
 * await b.close();
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = [
  process.env.BROWSER_BIN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].filter(Boolean);

export async function openBrowser({ width = 1280, height = 720, port = 9333 + Math.floor(Math.random() * 500), gpu = true } = {}) {
  const bin = CANDIDATES.find((p) => fs.existsSync(p));
  if (!bin) throw new Error('Nenhum Edge/Chrome encontrado (defina BROWSER_BIN).');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gear-lab-'));
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars', '--enable-unsafe-swiftshader',
    ...(gpu ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader']),
    'about:blank',
  ];
  const proc = spawn(bin, args, { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* ainda subindo */ }
  }
  if (!target) { proc.kill(); throw new Error('O navegador não abriu a porta de depuração.'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map(), logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); if (m.error) rej(new Error(m.error.message)); else res(m.result); }
    else if (m.method === 'Runtime.consoleAPICalled') logs.push(`[${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    else if (m.method === 'Runtime.exceptionThrown') logs.push(`[exception] ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  };
  let closed = null;
  ws.onclose = () => { closed = new Error('O navegador fechou a conexão (a página travou ou caiu).'); for (const { rej } of pending.values()) rej(closed); pending.clear(); };
  const send = (method, params = {}) => new Promise((res, rej) => { if (closed) { rej(closed); return; } const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  return {
    logs,
    send,
    evaluate,
    goto: (url) => send('Page.navigate', { url }),
    async waitFor(expression, timeoutMs = 120000, everyMs = 500) {
      const t0 = Date.now();
      for (;;) {
        try { if (await evaluate(`!!(${expression})`)) return true; } catch { /* página ainda carregando */ }
        if (Date.now() - t0 > timeoutMs) throw new Error(`Tempo esgotado esperando: ${expression}\n${logs.slice(-15).join('\n')}`);
        await new Promise((r) => setTimeout(r, everyMs));
      }
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    async screenshot(file, { quality = 82 } = {}) {
      const jpeg = /\.jpe?g$/i.test(file);
      const r = await send('Page.captureScreenshot', jpeg ? { format: 'jpeg', quality } : { format: 'png' });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    async close() {
      try { await send('Browser.close'); } catch { /* já fechou */ }
      ws.close();
      proc.kill();
      await new Promise((r) => setTimeout(r, 400));
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* perfil em uso: o sistema limpa depois */ }
    },
  };
}
