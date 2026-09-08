// Desenho das telas. Cada funcao recebe os decks ja filtrados e devolve HTML.

import { carta } from './dados.js';
import {
  metaPorLider, estatCartas, deckConsenso, perfilDeck,
  compararDecks, evolucao, ROTULO_CATEGORIA,
} from './analise.js';

/* -------------------- ajudantes -------------------- */

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const num = (v, casas = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(casas));
const pct = (v) => `${num(v, 1)}%`;

const CORES = { Red: '--cor-red', Green: '--cor-green', Blue: '--cor-blue', Purple: '--cor-purple', Black: '--cor-black', Yellow: '--cor-yellow' };
export const corCss = (cor) => `var(${CORES[(cor || '').split('/')[0].trim()] || '--texto-fraco'})`;

export function pilulaCor(cor) {
  if (!cor) return '';
  const partes = cor.split('/').map((c) => c.trim()).filter(Boolean);
  return partes.map((c) => `<span class="pilula" style="background:${corCss(c)}22;color:${corCss(c)}">${esc(c)}</span>`).join(' ');
}

function imgCarta(id, classe = '') {
  const c = carta(id);
  if (!c || !c.imagem) return `<div class="${classe}" style="width:32px;height:32px"></div>`;
  // Se a CDN não tiver a arte, some com a imagem em vez de mostrar o ícone de quebrado.
  return `<img class="${classe}" src="${esc(c.imagem)}" alt="" title="${esc(c.nome)}" loading="lazy" onerror="this.style.visibility='hidden'">`;
}

function celulaLider(id) {
  const c = carta(id);
  return `<div class="lider-celula">
    ${imgCarta(id)}
    <div><div class="lider-nome">${esc(c ? c.nome : id)}</div><div class="lider-cod">${esc(id)}</div></div>
  </div>`;
}

const barra = (valor, max, cor) => `<div class="barra-trilha"><div class="barra" style="width:${max ? Math.max(2, (valor / max) * 100) : 0}%;background:${cor || 'var(--destaque)'}"></div></div>`;

const kpi = (valor, rotulo) => `<div class="cartao"><div class="kpi-valor">${valor}</div><div class="kpi-rotulo">${esc(rotulo)}</div></div>`;

const vazio = (msg) => `<div class="cartao vazio">${esc(msg)}</div>`;

export const rotuloDeck = (d) => `${d.data} · ${d.arquetipo || d.lider} · ${d.autor || 'anônimo'} (${d.colocacao || '—'})`;

/* -------------------- TELA: META -------------------- */

