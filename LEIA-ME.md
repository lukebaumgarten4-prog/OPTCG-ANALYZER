# OPTCG Analyzer

Site que lê as decklists que deram top no [onepiecetopdecks.com](https://onepiecetopdecks.com/deck-list/)
e transforma isso em análise: meta share dos líderes, taxa de inclusão de cada carta,
deck consenso e comparador de listas.

---

## Rodar no seu PC

Dê dois cliques no **`INICIAR.bat`**. Ele abre o navegador em `http://localhost:8080`.

> Não adianta abrir o `index.html` com dois cliques: o navegador bloqueia a leitura
> dos arquivos de dados quando a página vem do disco em vez de um endereço `http://`.

Se preferir o terminal:

```bash
node serve.js
```

## Atualizar os dados na mão

```bash
npm run atualizar
```

Isso roda os dois robôs. Cada um leva cerca de um minuto:

| Comando | O que faz |
|---|---|
| `npm run atualizar-cartas` | Baixa nome, custo, poder, counter, cor e traços de todas as cartas, da lista oficial da Bandai |
| `npm run atualizar-decks` | Lê as páginas de decklist do onepiecetopdecks.com e monta o `data/decks.json` |

## Acompanhar mais sets

Abra **`scripts/sources.json`**, copie um dos blocos e troque a URL, o formato e o rótulo.
As URLs saem da [página de decklists](https://onepiecetopdecks.com/deck-list/). Depois rode
`npm run atualizar-decks`. Nada mais precisa ser mexido — o site se adapta sozinho.

---

## Como isto está montado

```
optcg-analyzer/
├── data/                 <- o "banco de dados": dois arquivos JSON
│   ├── cartas.json          todas as cartas com custo, poder, counter, traços…
│   └── decks.json           todas as decklists coletadas, já normalizadas
├── scripts/              <- os robôs que enchem o data/
│   ├── sources.json         quais páginas acompanhar (o único arquivo de config)
│   ├── coletar-cartas.mjs
│   ├── coletar-decks.mjs
│   └── lib.mjs
├── js/                   <- o site
│   ├── dados.js             carrega os JSON e guarda os filtros
│   ├── analise.js           todas as contas (meta share, consenso, comparação)
│   ├── telas.js             desenha cada aba
│   └── app.js               liga tudo
├── css/estilo.css
├── index.html
├── serve.js              <- servidor local
└── .github/workflows/    <- a automação que atualiza os dados sozinha
```

O projeto **não usa nenhum pacote npm**. É só Node puro e JavaScript de navegador,
então não existe `npm install` nem pasta `node_modules`.

### De onde vem cada dado

- **Decklists**: as páginas do onepiecetopdecks.com trazem uma tabela onde cada deck vem
  codificado como `1nOP14-020a4nOP07-022a...` — quantidade + código da carta. O robô
  decodifica isso e junta com colocação, torneio, autor, país e data.
- **Cartas**: a lista oficial da Bandai. Ela bloqueia hotlink de imagem, então as artes
  exibidas no site vêm da CDN da dotgg; a URL oficial fica guardada no JSON como referência.

---

## Sobre as análises

**Meta share** — quanto cada líder representa do total de decks filtrados. O winrate só
aparece quando há pelo menos 20 partidas com placar informado, porque muita decklist vem
sem o placar e uma amostra pequena mentiria.

**Estatística de cartas** — para cada carta, em quantos % das listas daquele líder ela
aparece e quantas cópias em média. As cartas ficam classificadas em **núcleo** (90%+ das
listas), **flex** (entre 30% e 90%) e **tech** (menos de 30%).

**Deck consenso** — a lista de 50 cartas "média" de um líder. Cada carta entra com a parte
inteira da sua média de cópias, e as vagas que sobram vão para as cartas com a maior fração
pendente, então o total fecha exatamente em 50. Não é a lista "certa" — é o retrato do que a
maioria joga, e os slots flex são justamente onde as listas discordam.

**Comparar** — diferença carta a carta entre dois decks, ou entre um deck e o consenso do
líder dele. É o jeito rápido de ver onde uma lista se afasta do padrão.

### Duas coisas para não se enganar

- Cerca de 13% das listas publicadas vêm incompletas (menos de 50 cartas). O filtro
  **"Só decks com 50 cartas"** já vem ligado por isso.
- Partidas de simulador aparecem misturadas com torneio de verdade na fonte. O filtro
  **"Excluir simulador"** também já vem ligado.

---

Dados de decklist: [onepiecetopdecks.com](https://onepiecetopdecks.com/).
Dados de carta: [lista oficial da Bandai](https://en.onepiece-cardgame.com/cardlist/).
Projeto de fã, sem vínculo com a Bandai ou a Toei.
