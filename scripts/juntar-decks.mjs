// Junta as duas fontes de decklist num unico data/decks.json, que e o arquivo
// que o site le.
//
// Por que existe esta etapa: as duas fontes cobrem o mesmo periodo do formato
// japones, entao a mesma lista costuma aparecer nas duas. Se a gente so
// empilhasse os arquivos, cada resultado repetido contaria em dobro e o meta
// share ficaria mentiroso. Aqui a lista repetida vira um registro so.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { log, assinaturaDeck } from './lib.mjs';

const ARQUIVOS = [
  // A ordem importa: quando a mesma lista aparece nas duas, fica a versao da
  // fonte listada primeiro. O gumgum vem na frente porque traz data em formato
  // ISO, colocacao numerica, numero de participantes e link da fonte.
  { caminho: 'data/fonte-gumgum.json', rotulo: 'gumgum.gg' },
  { caminho: 'data/fonte-topdecks.json', rotulo: 'onepiecetopdecks.com' },
];

const CARTAS = 'data/cartas.json';

// O projeto acompanha so o formato atual. Qualquer coisa fora dele nao entra.
const FORMATO_ALVO = 'OP17';

/** Autores diferentes escrevem o nome de jeitos diferentes; normalizamos para comparar. */
const chaveAutor = (a) => String(a || '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

function carregarFonte({ caminho, rotulo }) {
  if (!existsSync(caminho)) {
    log(`AVISO: ${caminho} nao existe - seguindo sem esta fonte`);
    return null;
  }
  const j = JSON.parse(readFileSync(caminho, 'utf8'));
  if (!Array.isArray(j.decks) || !j.decks.length) {
    log(`AVISO: ${caminho} esta vazio - seguindo sem esta fonte`);
    return null;
  }
  log(`${rotulo}: ${j.decks.length} decks (coletado em ${j.atualizado.slice(0, 16).replace('T', ' ')})`);
  return j;
}

function principal() {
  const fontes = ARQUIVOS.map(carregarFonte).filter(Boolean);
  if (!fontes.length) {
    throw new Error('nenhuma fonte disponivel - rode os robos de coleta primeiro');
  }

  // Cor do lider sai do banco de cartas: o gumgum nao manda esse campo.
  let cartas = {};
  if (existsSync(CARTAS)) cartas = JSON.parse(readFileSync(CARTAS, 'utf8')).cartas || {};

  const porAssinatura = new Map();
  let repetidos = 0;
  let foraDoFormato = 0;

  for (const fonte of fontes) {
    for (const deck of fonte.decks) {
      if (deck.formato !== FORMATO_ALVO) { foraDoFormato++; continue; }
      // Mesmo lider + mesma data + mesmas 50 cartas = com altissima chance o
      // mesmo resultado publicado nas duas fontes.
      const assinatura = `${deck.dataIso || deck.data}|${assinaturaDeck(deck.lider, deck.cartas)}`;
      const existente = porAssinatura.get(assinatura);

      if (existente) {
        const a = chaveAutor(existente.autor);
        const b = chaveAutor(deck.autor);
        // Se os dois trazem autor e sao autores diferentes, sao duas pessoas que
        // jogaram a mesma lista no mesmo dia. Isso acontece em meta consolidado,
        // entao mantemos os dois.
        if (a && b && a !== b) {
          porAssinatura.set(`${assinatura}|${b}`, prepararDeck(deck, cartas));
          continue;
        }
        if (!existente.fontes.includes(deck.fonte)) existente.fontes.push(deck.fonte);
        repetidos++;
        continue;
      }

      porAssinatura.set(assinatura, prepararDeck(deck, cartas));
    }
  }

  const decks = [...porAssinatura.values()]
    .sort((a, b) => (b.dataIso || '').localeCompare(a.dataIso || ''));

  if (foraDoFormato) log(`${foraDoFormato} decks de outros formatos descartados (o alvo e ${FORMATO_ALVO})`);

  const resumo = {};
  for (const d of decks) for (const f of d.fontes) resumo[f] = (resumo[f] || 0) + 1;

  mkdirSync('data', { recursive: true });
  writeFileSync(
    'data/decks.json',
    JSON.stringify(
      {
        atualizado: new Date().toISOString(),
        formato: FORMATO_ALVO,
        total: decks.length,
        repetidosUnificados: repetidos,
        simulador: decks.filter((d) => d.simulador).length,
        porFonte: resumo,
        fontes: fontes.flatMap((f) => f.fontes || []),
        decks,
      },
      null,
      0
    )
  );

  log(`PRONTO: ${decks.length} decks em data/decks.json`);
  log(`${repetidos} listas apareciam nas duas fontes e viraram um registro so`);
  log(`por fonte: ${Object.entries(resumo).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
}

function prepararDeck(deck, cartas) {
  const lider = cartas[deck.lider];
  return {
    ...deck,
    cor: deck.cor || (lider ? lider.cor : ''),
    // Partida de simulador (OPTCG Sim) x resultado de torneio presencial.
    // A fonte escreve isso de vários jeitos: "sim", "optcgsim", "OP16+ST sim".
    simulador: deck.torneio === 'Simulador',
    // Vira lista porque um mesmo deck pode ter vindo das duas fontes.
    fontes: [deck.fonte],
  };
}

try {
  principal();
} catch (err) {
  console.error('ERRO:', err.message);
  process.exit(1);
}
