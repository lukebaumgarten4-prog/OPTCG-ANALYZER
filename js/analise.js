// Todas as contas do site ficam aqui. Sao funcoes puras: recebem uma lista de
// decks (ja filtrada) e devolvem numeros. Nada de mexer na tela por aqui.

import { carta } from './dados.js';

const media = (nums) => (nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null);

/**
 * Guarda o resultado por array de entrada. Como o decksFiltrados() devolve
 * sempre o mesmo array enquanto os filtros não mudam, trocar de aba ou digitar
 * na busca deixa de refazer as contas pesadas. WeakMap para não segurar
 * memória depois que o array antigo é descartado.
 */
function lembrar(fn) {
  const cache = new WeakMap();
  return (decks, ...resto) => {
    if (resto.length) return fn(decks, ...resto);
    if (cache.has(decks)) return cache.get(decks);
    const r = fn(decks);
    cache.set(decks, r);
    return r;
  };
}

/* ------------------------------------------------------------------ *
 * Meta share: quanto cada lider representa do total de decks que deram top
 * ------------------------------------------------------------------ */
function calcularMetaPorLider(decks) {
  const grupos = new Map();

  for (const d of decks) {
    if (!grupos.has(d.lider)) {
      grupos.set(d.lider, { lider: d.lider, decks: [], arquetipos: new Map() });
    }
    const g = grupos.get(d.lider);
    g.decks.push(d);
    const nome = d.arquetipo || '(sem nome)';
    g.arquetipos.set(nome, (g.arquetipos.get(nome) || 0) + 1);
  }

  const total = decks.length;

  return [...grupos.values()]
    .map((g) => {
      const c = carta(g.lider);
      const posicoes = g.decks.map((d) => d.posicao).filter((p) => p !== null);
      const vitorias = g.decks.reduce((s, d) => s + (d.vitorias || 0), 0);
      const derrotas = g.decks.reduce((s, d) => s + (d.derrotas || 0), 0);
      const partidas = vitorias + derrotas;

      return {
        lider: g.lider,
        nome: c ? c.nome : g.lider,
        cor: c ? c.cor : '',
        cores: c ? c.cores : [],
        imagem: c ? c.imagem : '',
        vida: c ? c.vida : null,
        qtd: g.decks.length,
        pct: total ? (g.decks.length / total) * 100 : 0,
        // "top real": 1o, 2o, 3o ou 4o lugar
        top4: g.decks.filter((d) => d.posicao !== null && d.posicao <= 4).length,
        primeiros: g.decks.filter((d) => d.posicao === 1).length,
        posMedia: media(posicoes),
        vitorias,
        derrotas,
        // so mostramos winrate quando ha amostra suficiente de placares
        taxaVitoria: partidas >= 20 ? (vitorias / partidas) * 100 : null,
        partidas,
        arquetipoTop: [...g.arquetipos.entries()].sort((a, b) => b[1] - a[1])[0][0],
        decks: g.decks,
      };
    })
    .sort((a, b) => b.qtd - a.qtd);
}

/* ------------------------------------------------------------------ *
 * Estatistica de carta dentro de um conjunto de decks
 * ------------------------------------------------------------------ */
function calcularEstatCartas(decks) {
  const n = decks.length;
  const acc = new Map();

  for (const d of decks) {
    for (const { id, qtd } of d.cartas) {
      if (!acc.has(id)) acc.set(id, { id, presenca: 0, copias: 0, dist: [0, 0, 0, 0, 0] });
      const a = acc.get(id);
      a.presenca++;
      a.copias += qtd;
      if (qtd >= 1 && qtd <= 4) a.dist[qtd]++;
    }
  }

  return [...acc.values()]
    .map((a) => {
      const c = carta(a.id);
      return {
        ...a,
        nome: c ? c.nome : a.id,
        tipo: c ? c.tipo : '',
        custo: c ? c.custo : null,
        poder: c ? c.poder : null,
        counter: c ? c.counter : 0,
        cor: c ? c.cor : '',
        imagem: c ? c.imagem : '',
        efeito: c ? c.efeito : '',
        // % dos decks que jogam pelo menos 1 copia
        inclusao: n ? (a.presenca / n) * 100 : 0,
        // media de copias considerando so quem joga a carta
        mediaQuandoJogada: a.presenca ? a.copias / a.presenca : 0,
        // media de copias considerando todos os decks (usada no deck consenso)
        mediaGeral: n ? a.copias / n : 0,
        categoria: classificar(n ? (a.presenca / n) * 100 : 0),
      };
    })
    .sort((a, b) => b.inclusao - a.inclusao || b.mediaGeral - a.mediaGeral);
}

function classificar(inclusao) {
  if (inclusao >= 90) return 'nucleo';
  if (inclusao >= 30) return 'flex';
  return 'tech';
}

export const ROTULO_CATEGORIA = { nucleo: 'núcleo', flex: 'flex', tech: 'tech' };

/* ------------------------------------------------------------------ *
 * Deck consenso: a lista de 50 cartas "media" de um conjunto de decks.
 * Usamos o metodo dos maiores restos: cada carta comeca com a parte
 * inteira da sua media de copias e as vagas que sobram vao para as
 * cartas com a maior fracao pendente. Assim o total fecha em 50.
 * ------------------------------------------------------------------ */
