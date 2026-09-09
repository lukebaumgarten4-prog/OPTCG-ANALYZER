// Funcoes compartilhadas pelos robos de coleta.
// Node 24 ja tem fetch embutido, entao este projeto nao precisa de nenhum pacote npm.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function buscarHtml(url, { tentativas = 3 } = {}) {
  let ultimoErro;
  for (let i = 1; i <= tentativas; i++) {
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (err) {
      ultimoErro = err;
      if (i < tentativas) await esperar(1500 * i);
    }
  }
  throw new Error(`falha ao buscar ${url}: ${ultimoErro.message}`);
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  '#8211': '-', '#8212': '-', '#8216': "'", '#8217': "'",
  '#8220': '"', '#8221': '"', '#8230': '...', '#039': "'", '#39': "'", '#34': '"',
};

export function decodificar(txt = '') {
  return txt.replace(/&(#?[a-zA-Z0-9]+);/g, (inteiro, cod) => {
    if (ENTIDADES[cod] !== undefined) return ENTIDADES[cod];
    if (/^#x[0-9a-f]+$/i.test(cod)) return String.fromCodePoint(parseInt(cod.slice(2), 16));
    if (/^#\d+$/.test(cod)) return String.fromCodePoint(parseInt(cod.slice(1), 10));
    return inteiro;
  });
}

// Tira as tags HTML mas preserva quebras de linha vindas de <br>.
export function limpar(html = '') {
  return decodificar(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export function primeiro(html, regex) {
  const m = html.match(regex);
  return m ? limpar(m[1]) : '';
}

export function paraNumero(txt) {
  const m = String(txt).replace(/[,\s]/g, '').match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

export function log(...args) {
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);
}

/* ------------------------------------------------------------------ *
 * Normalizacao de tipo de torneio
 *
 * As duas fontes escrevem a mesma coisa de jeitos diferentes: o
 * onepiecetopdecks usa codigos curtos ("FS", "2SB", "3v3 CS", "ExtraCS")
 * e o gumgum escreve por extenso ("Flagship", "Extra Grand Battle",
 * "CS Store Qualifier"). Esta funcao joga os dois no mesmo conjunto de
 * categorias, senao seria impossivel filtrar as duas fontes juntas.
 *
 * A separacao mais importante e tirar partida de simulador do meio,
 * porque ela nao vale como resultado competitivo.
 * ------------------------------------------------------------------ */
export function normalizarTorneio(txt) {
  const k = String(txt || '').trim().toUpperCase();
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
  if (tem('EGB', 'GAO', 'SQ') || /QUALIF|EXGRAND|EXTRA GRAND|AREA/.test(k)) return 'Qualificatoria';
  if (/\d+\s*(?:V|ON)\s*\d+|SIDE/.test(k)) return 'Equipe / Side Event';
  if (/RELEASE|PIRATE|PARTY|GENCON|LIMITEDLEADER|UNOFFICIAL|CASUAL/.test(k)) return 'Evento casual';
  if (/STORE|LOCAL|SHOP|LOJA/.test(k)) return 'Loja';
  return 'Outro';
}

/** Assinatura estavel de um deck, usada para achar a mesma lista nas duas fontes. */
export function assinaturaDeck(lider, cartas) {
  const corpo = [...cartas]
    .map((c) => `${c.qtd}x${c.id}`)
    .sort()
    .join(',');
  return `${lider}|${corpo}`;
}
