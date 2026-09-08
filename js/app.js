// Liga tudo: carrega os dados, monta os filtros, troca de aba e redesenha.

import { carregarDados, decksFiltrados, opcoes, estado } from './dados.js';
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
  renderizar();
}

function montarStatus() {
  const d = new Date(estado.infoDecks.atualizado);
  $('#status').innerHTML = `
    <div><b>${estado.infoDecks.total}</b> decks · <b>${estado.infoCartas.total}</b> cartas no banco</div>
    <div>dados atualizados em ${d.toLocaleString('pt-BR')}</div>`;
}

/* -------------------- filtros -------------------- */

function montarFiltros() {
  const o = opcoes();

  const encher = (elemento, valores) => {
    elemento.innerHTML = `<option value="">Todos</option>` + valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  };
  encher($('#f-formato'), o.formatos);
  encher($('#f-regiao'), o.regioes);

  $('#f-torneios').innerHTML = o.torneios
    .map((t) => `<button class="chip" data-torneio="${esc(t.valor)}">${esc(t.valor)} <span style="opacity:.6">${t.qtd}</span></button>`)
    .join('');
}

function lerFiltros() {
  const f = estado.filtros;
  f.formato = $('#f-formato').value;
  f.regiao = $('#f-regiao').value;
  f.periodo = Number($('#f-periodo').value);
  f.completos = $('#f-completos').checked;
  f.semSimulador = $('#f-semsim').checked;
}

function ligarEventos() {
  for (const id of ['#f-formato', '#f-regiao', '#f-periodo', '#f-completos', '#f-semsim']) {
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
    $('#f-formato').value = '';
    $('#f-regiao').value = '';
    $('#f-periodo').value = '0';
    $('#f-completos').checked = true;
    $('#f-semsim').checked = true;
    estado.filtros.torneios.clear();
    document.querySelectorAll('#f-torneios .chip').forEach((c) => c.classList.remove('ativo'));
    lerFiltros();
    renderizar();
  });

  $('#abas').addEventListener('click', (e) => {
    const btn = e.target.closest('.aba');
    if (!btn) return;
    document.querySelectorAll('.aba').forEach((a) => a.classList.toggle('ativa', a === btn));
    sel.tela = btn.dataset.tela;
    renderizar();
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
    if (e.target.id === 'btn-copiar-lista') { copiarLista(e.target); }
  });
}

/* -------------------- render -------------------- */

function renderizar() {
  const decks = decksFiltrados();

  $('#resumo-filtro').textContent = `${decks.length} de ${estado.decks.length} decks`;

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

function copiarLista(botao) {
  const decks = decksFiltrados();
  // Tem que ser exatamente o líder que a tela está mostrando: quando nada foi
  // escolhido, a tela cai no líder mais jogado, não no primeiro deck da lista.
  const ranking = metaPorLider(decks);
  const escolhido = ranking.find((l) => l.lider === sel.lider) || ranking[0];
  if (!escolhido) return;

  const consenso = deckConsenso(escolhido.decks);
  const texto = `1x ${escolhido.lider} ${escolhido.nome} (líder)\n${listaEmTexto(consenso.cartas)}`;

  const avisar = (msg) => {
    botao.textContent = msg;
    setTimeout(() => { botao.textContent = 'copiar lista em texto'; }, 1800);
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
