// Análises de UMA lista: counter, curvas, buscadores, traços e preço.
// (O analise.js cuida das contas do conjunto: meta share, consenso, comparação.)

import { carta, preco } from './dados.js';

const TAMANHO_DECK = 50;

/* ------------------------------------------------------------------ *
 * Counter
 *
 * O counter "estruturado" da carta vale 1000 ou 2000. Além dele existem
 * os Events de counter, que não têm o campo preenchido mas dão +4000 de
 * poder na batalha — por isso a gente lê o texto do efeito atrás deles.
 * A média é sobre as 50 cartas do deck, não só sobre as que dão counter:
 * é assim que se compara a "densidade de counter" de duas listas.
 * ------------------------------------------------------------------ */
export function eventoCounter4k(c) {
  return !!c && c.tipo === 'EVENT' && /\[Counter\]/i.test(c.efeito) && /\+4000/.test(c.efeito);
}

export function estatCounter(lista) {
  let por1000 = 0;
  let por2000 = 0;
  let eventos4k = 0;
  let soma = 0;
  let totalCartas = 0;

  for (const { id, qtd } of lista) {
    const c = carta(id);
    totalCartas += qtd;
    if (!c) continue;

    if (c.counter === 2000) { por2000 += qtd; soma += 2000 * qtd; }
    else if (c.counter === 1000) { por1000 += qtd; soma += 1000 * qtd; }
    else if (eventoCounter4k(c)) { eventos4k += qtd; soma += 4000 * qtd; }
  }

  return {
    por1000,
    por2000,
    eventos4k,
    cartasComCounter: por1000 + por2000 + eventos4k,
    soma,
    media: totalCartas ? soma / totalCartas : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Curvas
 * ------------------------------------------------------------------ */
export function curvaCusto(lista) {
  const faixas = {};
  for (const { id, qtd } of lista) {
    const c = carta(id);
    if (!c || c.custo === null) continue;
    const chave = Math.min(c.custo, 10);
    faixas[chave] = (faixas[chave] || 0) + qtd;
  }
  return faixas;
}

/** Poder em faixas de mil: 0, 1k, 2k … 9k, 10k+. Cartas sem poder ficam de fora. */
export function curvaPoder(lista) {
  const faixas = {};
  for (const { id, qtd } of lista) {
    const c = carta(id);
    if (!c || c.poder === null) continue;
    const chave = Math.min(Math.floor(c.poder / 1000), 10);
    faixas[chave] = (faixas[chave] || 0) + qtd;
  }
  return faixas;
}

export function contarTracos(lista) {
  const contagem = {};
  for (const { id, qtd } of lista) {
    const c = carta(id);
    if (!c) continue;
    for (const t of c.tracos) contagem[t] = (contagem[t] || 0) + qtd;
  }
  return Object.entries(contagem).sort((a, b) => b[1] - a[1]);
}

export function contarTipos(lista) {
  const contagem = {};
  for (const { id, qtd } of lista) {
    const c = carta(id);
    if (!c) continue;
    contagem[c.tipo] = (contagem[c.tipo] || 0) + qtd;
  }
  return contagem;
}

/* ------------------------------------------------------------------ *
 * Preço
 * ------------------------------------------------------------------ */
export function precoDeck(lista) {
  let total = 0;
  let semPreco = 0;
  for (const { id, qtd } of lista) {
    const p = preco(id);
    if (p && p.menor !== null) total += p.menor * qtd;
    else semPreco += qtd;
  }
  return { total, semPreco };
}

/* ------------------------------------------------------------------ *
 * Buscadores ("searchers")
 *
 * Cartas do tipo "Look at 3 cards from the top of your deck; reveal up to
 * 1 {Big Mom Pirates} type card and add it to your hand". A pergunta útil
 * é: qual a chance de esse efeito achar alguma coisa neste deck?
 *
 * É uma distribuição hipergeométrica. Depois de jogar o buscador sobram 49
 * cartas no deck, e as cartas que ele acerta são as que batem no critério
 * (tirando a própria cópia que foi jogada, se ela mesma bate no critério).
 *
 *   P(achar ao menos 1) = 1 - P(nenhuma das N primeiras servir)
 * ------------------------------------------------------------------ */

const CORES = ['red', 'green', 'blue', 'purple', 'black', 'yellow'];
const TIPOS_CARTA = { character: 'CHARACTER', event: 'EVENT', stage: 'STAGE' };

/**
 * Lê o texto do efeito e devolve {profundidade, criterio} ou null quando
 * não é um buscador ou quando o critério é complicado demais para ler com
 * segurança — nesse caso é melhor não mostrar do que mostrar número errado.
 */
export function lerBuscador(c) {
  if (!c || !c.efeito) return null;

  const m = c.efeito.match(/Look at (\d+) cards? from the top of your deck([\s\S]{0,220})/i);
  if (!m) return null;

  const profundidade = Number(m[1]);
  // Só interessa até o "Then," — o resto é o que fazer com as cartas que sobraram.
  const trecho = m[2].split(/\bThen,/i)[0];

  // Precisa pegar a carta de fato (revelar/jogar/adicionar à mão).
  if (!/\b(reveal|play|add)\s+up\s+to\s+\d+/i.test(trecho)) return null;

  const tracos = [
    ...[...trecho.matchAll(/\{([^}]+)\}/g)].map((x) => x[1].trim()),
    ...[...trecho.matchAll(/type including "([^"]+)"/gi)].map((x) => x[1].trim()),
  ];

  const atributo = (trecho.match(/<([^>]+)>\s*attribute/i) || [])[1];
  const cor = CORES.find((k) => new RegExp(`\\b${k}\\b`, 'i').test(trecho));
  const tipoTexto = Object.keys(TIPOS_CARTA).find((k) => new RegExp(`\\b${k}\\b`, 'i').test(trecho));
  const custoMax = (trecho.match(/cost of (\d+) or less/i) || [])[1];
  const excluidos = [...trecho.matchAll(/other than \[([^\]]+)\]/g)].map((x) => x[1].trim());

  // Sem nenhum critério de verdade seria "qualquer carta serve": não é busca.
  if (!tracos.length && !atributo && !cor && !tipoTexto) return null;

  return {
    profundidade,
    criterio: {
      tracos,
      atributo,
      cor,
      tipo: tipoTexto ? TIPOS_CARTA[tipoTexto] : null,
      custoMax: custoMax ? Number(custoMax) : null,
      excluidos,
    },
  };
}