export function telaMeta(decks) {
  if (!decks.length) return vazio('Nenhum deck bate com os filtros escolhidos.');

  const linhas = metaPorLider(decks);
  const maxQtd = linhas[0].qtd;
  const datas = decks.map((d) => d.dataIso).filter(Boolean).sort();
  const hosts = new Set(decks.map((d) => d.host).filter(Boolean));

  const evo = evolucao(decks, linhas.slice(0, 6).map((l) => l.lider));

  return `
    <h2 class="titulo">Meta share dos líderes</h2>
    <p class="legenda">Quanto cada líder representa dentro dos ${decks.length} decks que bateram os filtros.
    "Top 4" conta as vezes que o líder terminou em 1º a 4º lugar. O winrate só aparece quando há pelo menos
    20 partidas com placar informado — muita decklist vem sem o placar.</p>

    <div class="grade grade-4">
      ${kpi(decks.length, 'decks analisados')}
      ${kpi(linhas.length, 'líderes diferentes')}
      ${kpi(hosts.size, 'organizadores')}
      ${kpi(datas.length ? `${formatarData(datas[0])} → ${formatarData(datas[datas.length - 1])}` : '—', 'período coberto')}
    </div>

    ${evo.periodos.length > 1 ? `
    <div class="secao">
      <h3>Evolução das 6 principais (share por semana)</h3>
      <div class="cartao">${graficoLinhas(evo)}</div>
    </div>` : ''}

    <div class="secao">
      <h3>Ranking</h3>
      <div class="tabela-caixa">
        <table>
          <thead><tr>
            <th class="num">#</th><th>Líder</th><th>Cor</th>
            <th class="num">Decks</th><th>Share</th>
            <th class="num">Top 4</th><th class="num">1º lugar</th>
            <th class="num">Posição média</th><th class="num">Winrate</th>
            <th>Arquétipo mais comum</th>
          </tr></thead>
          <tbody>
            ${linhas.map((l, i) => `
              <tr>
                <td class="num">${i + 1}</td>
                <td>${celulaLider(l.lider)}</td>
                <td>${pilulaCor(l.cor)}</td>
                <td class="num"><b>${l.qtd}</b></td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    ${barra(l.qtd, maxQtd, corCss(l.cor))}
                    <span style="font-variant-numeric:tabular-nums;font-size:12px">${pct(l.pct)}</span>
                  </div>
                </td>
                <td class="num">${l.top4}</td>
                <td class="num">${l.primeiros}</td>
                <td class="num">${num(l.posMedia, 1)}</td>
                <td class="num">${l.taxaVitoria === null ? '—' : pct(l.taxaVitoria)}</td>
                <td>${esc(l.arquetipoTop)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function graficoLinhas(evo) {
  const L = 60, T = 14, larg = 900, alt = 220;
  const areaL = larg - L - 20, areaA = alt - T - 34;
  const maxY = Math.max(12, ...evo.series.flatMap((s) => s.valores)) * 1.15;
  const x = (i) => L + (evo.periodos.length > 1 ? (i / (evo.periodos.length - 1)) * areaL : areaL / 2);
  const y = (v) => T + areaA - (v / maxY) * areaA;

  const grade = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = maxY * f;
    return `<line x1="${L}" y1="${y(v)}" x2="${L + areaL}" y2="${y(v)}" stroke="var(--borda)" stroke-width="1"/>
            <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" fill="var(--texto-fraco)" font-size="11">${v.toFixed(0)}%</text>`;
  }).join('');

  const linhas = evo.series.map((s) => {
    const d = s.valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const pontos = s.valores.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${corCss(s.cor)}"/>`).join('');
    return `<path d="${d}" fill="none" stroke="${corCss(s.cor)}" stroke-width="2.2" stroke-linejoin="round"/>${pontos}`;
  }).join('');

  const eixoX = evo.periodos.map((p, i) => `<text x="${x(i).toFixed(1)}" y="${alt - 14}" text-anchor="middle" fill="var(--texto-fraco)" font-size="11">${p.rotulo}</text>`).join('');

  const legenda = evo.series.map((s) => `
    <span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-size:12px">
      <span style="width:11px;height:3px;border-radius:2px;background:${corCss(s.cor)}"></span>${esc(s.nome)}
    </span>`).join('');

  return `<svg viewBox="0 0 ${larg} ${alt}" style="width:100%;height:auto" role="img" aria-label="Evolução do meta share por semana">
      ${grade}${linhas}${eixoX}
    </svg>
    <div style="margin-top:10px">${legenda}</div>`;
}

/* -------------------- TELA: CARTAS -------------------- */