export function deckConsenso(decks, limite = 50) {
  const estat = estatCartas(decks);
  if (!estat.length) return { cartas: [], total: 0 };

  const itens = estat.map((e) => {
    const inteiro = Math.min(4, Math.floor(e.mediaGeral));
    return { ...e, qtd: inteiro, resto: e.mediaGeral - Math.floor(e.mediaGeral) };
  });

  let usadas = itens.reduce((s, i) => s + i.qtd, 0);

  // Sobras vao para quem tem maior fracao pendente (desempate pela inclusao).
  const fila = [...itens]
    .filter((i) => i.qtd < 4)
    .sort((a, b) => b.resto - a.resto || b.inclusao - a.inclusao);

  for (const item of fila) {
    if (usadas >= limite) break;
    item.qtd++;
    usadas++;
  }

  const cartas = itens
    .filter((i) => i.qtd > 0)
    .sort((a, b) => (a.custo ?? 99) - (b.custo ?? 99) || b.qtd - a.qtd || a.nome.localeCompare(b.nome));

  return { cartas, total: usadas, baseDecks: decks.length };
}

/* ------------------------------------------------------------------ *
 * Perfil de um deck: curva de custo, counter, tipos, cores, tracos
 * ------------------------------------------------------------------ */
export function perfilDeck(lista) {
  const curva = {};       // custo -> quantidade de cartas
  const tipos = {};
  const cores = {};
  const tracos = {};
  let counterCartas = 0;
  let counterTotal = 0;
  let totalCartas = 0;
  let somaCusto = 0;
  let comCusto = 0;

  for (const { id, qtd } of lista) {
    const c = carta(id);
    totalCartas += qtd;
    if (!c) continue;

    if (c.custo !== null) {
      const chave = Math.min(c.custo, 10);
      curva[chave] = (curva[chave] || 0) + qtd;
      somaCusto += c.custo * qtd;
      comCusto += qtd;
    }
    tipos[c.tipo] = (tipos[c.tipo] || 0) + qtd;
    for (const cor of c.cores) cores[cor] = (cores[cor] || 0) + qtd;
    for (const t of c.tracos) tracos[t] = (tracos[t] || 0) + qtd;
    if (c.counter && c.counter >= 1000) {
      counterCartas += qtd;
      counterTotal += c.counter * qtd;
    }
  }

  return {
    curva,
    tipos,
    cores,
    tracos: Object.entries(tracos).sort((a, b) => b[1] - a[1]),
    counterCartas,
    counterTotal,
    totalCartas,
    custoMedio: comCusto ? somaCusto / comCusto : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Comparar dois decks carta a carta
 * ------------------------------------------------------------------ */
export function compararDecks(a, b) {
  const mapa = (lista) => new Map(lista.map((c) => [c.id, c.qtd]));
  const ma = mapa(a);
  const mb = mapa(b);
  const ids = new Set([...ma.keys(), ...mb.keys()]);

  const linhas = [];
  let iguais = 0;

  for (const id of ids) {
    const qa = ma.get(id) || 0;
    const qb = mb.get(id) || 0;
    const c = carta(id);
    iguais += Math.min(qa, qb);
    linhas.push({
      id,
      qa,
      qb,
      dif: qb - qa,
      nome: c ? c.nome : id,
      custo: c ? c.custo : null,
      tipo: c ? c.tipo : '',
      imagem: c ? c.imagem : '',
    });
  }

  const totalA = a.reduce((s, c) => s + c.qtd, 0);
  const totalB = b.reduce((s, c) => s + c.qtd, 0);

  linhas.sort((x, y) => Math.abs(y.dif) - Math.abs(x.dif) || (x.custo ?? 99) - (y.custo ?? 99));

  return {
    linhas,
    // similaridade = cartas em comum sobre o tamanho do maior deck
    similaridade: Math.max(totalA, totalB) ? (iguais / Math.max(totalA, totalB)) * 100 : 0,
    iguais,
    totalA,
    totalB,
  };
}

/* ------------------------------------------------------------------ *
 * Evolucao do meta ao longo do tempo (fatias semanais)
 * ------------------------------------------------------------------ */
export function evolucao(decks, lideres, semanas = 8) {
  const comData = decks.filter((d) => d.dataIso);
  if (!comData.length) return { periodos: [], series: [] };

  const datas = comData.map((d) => Date.parse(d.dataIso)).sort((a, b) => a - b);
  const fim = datas[datas.length - 1];
  const SEMANA = 7 * 24 * 3600 * 1000;
  const inicio = fim - (semanas - 1) * SEMANA;

  const periodos = [];
  for (let i = 0; i < semanas; i++) {
    const de = inicio + i * SEMANA;
    periodos.push({ de, ate: de + SEMANA, rotulo: new Date(de).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), total: 0 });
  }

  const contagem = new Map(lideres.map((l) => [l, periodos.map(() => 0)]));

  for (const d of comData) {
    const t = Date.parse(d.dataIso);
    const i = Math.floor((t - inicio) / SEMANA);
    if (i < 0 || i >= semanas) continue;
    periodos[i].total++;
    if (contagem.has(d.lider)) contagem.get(d.lider)[i]++;
  }

  const series = lideres.map((l) => {
    const c = carta(l);
    return {
      lider: l,
      nome: c ? c.nome : l,
      cor: c ? c.cor : '',
      valores: contagem.get(l).map((n, i) => (periodos[i].total ? (n / periodos[i].total) * 100 : 0)),
      brutos: contagem.get(l),
    };
  });

  return { periodos, series };
}

/* As duas contas mais pesadas do site ficam memorizadas por lista de decks. */
export const metaPorLider = lembrar(calcularMetaPorLider);
export const estatCartas = lembrar(calcularEstatCartas);
