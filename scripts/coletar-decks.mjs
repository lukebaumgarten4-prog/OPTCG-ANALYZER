// Le as paginas de decklist do onepiecetopdecks.com e salva data/decks.json
// As paginas ficam em scripts/sources.json
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buscarHtml, limpar, esperar, log } from './lib.mjs';

const CONFIG = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'));

// "Deck Composition" -> "1nOP14-020a4nOP07-022a..." = quantidade + "n" + codigo da carta
function lerComposicao(txt) {
  const cartas = [];
  for (const m of txt.matchAll(/(\d+)n([A-Z]{2,4}\d{2}-\d{2,3})/g)) {
    cartas.push({ id: m[2], qtd: Number(m[1]) });
  }
  return cartas;
}

// "2nd Place(11-2)", "T4(8-1)Swiss", "T8", "9th(8-1)Swiss" -> numero + campanha
function lerColocacao(txt) {
  const t = txt.replace(/\s+/g, ' ').trim();
  let posicao = null;
  const top = t.match(/\bT(?:op)?\s*(\d+)\b/i);
  const ordinal = t.match(/\b(\d+)\s*(?:st|nd|rd|th)\b/i);
  if (ordinal) posicao = Number(ordinal[1]);
  else if (top) posicao = Number(top[1]);
  const placar = t.match(/\((\d+)\s*-\s*(\d+)\)/);
  return {
    colocacao: t,
    posicao,
    vitorias: placar ? Number(placar[1]) : null,
    derrotas: placar ? Number(placar[2]) : null,
  };
}

function lerData(txt) {
  const m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return { data: txt.trim(), iso: null };
  const [, mes, dia, ano] = m;
  const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return { data: txt.trim(), iso: Number.isNaN(Date.parse(iso)) ? null : iso };
}

// Os nomes de torneio vem soltos no site ("FS", "2SB", "3v3 CS", "ExtraCS"...).
// Agrupamos em categorias uteis - o principal e separar torneio de verdade
// de partida jogada em simulador, que nao vale como resultado competitivo.
function lerTorneio(txt) {
  const k = txt.trim().toUpperCase();
  if (!k) return 'Nao informado';
  // "FS+EGB" -> ["FS","EGB"];  "2SB" -> ["SB"]
  const codigos = k.split(/[^A-Z0-9]+/).filter(Boolean).map((t) => t.replace(/^\d+/, ''));
  const tem = (...lista) => codigos.some((c) => lista.includes(c));

  if (/SIM$|SIMULATOR|OPTCGSIM|PROXY/.test(k)) return 'Simulador';
  if (tem('CS') || /CHAMPIONSHIP|WORLD|FINAL|LCQ|CS$/.test(k)) return 'Championship / Final';
  if (/REGIONAL/.test(k)) return 'Regional';
  if (tem('TC') || /TREASURE/.test(k)) return 'Treasure Cup';
  if (tem('FS') || /FLAGSHIP|FLAME/.test(k)) return 'Flagship';
  if (tem('SB') || /STANDARD/.test(k)) return 'Standard Battle';
  if (tem('EGB', 'GAO') || /QUALIF|EXGRAND|AREA/.test(k)) return 'Qualificatoria';
  if (/\d+V\d+|SIDE/.test(k)) return 'Equipe / Side Event';
  if (/RELEASE|PIRATE|PARTY|GENCON|LIMITEDLEADER/.test(k)) return 'Evento casual';
  if (/STORE|LOCAL|SHOP|LOJA/.test(k)) return 'Loja';
  return 'Outro';
}

function celulas(linhaHtml) {
  return [...linhaHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1]);
}

