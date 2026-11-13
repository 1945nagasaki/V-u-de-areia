/**
 * Gera os ícones coloridos dos itens do pacote a partir dos modelos 3D
 * (tools/item-lab.html → lab.iconPNG): PNG 512×512, fundo transparente de
 * verdade, contorno escuro, enquadramento com margem.
 *
 * Saída: public/assets/icons/items/<id>.png + src/config/gearIcons.js (lista
 * dos ícones existentes, para a interface não pedir arquivo que não há).
 *
 * São ícones PROVISÓRIOS: quando o Icones.zip estiver na pasta, os desenhos
 * originais coloridos devem substituir estes arquivos (mesmos nomes).
 *
 * Uso (com `npx vite --port 5199` rodando):
 *   node tools/gear/export-item-icons.mjs http://127.0.0.1:5199
 */
import fs from 'node:fs';
import { openBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const dir = 'public/assets/icons/items';
fs.mkdirSync(dir, { recursive: true });

const b = await openBrowser({ width: 640, height: 640 });
const done = [];
try {
  await b.goto(`${base}/tools/item-lab.html?hud=0`);
  await b.waitFor('window.lab?.ready', 60000);
  const ids = await b.evaluate('lab.ids');
  for (const id of ids) {
    const url = await b.evaluate(`lab.iconPNG('${id}')`);
    const png = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(`${dir}/${id}.png`, png);
    // PNG: largura/altura nos bytes 16..23; tipo de cor (byte 25) 6 = RGBA
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20), rgba = png[25] === 6;
    if (w !== 512 || h !== 512 || !rgba) throw new Error(`${id}: PNG inesperado (${w}×${h}, alfa=${rgba})`);
    done.push(id);
  }
  const errors = b.logs.filter((l) => /^\[(error|exception)/.test(l));
  if (errors.length) console.log(`ERROS NO CONSOLE:\n${errors.join('\n')}`);
} finally {
  await b.close();
}

fs.writeFileSync('src/config/gearIcons.js', `/**
 * Ícones coloridos disponíveis em \`public/assets/icons/items/<id>.png\`.
 * Item fora desta lista usa o ícone de linha (\`ui/Icons.js\`).
 *
 * GERADO por \`tools/gear/export-item-icons.mjs\` (renderiza o modelo 3D de cada
 * item com fundo transparente). São ícones PROVISÓRIOS: os do Icones.zip ainda
 * não foram coloridos porque o arquivo não estava no computador — ver
 * docs/GEAR-SYSTEM.md.
 */
export const GEAR_ICONS = new Set([
${done.map((id) => `  '${id}',`).join('\n')}
]);
`);
console.log(`${done.length} ícones em ${dir}`);
