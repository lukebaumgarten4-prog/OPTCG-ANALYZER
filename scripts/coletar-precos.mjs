// Le os precos da TCGplayer (pelo espelho publico tcgcsv.com) e salva data/precos.json
//
// O tcgcsv organiza tudo em categoria > grupo (set) > produtos + precos. Cada
// produto de carta traz em extendedData um campo "Number" com o codigo da carta
// ("OP17-028"), que e exatamente a chave que usamos no resto do projeto.
//
// Uma mesma carta costuma existir em varias impressoes (comum, alternativa,
// manga...). Guardamos a MAIS BARATA, porque e o que interessa para saber
// quanto custa montar o deck, e junto o numero de impressoes existentes.
import { writeFileSync, mkdirSync } from 'node:fs';
import { esperar, log, UA } from './lib.mjs';

const BASE = 'https://tcgcsv.com/tcgplayer';
const CATEGORIA = 68; // One Piece Card Game

async function buscarJson(url, { tentativas = 3 } = {}) {
  let ultimoErro;
  for (let i = 1; i <= tentativas; i++) {
    try {
      // Sem User-Agent de navegador o tcgcsv responde 401.
      const resp = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      ultimoErro = err;
      if (i < tentativas) await esperar(1200 * i);
    }
  }
  throw new Error(`falha em ${url}: ${ultimoErro.message}`);
}

const lista = (j) => (Array.isArray(j) ? j : j.results || []);

/** Pega o valor de um campo do extendedData de um produto. */
function campo(produto, nome) {
  const e = (produto.extendedData || []).find((x) => x.name === nome);
  return e ? e.value : '';
}

async function principal() {
  const grupos = lista(await buscarJson(`${BASE}/${CATEGORIA}/groups`));
  log(`${grupos.length} sets no catalogo da TCGplayer`);

  const precos = {};
  let falhas = 0;
  let comPreco = 0;

  for (const [i, g] of grupos.entries()) {
    try {
      const [produtos, tabela] = await Promise.all([
        buscarJson(`${BASE}/${CATEGORIA}/${g.groupId}/products`),
        buscarJson(`${BASE}/${CATEGORIA}/${g.groupId}/prices`),
      ]);

      // productId -> menor preco util daquele produto
      const porProduto = new Map();
      for (const p of lista(tabela)) {
        const valor = p.marketPrice ?? p.midPrice ?? p.lowPrice;
        if (typeof valor !== 'number' || valor <= 0) continue;
        const atual = porProduto.get(p.productId);
        if (atual === undefined || valor < atual) porProduto.set(p.productId, valor);
      }

      for (const produto of lista(produtos)) {
        const codigo = campo(produto, 'Number');
        if (!/^[A-Z]{2,4}\d{2}-\d{2,3}$/.test(codigo)) continue; // ignora booster box, deck etc.

        const valor = porProduto.get(produto.productId);
        const registro = precos[codigo] || { menor: null, impressoes: 0, url: '' };
        registro.impressoes++;

        if (valor !== undefined && (registro.menor === null || valor < registro.menor)) {
          registro.menor = Number(valor.toFixed(2));
          registro.url = produto.url || '';
        }
        precos[codigo] = registro;
      }

      comPreco = Object.values(precos).filter((p) => p.menor !== null).length;
      log(`(${i + 1}/${grupos.length}) ${g.abbreviation || g.name} -> ${Object.keys(precos).length} códigos, ${comPreco} com preço`);
    } catch (err) {
      falhas++;
      log(`(${i + 1}/${grupos.length}) FALHOU ${g.abbreviation || g.name}: ${err.message}`);
    }
    await esperar(250); // educado com o servidor
  }

  const total = Object.keys(precos).length;
  if (comPreco < 500) {
    throw new Error(`so ${comPreco} cartas com preco - algo quebrou, nao vou sobrescrever o arquivo`);
  }

  mkdirSync('data', { recursive: true });
  writeFileSync(
    'data/precos.json',
    JSON.stringify(
      {
        atualizado: new Date().toISOString(),
        moeda: 'USD',
        fonte: 'TCGplayer via tcgcsv.com',
        observacao: 'menor preco de mercado entre todas as impressoes daquele codigo de carta',
        total,
        comPreco,
        precos,
      },
      null,
      0
    )
  );
  log(`PRONTO: ${comPreco} de ${total} códigos com preço em data/precos.json (${falhas} sets falharam)`);
}

principal().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