function extrairTabela(html) {
  const inicio = html.indexOf('<table');
  if (inicio === -1) return null;
  const fim = html.indexOf('</table>', inicio);
  const tabela = html.slice(inicio, fim === -1 ? undefined : fim);

  const linhas = [...tabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  if (!linhas.length) return null;

  const cabecalho = celulas(linhas[0]).map((c) => limpar(c).toLowerCase());
  const col = (nome) => cabecalho.findIndex((h) => h.includes(nome));
  const idx = {
    composicao: col('composition'),
    cor: col('color'),
    perfil: col('profile'),
    nome: col('deck name'),
    data: col('date'),
    pais: col('country'),
    autor: col('author'),
    colocacao: col('placement'),
    torneio: col('tournament'),
    host: col('host'),
  };
  // Algumas paginas deixam o cabecalho da 1a coluna vazio. Nesse caso descobrimos
  // qual coluna guarda o deck olhando o conteudo da primeira linha de dados.
  if (idx.composicao === -1) {
    const amostra = linhas[1] ? celulas(linhas[1]) : [];
    idx.composicao = amostra.findIndex((c) => /\d+n[A-Z]{2,4}\d{2}-\d{2,3}/.test(limpar(c)));
  }
  if (idx.composicao === -1) return null;
  return { linhas: linhas.slice(1), idx };
}

function processarPagina(html, fonte) {
  const tabela = extrairTabela(html);
  if (!tabela) throw new Error('nao encontrei a tabela de decks nesta pagina');

  const decks = [];
  let ignorados = 0;

  for (const linha of tabela.linhas) {
    const cs = celulas(linha);
    const pega = (i) => (i >= 0 && cs[i] !== undefined ? limpar(cs[i]) : '');

    const cartas = lerComposicao(pega(tabela.idx.composicao));
    if (cartas.length < 5) { ignorados++; continue; }

    const lider = cartas[0];
    const principal = cartas.slice(1);
    const totalCartas = principal.reduce((s, c) => s + c.qtd, 0);
    const { data, iso } = lerData(pega(tabela.idx.data));
    const colocacao = lerColocacao(pega(tabela.idx.colocacao));
    const torneioBruto = pega(tabela.idx.torneio);

    const deck = {
      formato: fonte.formato,
      regiao: fonte.regiao,
      lider: lider.id,
      cor: pega(tabela.idx.cor),
      arquetipo: pega(tabela.idx.nome) || pega(tabela.idx.perfil),
      perfil: pega(tabela.idx.perfil),
      data,
      dataIso: iso,
      pais: pega(tabela.idx.pais),
      autor: pega(tabela.idx.autor),
      ...colocacao,
      torneio: lerTorneio(torneioBruto),
      torneioBruto,
      host: pega(tabela.idx.host),
      cartas: principal,
      totalCartas,
      completo: totalCartas === 50,
    };
    deck.id = createHash('sha1')
      .update([deck.lider, deck.autor, deck.data, deck.host, principal.map((c) => c.qtd + c.id).join('')].join('|'))
      .digest('hex')
      .slice(0, 12);

    decks.push(deck);
  }
  return { decks, ignorados };
}

async function principal() {
  const todos = [];
  const relatorio = [];

  for (const fonte of CONFIG.paginas) {
    try {
      const html = await buscarHtml(fonte.url);
      const { decks, ignorados } = processarPagina(html, fonte);
      todos.push(...decks);
      relatorio.push({ ...fonte, decks: decks.length, ignorados, ok: true });
      log(`${fonte.rotulo} -> ${decks.length} decks (${ignorados} linhas ignoradas)`);
    } catch (err) {
      relatorio.push({ ...fonte, decks: 0, ok: false, erro: err.message });
      log(`${fonte.rotulo} -> FALHOU: ${err.message}`);
    }
    await esperar(800);
  }

  // Dedupe: o mesmo deck pode aparecer em mais de uma pagina.
  const unicos = new Map();
  for (const d of todos) if (!unicos.has(d.id)) unicos.set(d.id, d);
  const decks = [...unicos.values()].sort((a, b) => (b.dataIso || '').localeCompare(a.dataIso || ''));

  if (!decks.length) throw new Error('nenhum deck coletado - nao vou sobrescrever o banco');

  mkdirSync('data', { recursive: true });
  writeFileSync(
    'data/decks.json',
    JSON.stringify({ atualizado: new Date().toISOString(), total: decks.length, fontes: relatorio, decks }, null, 0)
  );
  log(`PRONTO: ${decks.length} decks unicos salvos em data/decks.json (${todos.length - decks.length} duplicados removidos)`);
}

principal().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
