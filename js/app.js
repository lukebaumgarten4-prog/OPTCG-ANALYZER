// Liga tudo: carrega os dados, monta os filtros, troca de aba e redesenha.

import { carregarDados, decksFiltrados, opcoes, estado, ORIGENS } from './dados.js';
import { deckConsenso, metaPorLider } from './analise.js';
import {
  telaMeta, telaCartas, telaConsenso, telaDecks, telaComparar,
  resolverLado, listaEmTexto, esc,
} from './telas.js';

// Estado da interface (o que esta selecionado em cada tela).
const sel = {
  tela: 'meta',
  lider: '',
  busca: '',
  buscaDeck: '',
  deckAberto: null,
  limiteDecks: 100,
  compA: '',
  compB: '',
};

const $ = (s) => document.querySelector(s);
const conteudo = $('#conteudo');
let focoParaRestaurar = null;

/* -------------------- inicio -------------------- */

iniciar();

async function iniciar() {
  try {
    await carregarDados();
  } catch (err) {
    conteudo.innerHTML = `<div class="erro">
      <b>Não consegui carregar os dados.</b><br>${esc(err.message)}<br><br>
      Se você abriu o arquivo dando duplo clique, o navegador bloqueia a leitura dos JSON.
      Rode o <code>INICIAR.bat</code> (ou <code>node serve.js</code>) e acesse http://localhost:8080.
    </div>`;
    $('#status').innerHTML = '<span class="erro">falha ao carregar</span>';
    return;
  }

  montarFiltros();
  montarStatus();
  ligarEventos();
  lerEndereco();      // abre direto na aba que veio no link
  marcarAbaAtiva();
  renderizar();
}

function montarStatus() {
  const quando = new Date(estado.infoDecks.atualizado);
  const dias = (Date.now() - quando.getTime()) / 86400000;
  // Bolinha verde = dado fresco; amarela = a coleta não roda há mais de 3 dias.
  const estadoBolinha = dias > 3 ? 'frio' : '';

  $('#status').innerHTML = `
    <span class="pulso ${estadoBolinha}"></span>
    <span><b>${estado.infoDecks.total.toLocaleString('pt-BR')}</b> decks ·
    <b>${estado.infoCartas.total.toLocaleString('pt-BR')}</b> cartas ·
    coletado ${quando.toLocaleDateString('pt-BR')}</span>`;
  $('#status').title = `Decklists coletadas em ${quando.toLocaleString('pt-BR')}`;
}

/* -------------------- filtros -------------------- */

function montarFiltros() {
  const o = opcoes();

  // O seletor de origem é o controle principal: simulador x torneio x tudo.
  $('#f-origem').innerHTML = ORIGENS.map((x) => `
    <button data-origem="${esc(x.valor)}" class="${estado.filtros.origem === x.valor ? 'ativo' : ''}">
      ${esc(x.rotulo)}<span class="qtd">${o.porOrigem[x.valor]}</span>
    </button>`).join('');

  const encher = (elemento, valores) => {
    elemento.innerHTML = `<option value="">Todas</option>` + valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  };
  encher($('#f-regiao'), o.regioes);

  $('#f-fonte').innerHTML = '<option value="">Ambas</option>'
    + o.fontes.map((f) => `<option value="${esc(f.valor)}">${esc(f.rotulo)} (${f.qtd})</option>`).join('');

  $('#f-torneios').innerHTML = o.torneios
    .map((t) => `<button class="chip" data-torneio="${esc(t.valor)}">${esc(t.valor)}<span class="qtd">${t.qtd}</span></button>`)
    .join('');
}

function lerFiltros() {
  const f = estado.filtros;
  f.regiao = $('#f-regiao').value;
  f.fonte = $('#f-fonte').value;
  f.periodo = Number($('#f-periodo').value);
  f.completos = $('#f-completos').checked;
}