function combina(c, criterio) {
  if (!c) return false;
  const { tracos, atributo, cor, tipo, custoMax, excluidos } = criterio;

  if (excluidos.some((n) => c.nome === n)) return false;
  if (tipo && c.tipo !== tipo) return false;
  if (custoMax !== null && (c.custo === null || c.custo > custoMax)) return false;
  if (atributo && c.atributo !== atributo) return false;
  if (cor && !c.cores.some((x) => x.toLowerCase() === cor)) return false;
  // Os traços vêm ligados por "ou": basta bater um.
  if (tracos.length && !tracos.some((t) => c.tracos.includes(t))) return false;
  return true;
}

/** P(pelo menos 1 acerto) olhando `n` cartas de um deck de `N` com `K` acertos. */
export function chanceDeAchar(N, K, n) {
  if (K <= 0 || N <= 0) return 0;
  const olhadas = Math.min(n, N);
  let semAcerto = 1;
  for (let i = 0; i < olhadas; i++) {
    const restamRuins = N - K - i;
    if (restamRuins <= 0) return 1;
    semAcerto *= restamRuins / (N - i);
  }
  return 1 - semAcerto;
}

/** Lista os buscadores do deck, cada um com quantas cartas ele acerta e a chance. */
export function buscadores(lista) {
  const achados = [];

  for (const { id, qtd } of lista) {
    const c = carta(id);
    const lido = lerBuscador(c);
    if (!lido) continue;

    // Quantas cartas do deck batem no critério.
    let acertos = 0;
    for (const outra of lista) {
      if (combina(carta(outra.id), lido.criterio)) acertos += outra.qtd;
    }

    // A cópia que foi jogada saiu do deck. Se ela mesma bate no critério,
    // ela também sai da conta de acertos.
    const restam = TAMANHO_DECK - 1;
    if (combina(c, lido.criterio)) acertos -= 1;

    achados.push({
      id,
      qtd,
      nome: c.nome,
      imagem: c.imagem,
      profundidade: lido.profundidade,
      acertos: Math.max(0, acertos),
      chance: chanceDeAchar(restam, Math.max(0, acertos), lido.profundidade) * 100,
      procura: descreverCriterio(lido.criterio),
    });
  }

  return achados.sort((a, b) => b.chance - a.chance || a.nome.localeCompare(b.nome));
}

function descreverCriterio({ tracos, atributo, cor, tipo, custoMax }) {
  const partes = [];
  if (cor) partes.push(cor);
  if (atributo) partes.push(atributo);
  if (tracos.length) partes.push(tracos.join(' ou '));
  if (tipo) partes.push({ CHARACTER: 'Personagem', EVENT: 'Evento', STAGE: 'Palco' }[tipo]);
  if (custoMax !== null) partes.push(`custo ${custoMax} ou menos`);
  return partes.join(' · ') || 'qualquer carta';
}

/* ------------------------------------------------------------------ *
 * Perfil completo, que é o que as telas consomem
 * ------------------------------------------------------------------ */
export function perfilCompleto(lista) {
  let totalCartas = 0;
  let somaCusto = 0;
  let comCusto = 0;

  for (const { id, qtd } of lista) {
    totalCartas += qtd;
    const c = carta(id);
    if (c && c.custo !== null) { somaCusto += c.custo * qtd; comCusto += qtd; }
  }

  return {
    totalCartas,
    custoMedio: comCusto ? somaCusto / comCusto : 0,
    curvaCusto: curvaCusto(lista),
    curvaPoder: curvaPoder(lista),
    counter: estatCounter(lista),
    tipos: contarTipos(lista),
    tracos: contarTracos(lista),
    buscadores: buscadores(lista),
    preco: precoDeck(lista),
  };
}