export function telaCartas(decks, sel) {
  const porLider = metaPorLider(decks);
  if (!porLider.length) return vazio('Nenhum deck bate com os filtros escolhidos.');

  const escolhido = porLider.find((l) => l.lider === sel.lider) || porLider[0];
  const estat = estatCartas(escolhido.decks).filter((e) => !sel.busca || e.nome.toLowerCase().includes(sel.busca) || e.id.toLowerCase().includes(sel.busca));

  return `
    <h2 class="titulo">Estatística de cartas por líder</h2>
    <p class="legenda">Para cada carta: em quantos % dos decks daquele líder ela aparece, e quantas cópias em média.
    <b>Núcleo</b> = está em 90%+ das listas. <b>Flex</b> = entre 30% e 90%. <b>Tech</b> = menos de 30%, geralmente escolha pessoal ou resposta a um meta específico.</p>

    ${seletorLider(porLider, escolhido.lider)}

    <div class="grade grade-4">
      ${kpi(escolhido.decks.length, 'decks deste líder')}
      ${kpi(estatCartas(escolhido.decks).filter((e) => e.categoria === 'nucleo').length, 'cartas de núcleo')}
      ${kpi(estatCartas(escolhido.decks).filter((e) => e.categoria === 'flex').length, 'cartas flex')}
      ${kpi(estatCartas(escolhido.decks).filter((e) => e.categoria === 'tech').length, 'cartas tech')}
    </div>

    <div class="secao">
      <div class="escolha">
        <div><label for="busca-carta">Procurar carta</label>
        <input type="search" id="busca-carta" placeholder="nome ou código (ex: OP17-031)" value="${esc(sel.busca || '')}"></div>
      </div>
      <div class="tabela-caixa">
        <table>
          <thead><tr>
            <th>Carta</th><th class="num">Custo</th><th>Tipo</th>
            <th class="num">Inclusão</th><th>&nbsp;</th>
            <th class="num">Cópias médias</th>
            <th class="num">1x</th><th class="num">2x</th><th class="num">3x</th><th class="num">4x</th>
            <th>Classe</th>
          </tr></thead>
          <tbody>
            ${estat.length ? estat.map((e) => `
              <tr>
                <td><div class="lider-celula">${imgCarta(e.id)}<div>
                  <div class="lider-nome">${esc(e.nome)}</div><div class="lider-cod">${esc(e.id)}</div>
                </div></div></td>
                <td class="num">${e.custo ?? '—'}</td>
                <td>${esc(traduzirTipo(e.tipo))}</td>
                <td class="num">${pct(e.inclusao)}</td>
                <td>${barra(e.inclusao, 100, corCss(e.cor))}</td>
                <td class="num">${num(e.mediaQuandoJogada, 2)}</td>
                <td class="num">${e.dist[1] || ''}</td><td class="num">${e.dist[2] || ''}</td>
                <td class="num">${e.dist[3] || ''}</td><td class="num">${e.dist[4] || ''}</td>
                <td><span class="selo selo-${e.categoria}">${ROTULO_CATEGORIA[e.categoria]}</span></td>
              </tr>`).join('') : '<tr><td colspan="11" class="vazio">Nenhuma carta com esse nome.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* -------------------- TELA: DECK CONSENSO -------------------- */

export function telaConsenso(decks, sel) {
  const porLider = metaPorLider(decks);
  if (!porLider.length) return vazio('Nenhum deck bate com os filtros escolhidos.');

  const escolhido = porLider.find((l) => l.lider === sel.lider) || porLider[0];
  const consenso = deckConsenso(escolhido.decks);
  const perfil = perfilDeck(consenso.cartas.map((c) => ({ id: c.id, qtd: c.qtd })));

  const grupos = {};
  for (const c of consenso.cartas) {
    const chave = c.custo ?? '—';
    (grupos[chave] = grupos[chave] || []).push(c);
  }

  return `
    <h2 class="titulo">Deck consenso — ${esc(escolhido.nome)}</h2>
    <p class="legenda">Lista de 50 cartas montada a partir dos ${escolhido.decks.length} decks deste líder que passaram nos filtros.
    Cada carta entra com a média de cópias arredondada de um jeito que o total fecha exatamente em 50.
    Não é uma lista "certa" — é o retrato do que a maioria está jogando, e os slots <b>flex</b> são justamente onde as listas discordam.</p>

    ${seletorLider(porLider, escolhido.lider)}

    <div class="grade grade-4">
      ${kpi(consenso.total, 'cartas na lista')}
      ${kpi(num(perfil.custoMedio, 2), 'custo médio')}
      ${kpi(perfil.counterCartas, 'cartas com counter')}
      ${kpi(`${(perfil.counterTotal / 1000).toFixed(0)}k`, 'counter total')}
    </div>

    <div class="secao grade grade-2">
      <div class="cartao">
        <h3 style="margin:0 0 4px;font-size:13px;color:var(--texto-fraco);text-transform:uppercase;letter-spacing:.6px">Curva de custo</h3>
        ${graficoCurva(perfil.curva)}
      </div>
      <div class="cartao">
        <h3 style="margin:0 0 10px;font-size:13px;color:var(--texto-fraco);text-transform:uppercase;letter-spacing:.6px">Composição</h3>
        ${listaSimples(Object.entries(perfil.tipos).map(([k, v]) => [traduzirTipo(k), v]))}
        <div style="height:12px"></div>
        <h3 style="margin:0 0 10px;font-size:13px;color:var(--texto-fraco);text-transform:uppercase;letter-spacing:.6px">Traços mais presentes</h3>
        ${listaSimples(perfil.tracos.slice(0, 6))}
      </div>
    </div>

    <div class="secao">
      <h3>A lista (agrupada por custo)</h3>
      <button class="chip" id="btn-copiar-lista" style="margin-bottom:10px">copiar lista em texto</button>
      <div class="grade grade-2">
        ${Object.keys(grupos).sort((a, b) => (a === '—' ? 99 : +a) - (b === '—' ? 99 : +b)).map((custo) => `
          <div class="cartao">
            <div style="font-size:12px;color:var(--texto-fraco);margin-bottom:8px">
              Custo ${custo} — ${grupos[custo].reduce((s, c) => s + c.qtd, 0)} cartas
            </div>
            <div class="lista-cartas">
              ${grupos[custo].map((c) => `
                <div class="carta-linha">
                  <span class="carta-qtd">${c.qtd}x</span>
                  ${imgCarta(c.id)}
                  <div class="carta-info">
                    <div class="carta-nome">${esc(c.nome)}</div>
                    <div class="carta-meta">${esc(c.id)} · ${esc(traduzirTipo(c.tipo))}${c.counter ? ` · counter ${c.counter}` : ''}</div>
                  </div>
                  <span class="selo selo-${c.categoria}">${ROTULO_CATEGORIA[c.categoria]}</span>
                  <span class="carta-pct">${pct(c.inclusao)}</span>
                </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function graficoCurva(curva) {
  const chaves = Object.keys(curva).map(Number).sort((a, b) => a - b);
  if (!chaves.length) return '<div class="vazio">sem dados de custo</div>';
  const min = Math.min(0, ...chaves), max = Math.max(...chaves);
  const faixa = [];
  for (let i = min; i <= max; i++) faixa.push(i);
  const maior = Math.max(...Object.values(curva));

  return `<div class="curva">
    ${faixa.map((c) => {
      const v = curva[c] || 0;
      return `<div class="curva-col" title="custo ${c}: ${v} cartas">
        <span class="curva-valor">${v || ''}</span>
        <div class="curva-barra" style="height:${maior ? (v / maior) * 100 : 0}%"></div>
        <span class="curva-rotulo">${c}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function listaSimples(pares) {
  if (!pares.length) return '<div class="vazio">—</div>';
  const maior = Math.max(...pares.map((p) => p[1]));
  return pares.map(([k, v]) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13px">
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span>
      ${barra(v, maior)}
      <span style="font-variant-numeric:tabular-nums;min-width:26px;text-align:right">${v}</span>
    </div>`).join('');
}

/* -------------------- TELA: DECKS -------------------- */

export function telaDecks(decks, sel) {
  const busca = (sel.buscaDeck || '').toLowerCase();
  const lista = decks.filter((d) => !busca
    || (d.autor || '').toLowerCase().includes(busca)
    || (d.arquetipo || '').toLowerCase().includes(busca)
    || (d.host || '').toLowerCase().includes(busca)
    || (d.pais || '').toLowerCase().includes(busca));

  const mostrando = lista.slice(0, sel.limiteDecks || 100);

  return `
    <h2 class="titulo">Decks</h2>
    <p class="legenda">Todas as listas que passaram nos filtros. Clique em uma linha para abrir a decklist completa com curva de custo.</p>

    <div class="escolha">
      <div><label for="busca-deck">Procurar</label>
      <input type="search" id="busca-deck" placeholder="autor, arquétipo, loja ou país" value="${esc(sel.buscaDeck || '')}"></div>
    </div>

    <p class="legenda">${lista.length} deck(s) encontrados${lista.length > mostrando.length ? ` — mostrando os ${mostrando.length} primeiros` : ''}.</p>

    <div class="tabela-caixa">
      <table>
        <thead><tr>
          <th>Data</th><th>Líder</th><th>Arquétipo</th><th>Autor</th>
          <th>Colocação</th><th>Torneio</th><th>Organizador</th><th>País</th><th>Formato</th>
        </tr></thead>
        <tbody>
          ${mostrando.map((d) => `
            <tr class="linha-deck" data-deck="${esc(d.id)}" style="cursor:pointer">
              <td>${esc(d.data)}</td>
              <td>${celulaLider(d.lider)}</td>
              <td>${esc(d.arquetipo)}</td>
              <td>${esc(d.autor || '—')}</td>
              <td>${esc(d.colocacao || '—')}</td>
              <td>${esc(d.torneio)}</td>
              <td>${esc(d.host || '—')}</td>
              <td>${esc(d.pais || '—')}</td>
              <td>${esc(d.regiao)} ${esc(d.formato)}</td>
            </tr>
            ${sel.deckAberto === d.id ? `<tr><td colspan="9">${detalheDeck(d)}</td></tr>` : ''}
          `).join('')}
          ${mostrando.length ? '' : '<tr><td colspan="9" class="vazio">Nada encontrado.</td></tr>'}
        </tbody>
      </table>
    </div>
    ${lista.length > mostrando.length ? '<div style="margin-top:12px"><button class="chip" id="btn-mais-decks">mostrar mais 100</button></div>' : ''}`;
}

function detalheDeck(d) {
  const perfil = perfilDeck(d.cartas);
  const cartas = d.cartas
    .map((c) => ({ ...c, ...(carta(c.id) || { nome: c.id, custo: null, tipo: '' }) }))
    .sort((a, b) => (a.custo ?? 99) - (b.custo ?? 99) || a.nome.localeCompare(b.nome));

  return `<div class="grade grade-2" style="padding:10px 0">
    <div class="cartao">
      <div style="font-size:12px;color:var(--texto-fraco);margin-bottom:8px">
        ${d.totalCartas} cartas · custo médio ${num(perfil.custoMedio, 2)} · ${perfil.counterCartas} com counter
      </div>
      ${graficoCurva(perfil.curva)}
      <div style="height:14px"></div>
      ${listaSimples(Object.entries(perfil.tipos).map(([k, v]) => [traduzirTipo(k), v]))}
    </div>
    <div class="cartao">
      <div class="lista-cartas">
        ${cartas.map((c) => `
          <div class="carta-linha">
            <span class="carta-qtd">${c.qtd}x</span>
            ${imgCarta(c.id)}
            <div class="carta-info">
              <div class="carta-nome">${esc(c.nome)}</div>
              <div class="carta-meta">${esc(c.id)}${c.custo !== null ? ` · custo ${c.custo}` : ''}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

/* -------------------- TELA: COMPARAR -------------------- */

export function telaComparar(decks, sel) {
  const porLider = metaPorLider(decks);
  const opcoesDeck = decks.slice(0, 400);

  const lados = ['A', 'B'].map((lado) => {
    const valor = sel[`comp${lado}`] || '';
    return `<div>
      <label for="comp-${lado}">Deck ${lado}</label>
      <select id="comp-${lado}" style="min-width:340px">
        <option value="">— escolha —</option>
        <optgroup label="Deck consenso do líder">
          ${porLider.map((l) => `<option value="C:${esc(l.lider)}" ${valor === `C:${l.lider}` ? 'selected' : ''}>consenso · ${esc(l.nome)} (${l.decks.length} decks)</option>`).join('')}
        </optgroup>
        <optgroup label="Decks individuais">
          ${opcoesDeck.map((d) => `<option value="D:${esc(d.id)}" ${valor === `D:${d.id}` ? 'selected' : ''}>${esc(rotuloDeck(d))}</option>`).join('')}
        </optgroup>
      </select>
    </div>`;
  }).join('');

  const a = resolverLado(sel.compA, decks);
  const b = resolverLado(sel.compB, decks);

  let corpo = '<div class="cartao vazio">Escolha dois decks acima para ver a diferença carta a carta.</div>';

  if (a && b) {
    const dif = compararDecks(a.cartas, b.cartas);
    const pa = perfilDeck(a.cartas);
    const pb = perfilDeck(b.cartas);
    const soA = dif.linhas.filter((l) => l.qb === 0);
    const soB = dif.linhas.filter((l) => l.qa === 0);
    const mudou = dif.linhas.filter((l) => l.qa > 0 && l.qb > 0 && l.dif !== 0);

    corpo = `
      <div class="grade grade-4">
        ${kpi(pct(dif.similaridade), 'similaridade')}
        ${kpi(dif.iguais, 'cartas em comum')}
        ${kpi(soA.length + soB.length, 'cartas exclusivas')}
        ${kpi(`${num(pa.custoMedio, 2)} → ${num(pb.custoMedio, 2)}`, 'custo médio A → B')}
      </div>

      <div class="secao grade grade-2">
        <div class="cartao"><div style="font-size:12px;color:var(--texto-fraco);margin-bottom:6px">Curva — ${esc(a.rotulo)}</div>${graficoCurva(pa.curva)}</div>
        <div class="cartao"><div style="font-size:12px;color:var(--texto-fraco);margin-bottom:6px">Curva — ${esc(b.rotulo)}</div>${graficoCurva(pb.curva)}</div>
      </div>

      <div class="secao grade grade-2">
        ${blocoDif(`Só em A — ${esc(a.rotulo)}`, soA, 'qa', 'menos')}
        ${blocoDif(`Só em B — ${esc(b.rotulo)}`, soB, 'qb', 'mais')}
      </div>

      <div class="secao">
        <h3>Mesma carta, quantidade diferente</h3>
        <div class="cartao">
          ${mudou.length ? `<div class="lista-cartas">${mudou.map((l) => `
            <div class="carta-linha">
              ${imgCarta(l.id)}
              <div class="carta-info">
                <div class="carta-nome">${esc(l.nome)}</div>
                <div class="carta-meta">${esc(l.id)}${l.custo !== null ? ` · custo ${l.custo}` : ''}</div>
              </div>
              <span class="carta-pct">${l.qa}x → ${l.qb}x</span>
              <span class="selo selo-${l.dif > 0 ? 'mais' : 'menos'}">${l.dif > 0 ? '+' : ''}${l.dif}</span>
            </div>`).join('')}</div>` : '<div class="vazio">As cartas em comum estão na mesma quantidade nos dois decks.</div>'}
        </div>
      </div>`;
  }

  return `
    <h2 class="titulo">Comparar decks</h2>
    <p class="legenda">Compare duas listas quaisquer, ou compare uma lista contra o deck consenso do líder dela —
    é o jeito rápido de ver onde um deck se afasta do que a maioria joga.</p>
    <div class="escolha">${lados}</div>
    ${corpo}`;
}

function blocoDif(titulo, linhas, campo, selo) {
  return `<div class="cartao">
    <div style="font-size:12px;color:var(--texto-fraco);margin-bottom:8px">${titulo} — ${linhas.reduce((s, l) => s + l[campo], 0)} cartas</div>
    ${linhas.length ? `<div class="lista-cartas">${linhas.map((l) => `
      <div class="carta-linha">
        <span class="carta-qtd">${l[campo]}x</span>
        ${imgCarta(l.id)}
        <div class="carta-info">
          <div class="carta-nome">${esc(l.nome)}</div>
          <div class="carta-meta">${esc(l.id)}${l.custo !== null ? ` · custo ${l.custo}` : ''}</div>
        </div>
        <span class="selo selo-${selo}"></span>
      </div>`).join('')}</div>` : '<div class="vazio">nenhuma</div>'}
  </div>`;
}

/** "C:OP17-001" = deck consenso do líder;  "D:abc123" = um deck específico. */
export function resolverLado(valor, decks) {
  if (!valor) return null;
  const [tipo, chave] = [valor.slice(0, 1), valor.slice(2)];

  if (tipo === 'D') {
    const d = decks.find((x) => x.id === chave);
    return d ? { cartas: d.cartas, rotulo: rotuloDeck(d) } : null;
  }
  if (tipo === 'C') {
    const doLider = decks.filter((d) => d.lider === chave);
    if (!doLider.length) return null;
    const c = deckConsenso(doLider);
    const nome = carta(chave);
    return { cartas: c.cartas.map((x) => ({ id: x.id, qtd: x.qtd })), rotulo: `consenso ${nome ? nome.nome : chave}` };
  }
  return null;
}

/* -------------------- pedacos reaproveitados -------------------- */

function seletorLider(porLider, atual) {
  return `<div class="escolha">
    <div>
      <label for="sel-lider">Líder</label>
      <select id="sel-lider" style="min-width:300px">
        ${porLider.map((l) => `<option value="${esc(l.lider)}" ${l.lider === atual ? 'selected' : ''}>${esc(l.nome)} — ${l.decks.length} deck(s) · ${pct(l.pct)}</option>`).join('')}
      </select>
    </div>
  </div>`;
}

const TIPOS = { LEADER: 'Líder', CHARACTER: 'Personagem', EVENT: 'Evento', STAGE: 'Palco' };
const traduzirTipo = (t) => TIPOS[t] || t || '—';

function formatarData(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a.slice(2)}`;
}

/** Texto simples da lista, no formato "4x OP17-031 Yasopp" — para copiar. */
export function listaEmTexto(cartas) {
  return cartas.map((c) => `${c.qtd}x ${c.id} ${c.nome}`).join('\n');
}