/** Explica em uma linha o que a origem escolhida significa. */
function montarNotaOrigem(decks) {
  const f = estado.filtros;
  const nota = $('#origem-nota');
  const n = decks.length;

  const textos = {
    sim: `Partidas jogadas no <b>OPTCG Sim</b>. O set é novo, então é onde o meta aparece primeiro — mas é gente testando, não resultado de torneio.`,
    torneio: `Resultados de <b>torneio presencial</b>: flagship, regional, championship e loja.`,
    tudo: `Simulador e torneio presencial <b>somados</b>.`,
  };

  const alerta = n < 150
    ? ` <span class="alerta">Com ${n} listas, cada deck vale ${(100 / n).toFixed(1)} ponto no meta share.</span>`
    : '';

  nota.innerHTML = textos[f.origem] + alerta;
}

function ligarEventos() {
  $('#f-origem').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-origem]');
    if (!btn) return;
    estado.filtros.origem = btn.dataset.origem;
    document.querySelectorAll('#f-origem button').forEach((b) => b.classList.toggle('ativo', b === btn));
    sel.deckAberto = null;
    renderizar();
  });

  $('#btn-mais-filtros').addEventListener('click', () => {
    const painel = $('#filtros');
    const aberto = painel.classList.toggle('oculto');
    $('#btn-mais-filtros').textContent = aberto ? 'mais filtros' : 'menos filtros';
  });

  for (const id of ['#f-regiao', '#f-fonte', '#f-periodo', '#f-completos']) {
    $(id).addEventListener('change', () => { lerFiltros(); sel.deckAberto = null; renderizar(); });
  }

  $('#f-torneios').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-torneio]');
    if (!btn) return;
    const valor = btn.dataset.torneio;
    const conj = estado.filtros.torneios;
    if (conj.has(valor)) conj.delete(valor); else conj.add(valor);
    btn.classList.toggle('ativo', conj.has(valor));
    sel.deckAberto = null;
    renderizar();
  });

  $('#btn-limpar').addEventListener('click', () => {
    $('#f-regiao').value = '';
    $('#f-fonte').value = '';
    $('#f-periodo').value = '0';
    $('#f-completos').checked = true;
    estado.filtros.torneios.clear();
    document.querySelectorAll('#f-torneios .chip').forEach((c) => c.classList.remove('ativo'));
    lerFiltros();
    renderizar();
  });

  $('#abas').addEventListener('click', (e) => {
    const btn = e.target.closest('.aba');
    if (!btn) return;
    sel.tela = btn.dataset.tela;
    sel.deckAberto = null;
    marcarAbaAtiva();
    renderizar();
  });

  // Voltar/avançar do navegador e link colado trocam de aba de verdade.
  window.addEventListener('hashchange', () => {
    if (lerEndereco()) { marcarAbaAtiva(); renderizar({ semEndereco: true }); }
  });

  // Tudo que acontece dentro das telas passa por aqui (delegação de eventos,
  // porque o HTML das telas e recriado a cada redesenho).
  conteudo.addEventListener('change', (e) => {
    if (e.target.id === 'sel-lider') { sel.lider = e.target.value; renderizar(); }
    if (e.target.id === 'comp-A') { sel.compA = e.target.value; renderizar(); }
    if (e.target.id === 'comp-B') { sel.compB = e.target.value; renderizar(); }
  });

  conteudo.addEventListener('input', (e) => {
    if (e.target.id === 'busca-carta') { sel.busca = e.target.value.toLowerCase(); focoParaRestaurar = 'busca-carta'; renderizar(); }
    if (e.target.id === 'busca-deck') { sel.buscaDeck = e.target.value; sel.deckAberto = null; focoParaRestaurar = 'busca-deck'; renderizar(); }
  });

  conteudo.addEventListener('click', (e) => {
    const linha = e.target.closest('.linha-deck');
    if (linha) {
      sel.deckAberto = sel.deckAberto === linha.dataset.deck ? null : linha.dataset.deck;
      renderizar();
      return;
    }
    if (e.target.id === 'btn-mais-decks') { sel.limiteDecks += 100; renderizar(); return; }
    if (e.target.id === 'btn-copiar-lista') { copiarConsenso(e.target); return; }

    const copiar = e.target.closest('[data-copiar-deck]');
    if (copiar) {
      const d = estado.decks.find((x) => x.id === copiar.dataset.copiarDeck);
      if (d) copiarTexto(textoDaLista(d.lider, d.cartas), copiar);
    }
  });
}

