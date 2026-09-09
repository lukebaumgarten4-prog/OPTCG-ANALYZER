# OPTCG Analyzer

Site que lê as decklists que deram top no [gumgum.gg](https://gumgum.gg/) e no
[onepiecetopdecks.com](https://onepiecetopdecks.com/deck-list/) e transforma isso em análise:
meta share dos líderes, taxa de inclusão de cada carta, deck consenso e comparador de listas.

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

Isso roda os quatro passos em sequência (uns 2 minutos no total):

| Comando | O que faz |
|---|---|
| `npm run atualizar-cartas` | Baixa nome, custo, poder, counter, cor e traços de todas as cartas, da lista oficial da Bandai |
| `npm run atualizar-gumgum` | Lê as decklists do gumgum.gg |
| `npm run atualizar-topdecks` | Lê as páginas de decklist do onepiecetopdecks.com |
| `npm run juntar` | Junta as duas fontes de decklist no `data/decks.json`, que é o arquivo que o site lê |

Os três primeiros salvam arquivos separados (`data/cartas.json`, `data/fonte-gumgum.json`,
`data/fonte-topdecks.json`). Só o `juntar` produz o `data/decks.json`. Se um dos sites cair,
os outros seguem atualizando e a junção reaproveita o último arquivo bom da fonte que falhou.

## Acompanhar mais sets

Isso vale só para o onepiecetopdecks: abra **`scripts/sources.json`**, copie um dos blocos e
troque a URL, o formato e o rótulo. As URLs saem da
[página de decklists](https://onepiecetopdecks.com/deck-list/). Depois rode
`npm run atualizar-topdecks && npm run juntar`.

O gumgum.gg não precisa de configuração: ele publica os formatos atuais na página inicial e o
robô pega o que estiver lá.

---

## Como isto está montado

```
optcg-analyzer/
├── data/                       <- o "banco de dados"
│   ├── cartas.json                todas as cartas com custo, poder, counter, traços…
│   ├── fonte-gumgum.json          coleta crua do gumgum.gg
│   ├── fonte-topdecks.json        coleta crua do onepiecetopdecks.com
│   └── decks.json                 as duas fontes juntas e sem repetição  <- o site lê este
├── scripts/                    <- os robôs
│   ├── sources.json               páginas do onepiecetopdecks a acompanhar
│   ├── coletar-cartas.mjs
│   ├── coletar-gumgum.mjs
│   ├── coletar-decks.mjs
│   ├── juntar-decks.mjs
│   └── lib.mjs                    funções compartilhadas pelos robôs
├── js/                         <- o site
│   ├── dados.js                   carrega os JSON e guarda os filtros
│   ├── analise.js                 todas as contas (meta share, consenso, comparação)
│   ├── telas.js                   desenha cada aba
│   └── app.js                     liga tudo
├── css/estilo.css
├── index.html
├── serve.js                    <- servidor local
└── .github/workflows/          <- a automação que atualiza os dados sozinha
```

O projeto **não usa nenhum pacote npm**. É só Node puro e JavaScript de navegador,
então não existe `npm install` nem pasta `node_modules`.

### De onde vem cada dado

- **gumgum.gg** — o site é feito em Next.js e entrega a página já com os dados dentro do HTML,
  em pedaços `self.__next_f.push(...)`. Juntando esses pedaços aparece o JSON das listas. É a
  fonte mais rica: traz data em formato ISO, colocação como número, quantidade de participantes,
  link para a publicação original e um índice de *spice* (o quanto a lista foge do consenso).
  A API deles (`/api/decklists`) existe mas responde 403 até para o próprio site, então lemos o
  que a página pública já entrega. Hoje eles só publicam o formato japonês.
- **onepiecetopdecks.com** — as páginas trazem uma tabela onde cada deck vem codificado como
  `1nOP14-020a4nOP07-022a...` (quantidade + código da carta). O robô decodifica isso e junta com
  colocação, torneio, autor, país e data. É a única das duas com o formato ocidental (EN).
- **Cartas** — a lista oficial da Bandai. Ela bloqueia hotlink de imagem, então as artes exibidas
  no site vêm da CDN da dotgg; a URL oficial fica guardada no JSON como referência.

### Por que existe a etapa de juntar

As duas fontes cobrem o mesmo período do formato japonês, então a mesma lista costuma aparecer
nas duas. Se a gente só empilhasse os arquivos, cada resultado repetido contaria em dobro e o
meta share ficaria mentiroso.

A junção considera a mesma lista quando batem **líder + data + as 50 cartas exatas**. Quando as
duas fontes trazem autores diferentes para essa combinação, os dois registros são mantidos —
são duas pessoas que levaram a mesma lista no mesmo dia, coisa comum em meta consolidado.
Na coleta atual, cerca de 180 listas aparecem nas duas fontes.

O filtro **Fonte**, lá em cima no site, deixa você isolar uma fonte só se quiser conferir.

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

### Três coisas para não se enganar

- Cerca de 11% das listas publicadas vêm incompletas (menos de 50 cartas). O filtro
  **"Só listas com 50 cartas"** já vem ligado por isso.
- Partidas de simulador aparecem misturadas com torneio de verdade no onepiecetopdecks. O filtro
  **"Excluir simulador"** também já vem ligado.
- A base tem bem mais decks japoneses que ocidentais, porque só uma das duas fontes cobre o
  formato EN. Se você joga no formato ocidental, use o filtro **Região = EN**.

---

Decklists: [gumgum.gg](https://gumgum.gg/) e [onepiecetopdecks.com](https://onepiecetopdecks.com/).
Dados de carta: [lista oficial da Bandai](https://en.onepiece-cardgame.com/cardlist/).
Projeto de fã, sem vínculo com a Bandai ou a Toei.
