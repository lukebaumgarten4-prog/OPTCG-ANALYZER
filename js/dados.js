// Carrega o "banco de dados" (os dois arquivos JSON da pasta data/) e guarda
// o estado dos filtros que valem para o site inteiro.

export const estado = {
  cartas: {},
  decks: [],
  infoDecks: null,
  infoCartas: null,
  filtros: {
    formato: '',
    regiao: '',
    torneios: new Set(),   // vazio = todos
    periodo: 0,            // em dias; 0 = tudo
    completos: true,
    semSimulador: true,
  },
};

export async function carregarDados() {
  const [cartas, decks] = await Promise.all([
    buscarJson('data/cartas.json'),
    buscarJson('data/decks.json'),
  ]);

  estado.cartas = cartas.cartas;
  estado.infoCartas = { atualizado: cartas.atualizado, total: cartas.total };
  estado.decks = decks.decks;
  estado.infoDecks = { atualizado: decks.atualizado, total: decks.total, fontes: decks.fontes };

  return estado;
}

async function buscarJson(caminho) {
  const resp = await fetch(caminho, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`não consegui ler ${caminho} (HTTP ${resp.status})`);
  return resp.json();
}

export const carta = (id) => estado.cartas[id] || null;

export const nomeCarta = (id) => {
  const c = estado.cartas[id];
  return c ? c.nome : id;
};

/** Lista de decks depois de aplicar a barra de filtros. */
export function decksFiltrados() {
  const f = estado.filtros;
  let limite = null;
  if (f.periodo > 0) {
    const maisRecente = estado.decks.reduce((max, d) => (d.dataIso && d.dataIso > max ? d.dataIso : max), '');
    if (maisRecente) limite = new Date(Date.parse(maisRecente) - f.periodo * 86400000).toISOString().slice(0, 10);
  }

  return estado.decks.filter((d) => {
    if (f.formato && d.formato !== f.formato) return false;
    if (f.regiao && d.regiao !== f.regiao) return false;
    if (f.completos && !d.completo) return false;
    if (f.semSimulador && d.torneio === 'Simulador') return false;
    if (f.torneios.size && !f.torneios.has(d.torneio)) return false;
    if (limite && (!d.dataIso || d.dataIso < limite)) return false;
    return true;
  });
}

/** Valores distintos existentes na base, para montar os seletores. */
export function opcoes() {
  const unicos = (fn) => [...new Set(estado.decks.map(fn).filter(Boolean))];
  return {
    formatos: unicos((d) => d.formato).sort().reverse(),
    regioes: unicos((d) => d.regiao).sort(),
    torneios: contarPor((d) => d.torneio),
  };
}

function contarPor(fn) {
  const c = new Map();
  for (const d of estado.decks) c.set(fn(d), (c.get(fn(d)) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([valor, qtd]) => ({ valor, qtd }));
}