/* -------------------- endereço (permite compartilhar link) -------------------- */

const TELAS_VALIDAS = ['meta', 'cartas', 'consenso', 'decks', 'comparar'];

/** Lê o #hash e devolve true se ele mudou alguma coisa. */
function lerEndereco() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const tela = p.get('tela');
  const lider = p.get('lider');
  let mudou = false;

  if (tela && TELAS_VALIDAS.includes(tela) && tela !== sel.tela) { sel.tela = tela; mudou = true; }
  if (lider !== null && lider !== sel.lider) { sel.lider = lider; mudou = true; }
  return mudou;
}

function escreverEndereco() {
  const p = new URLSearchParams();
  p.set('tela', sel.tela);
  // O líder só faz sentido nas telas que têm seletor de líder.
  if (sel.lider && (sel.tela === 'cartas' || sel.tela === 'consenso')) p.set('lider', sel.lider);

  const novo = `#${p}`;
  if (novo !== location.hash) history.replaceState(null, '', novo);
}

function marcarAbaAtiva() {
  document.querySelectorAll('.aba').forEach((a) => a.classList.toggle('ativa', a.dataset.tela === sel.tela));
}

/* -------------------- render -------------------- */

function renderizar({ semEndereco = false } = {}) {
  const decks = decksFiltrados();
  if (!semEndereco) escreverEndereco();

  montarNotaOrigem(decks);
  $('#resumo-filtro').innerHTML = `<b>${decks.length.toLocaleString('pt-BR')}</b> de ${estado.decks.length.toLocaleString('pt-BR')} decks`;

  const telas = {
    meta: () => telaMeta(decks),
    cartas: () => telaCartas(decks, sel),
    consenso: () => telaConsenso(decks, sel),
    decks: () => telaDecks(decks, sel),
    comparar: () => telaComparar(decks, sel),
  };

  conteudo.innerHTML = `<div class="tela ativa">${telas[sel.tela]()}</div>`;

  if (focoParaRestaurar) {
    const campo = document.getElementById(focoParaRestaurar);
    if (campo) {
      campo.focus();
      const fim = campo.value.length;
      campo.setSelectionRange(fim, fim);
    }
    focoParaRestaurar = null;
  }
}

/** Texto no formato "4x OP17-031 Yasopp", com o líder na primeira linha. */
function textoDaLista(lider, cartas) {
  const c = estado.cartas[lider];
  const cabecalho = `1x ${lider} ${c ? c.nome : ''} (líder)`.trim();
  return `${cabecalho}\n${listaEmTexto(cartas.map((x) => ({ ...x, nome: (estado.cartas[x.id] || {}).nome || x.id })))}`;
}

function copiarConsenso(botao) {
  const decks = decksFiltrados();
  // Tem que ser exatamente o líder que a tela está mostrando: quando nada foi
  // escolhido, a tela cai no líder mais jogado, não no primeiro deck da lista.
  const ranking = metaPorLider(decks);
  const escolhido = ranking.find((l) => l.lider === sel.lider) || ranking[0];
  if (!escolhido) return;

  const consenso = deckConsenso(escolhido.decks);
  copiarTexto(textoDaLista(escolhido.lider, consenso.cartas), botao);
}

function copiarTexto(texto, botao) {
  const original = botao.textContent;
  const avisar = (msg) => {
    botao.textContent = msg;
    setTimeout(() => { botao.textContent = original; }, 1800);
  };

  const planoB = () => {
    // navigator.clipboard exige https (ou localhost) e pode ser bloqueado.
    // Este jeito antigo funciona em praticamente qualquer navegador.
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    let deu = false;
    try { deu = document.execCommand('copy'); } catch { deu = false; }
    campo.remove();
    avisar(deu ? 'copiado!' : 'não deu para copiar');
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto).then(() => avisar('copiado!'), planoB);
  } else {
    planoB();
  }
}

// Deixa acessível no console do navegador para quem quiser bisbilhotar os dados.
window.optcg = { estado, decksFiltrados, deckConsenso, resolverLado, sel };
