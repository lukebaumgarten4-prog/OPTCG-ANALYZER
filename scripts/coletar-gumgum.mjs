// Le as decklists do gumgum.gg e salva data/fonte-gumgum.json
//
// Como funciona: o gumgum.gg é feito em Next.js e entrega a página já com os
// dados dentro do HTML, em pedaços `self.__next_f.push([1,"..."])`. Juntando
// esses pedaços aparece um JSON com todas as listas — mais rico que o do
// onepiecetopdecks: data em formato ISO, colocação como número, quantidade de
// participantes, link da fonte e um índice de "spice" (o quanto a lista foge
// do padrão).
//
// A API deles (/api/decklists) existe mas responde 403 até para o próprio site,
// então lemos o que a página pública já entrega. Uma requisição só traz tudo.
//
// Este arquivo NAO e o que o site le: o juntar-decks.mjs combina esta fonte
// com a do onepiecetopdecks e gera o data/decks.json final.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buscarHtml, log, normalizarTorneio } from './lib.mjs';

const FONTE = 'gumgum';
const PAGINA = 'https://gumgum.gg/';

/** Remonta a carga do Next.js a partir dos pedaços espalhados no HTML. */
function cargaNext(html) {
  let texto = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[\d+,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g)) {
    try {
      texto += JSON.parse(m[1]);
    } catch {
      // Pedaço truncado ou que não é string: ignora e segue.
    }
  }
  return texto;
}

/**
 * Varre a carga procurando objetos JSON completos de decklist.
 * Não dá para usar regex sozinha porque os objetos têm aspas dentro de aspas,
 * então achamos o começo com regex e fechamos contando chaves.
 */
function extrairObjetos(carga) {
  const achados = [];
  const vistos = new Set();

  for (const m of carga.matchAll(/\{"id":"[0-9a-f-]{36}"/g)) {
    const ini = m.index;
    let nivel = 0;
    let fim = -1;
    let dentroTexto = false;
    let escape = false;

    for (let i = ini; i < carga.length && i < ini + 8000; i++) {
      const c = carga[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { dentroTexto = !dentroTexto; continue; }
      if (dentroTexto) continue;
      if (c === '{') nivel++;
      else if (c === '}') { nivel--; if (nivel === 0) { fim = i + 1; break; } }
    }
    if (fim === -1) continue;

    try {
      const o = JSON.parse(carga.slice(ini, fim));
      if (o.leader_id && o.decklist && !vistos.has(o.id)) {
        vistos.add(o.id);
        achados.push(o);
      }
    } catch {
      // Não era um deck; segue.
    }
  }
  return achados;
}

/** "4xOP17-054;2xEB02-030" -> [{id, qtd}] */
function lerComposicao(txt) {
  const cartas = [];
  for (const m of String(txt).matchAll(/(\d+)x([A-Z]{2,4}\d{2}-\d{2,3})/g)) {
    cartas.push({ id: m[2], qtd: Number(m[1]) });
  }
  return cartas;
}

/** "5-0" -> {vitorias: 5, derrotas: 0} */
function lerPlacar(score) {
  const m = String(score || '').match(/(\d+)\s*-\s*(\d+)/);
  return m ? { vitorias: Number(m[1]), derrotas: Number(m[2]) } : { vitorias: null, derrotas: null };
}

/** "1" -> "1º lugar";  "T8" -> "Top 8" */
function textoColocacao(bruto, posicao) {
  const t = String(bruto || '').trim();
  if (/^\d+$/.test(t)) return `${t}º lugar`;
  if (t) return t;
  return posicao ? `${posicao}º lugar` : '';
}

/** O gumgum manda "GU Luffy" / "U Rocks.D.Xebec": a sigla da frente e a cor. */
function limparNomeLider(nome) {
  return String(nome || '').replace(/^[A-Z]{1,3}\s+/, '').trim();
}

function converter(o) {
  const cartas = lerComposicao(o.decklist);
  if (!cartas.length) return null;

  const totalCartas = cartas.reduce((s, c) => s + c.qtd, 0);
  const posicao = Number.isFinite(o.placement) ? o.placement : null;
  const placar = lerPlacar(o.score);
  const dataIso = /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : null;

  const deck = {
    fonte: FONTE,
    formato: String(o.set || '').toUpperCase(),
    // O gumgum chama de East/West; nossa base usa JP/EN, que é o mesmo corte.
    regiao: String(o.region || '').toLowerCase() === 'east' ? 'JP' : 'EN',
    lider: o.leader_id,
    cor: '',                       // vem do banco de cartas, não da fonte
    arquetipo: limparNomeLider(o.leader_name),
    perfil: '',
    data: dataIso ? dataIso.split('-').reverse().join('/') : String(o.date || ''),
    dataIso,
    pais: o.country || '',
    autor: o.author && o.author !== 'unknown' ? o.author : '',
    colocacao: textoColocacao(o.placement_text, posicao),
    posicao,
    ...placar,
    torneio: normalizarTorneio(o.tournament_type),
    torneioBruto: o.tournament_type || '',
    host: o.event_name || '',
    evento: o.event_name || '',
    participantes: Number.isFinite(o.participants) ? o.participants : null,
    link: o.src || '',
    // Exclusivo do gumgum: o quanto a lista foge do consenso (0 a 100).
    spice: Number.isFinite(o.spice) ? o.spice : null,
    cartas,
    totalCartas,
    completo: totalCartas === 50,
  };

  deck.id = createHash('sha1')
    .update([FONTE, o.id].join('|'))
    .digest('hex')
    .slice(0, 12);

  return deck;
}

async function principal() {
  log(`Lendo ${PAGINA}`);
  const html = await buscarHtml(PAGINA);
  const carga = cargaNext(html);

  if (carga.length < 10000) {
    throw new Error('a carga do Next.js veio vazia - o site deve ter mudado de formato');
  }

  const brutos = extrairObjetos(carga);
  log(`${brutos.length} decklists encontradas na página`);

  const decks = [];
  let ignorados = 0;
  for (const o of brutos) {
    const d = converter(o);
    if (d) decks.push(d); else ignorados++;
  }

  if (decks.length < 50) {
    throw new Error(`so ${decks.length} decks extraidos - algo quebrou, nao vou sobrescrever o arquivo`);
  }

  decks.sort((a, b) => (b.dataIso || '').localeCompare(a.dataIso || ''));

  const porFormato = {};
  for (const d of decks) porFormato[d.formato] = (porFormato[d.formato] || 0) + 1;

  mkdirSync('data', { recursive: true });
  writeFileSync(
    'data/fonte-gumgum.json',
    JSON.stringify(
      {
        fonte: FONTE,
        atualizado: new Date().toISOString(),
        total: decks.length,
        fontes: [{ url: PAGINA, rotulo: 'gumgum.gg (home)', decks: decks.length, ignorados, ok: true }],
        decks,
      },
      null,
      0
    )
  );

  const resumo = Object.entries(porFormato).map(([f, n]) => `${f}: ${n}`).join(', ');
  log(`PRONTO: ${decks.length} decks salvos em data/fonte-gumgum.json (${resumo})`);
  log('Rode o juntar-decks.mjs para gerar o data/decks.json que o site le.');
}

principal().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
