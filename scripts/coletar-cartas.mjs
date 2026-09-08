// Le a lista oficial de cartas da Bandai e salva data/cartas.json
// Fonte: https://en.onepiece-cardgame.com/cardlist/
import { writeFileSync, mkdirSync } from 'node:fs';
import { buscarHtml, limpar, primeiro, paraNumero, esperar, log } from './lib.mjs';

const LISTA = 'https://en.onepiece-cardgame.com/cardlist/';
const BASE = 'https://en.onepiece-cardgame.com';

async function listarSeries() {
  const html = await buscarHtml(LISTA);
  const bloco = html.match(/<select[^>]*name="series"[\s\S]*?<\/select>/);
  if (!bloco) throw new Error('nao achei o seletor de series na pagina da Bandai');
  const series = [];
  for (const m of bloco[0].matchAll(/<option[^>]*value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g)) {
    series.push({ id: m[1], nome: limpar(m[2]).replace(/\s+/g, ' ') });
  }
  return series;
}

function extrairCartas(html) {
  const achados = [];
  for (const bruto of html.split('<dl class="modalCol"').slice(1)) {
    const bloco = bruto.slice(0, bruto.indexOf('</dl>') + 1 || undefined);

    const idBruto = (bloco.match(/^\s*id="([^"]+)"/) || [])[1];
    if (!idBruto) continue;

    const info = bloco.match(/<div class="infoCol">([\s\S]*?)<\/div>/);
    const partes = info ? [...info[1].matchAll(/<span>([\s\S]*?)<\/span>/g)].map((m) => limpar(m[1])) : [];
    const id = partes[0] || idBruto.split('_')[0];
    const raridade = partes[1] || '';
    const tipo = (partes[2] || '').toUpperCase();

    const custoOuVida = bloco.match(/<div class="cost"><h3>(Cost|Life)<\/h3>([\s\S]*?)<\/div>/);
    const rotuloCusto = custoOuVida ? custoOuVida[1] : '';
    const valorCusto = custoOuVida ? paraNumero(custoOuVida[2]) : null;

    const cor = primeiro(bloco, /<div class="color"><h3>Color<\/h3>([\s\S]*?)<\/div>/);
    const tracos = primeiro(bloco, /<div class="feature"><h3>Type<\/h3>([\s\S]*?)<\/div>/);
    const imgRel = (bloco.match(/<div class="frontCol">[\s\S]*?data-src="([^"]+)"/) || [])[1] || '';

    achados.push({
      id,
      alt: idBruto.includes('_'),
      carta: {
        nome: primeiro(bloco, /<div class="cardName">([\s\S]*?)<\/div>/),
        tipo,
        raridade,
        cor,
        cores: cor ? cor.split('/').map((c) => c.trim()).filter(Boolean) : [],
        custo: rotuloCusto === 'Cost' ? valorCusto : null,
        vida: rotuloCusto === 'Life' ? valorCusto : null,
        poder: paraNumero(primeiro(bloco, /<div class="power"><h3>Power<\/h3>([\s\S]*?)<\/div>/)) ?? null,
        counter: paraNumero(primeiro(bloco, /<div class="counter"><h3>Counter<\/h3>([\s\S]*?)<\/div>/)) ?? 0,
        atributo: primeiro(bloco, /<div class="attribute">[\s\S]*?<i>([\s\S]*?)<\/i>/),
        block: paraNumero(primeiro(bloco, /<div class="block"><h3>Block[\s\S]*?<\/h3>([\s\S]*?)<\/div>/)),
        tracos: tracos ? tracos.split('/').map((t) => t.trim()).filter(Boolean) : [],
        efeito: primeiro(bloco, /<div class="text"><h3>Effect<\/h3>([\s\S]*?)<\/div>/),
        // A Bandai bloqueia hotlink: a imagem abre no curl mas o navegador leva erro.
        // Entao o site usa a CDN da dotgg (que libera) e guardamos a URL oficial so como referencia.
        imagem: `https://static.dotgg.gg/onepiece/card/${id}.webp`,
        imagemOficial: imgRel ? new URL(imgRel.replace(/^\.\./, ''), BASE).href.split('?')[0] : '',
        set: id.split('-')[0],
      },
    });
  }
  return achados;
}

async function principal() {
  const series = await listarSeries();
  log(`${series.length} colecoes encontradas no site da Bandai`);

  const cartas = {};
  const vindoDeAlt = new Set();
  let falhas = 0;

  for (const [i, s] of series.entries()) {
    try {
      const html = await buscarHtml(`${LISTA}?series=${s.id}`);
      const achados = extrairCartas(html);
      for (const { id, alt, carta } of achados) {
        // A arte base ganha da arte alternativa; a alternativa so entra se a carta ainda nao existir.
        if (cartas[id] && !(alt === false && vindoDeAlt.has(id))) continue;
        cartas[id] = carta;
        if (alt) vindoDeAlt.add(id); else vindoDeAlt.delete(id);
      }
      log(`(${i + 1}/${series.length}) ${s.nome.slice(0, 52)} -> ${achados.length} cartas`);
    } catch (err) {
      falhas++;
      log(`(${i + 1}/${series.length}) FALHOU ${s.nome}: ${err.message}`);
    }
    await esperar(400); // educado com o servidor da Bandai
  }

  const total = Object.keys(cartas).length;
  if (total < 1000) throw new Error(`so ${total} cartas coletadas - algo quebrou, nao vou sobrescrever o banco`);

  mkdirSync('data', { recursive: true });
  writeFileSync(
    'data/cartas.json',
    JSON.stringify({ atualizado: new Date().toISOString(), fonte: LISTA, total, cartas }, null, 0)
  );
  log(`PRONTO: ${total} cartas salvas em data/cartas.json (${falhas} colecoes falharam)`);
}

principal().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
