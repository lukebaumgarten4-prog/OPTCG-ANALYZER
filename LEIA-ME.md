# OPTCG Analyzer — meta do OP17

Análise do meta do **OP17 — The World’s Strongest Warriors**, montada a partir das decklists
do [gumgum.gg](https://gumgum.gg/) e do [onepiecetopdecks.com](https://onepiecetopdecks.com/deck-list/):
meta share dos líderes, taxa de inclusão de cada carta, deck consenso e comparador de listas.

O projeto acompanha **um formato só**. Quando sair o próximo set, é trocar o alvo em três
lugares (veja *Trocar de formato*, mais abaixo).

## O controle principal: de onde vêm os resultados

Logo abaixo das abas tem um botão de três posições que muda tudo que o site mostra:

| Origem | O que é |
|---|---|
| **Simulador** | Partidas jogadas no OPTCG Sim. É o padrão do site |
| **Torneios** | Resultado de torneio presencial: flagship, regional, championship, loja |
| **Tudo** | Os dois somados |

O padrão é o simulador porque o set é novo e é lá que o meta aparece primeiro. Mas a amostra
do simulador é bem menor, e isso está sinalizado na tela.

### Os dois metas não são a mesma coisa

Essa é a informação mais interessante da base, e o site mostra ela na aba Meta:

| Líder | Simulador | Torneio |
|---|---|---|
| Rocks.D.Xebec | 30,1% | 9,2% |
| Nico Robin | 2,7% | 11,9% |
| Dracule Mihawk | 16,4% | 24,5% |

No simulador as pessoas testam o que é novo; no torneio elas levam o que confiam. Quem sobe
muito de um lado para o outro conta a história do formato.

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

Isso roda os cinco passos em sequência (uns 3 minutos no total):

| Comando | O que faz |
|---|---|
| `npm run atualizar-cartas` | Baixa nome, custo, poder, counter, cor e traços de todas as cartas, da lista oficial da Bandai |
| `npm run atualizar-gumgum` | Lê as decklists do gumgum.gg (só as do formato alvo) |
| `npm run atualizar-topdecks` | Lê as páginas de decklist do onepiecetopdecks.com |
| `npm run atualizar-precos` | Baixa o preço de cada carta na TCGplayer (pelo espelho tcgcsv.com) |
| `npm run juntar` | Junta as duas fontes de decklist no `data/decks.json`, que é o arquivo que o site lê |

Os quatro primeiros salvam arquivos separados (`data/cartas.json`, `data/precos.json`,
`data/fonte-gumgum.json`, `data/fonte-topdecks.json`). Só o `juntar` produz o `data/decks.json`.
Se um dos sites cair, os outros seguem atualizando e a junção reaproveita o último arquivo bom da fonte que falhou.

## Trocar de formato

Quando sair o próximo set, o alvo precisa mudar em três lugares:

1. `scripts/sources.json` — as URLs das páginas do onepiecetopdecks (saem da
   [página de decklists](https://onepiecetopdecks.com/deck-list/))
2. `scripts/coletar-gumgum.mjs` — a constante `FORMATO_ALVO`
3. `scripts/juntar-decks.mjs` — a constante `FORMATO_ALVO`

Depois rode `npm run atualizar`. O gumgum publica vários formatos na mesma página; o robô
descarta o que não é do alvo.

---

## Como isto está montado

```
optcg-analyzer/
├── data/                       <- o "banco de dados"
│   ├── cartas.json                todas as cartas com custo, poder, counter, traços…
│   ├── precos.json                menor preço de cada carta na TCGplayer
│   ├── fonte-gumgum.json          coleta crua do gumgum.gg
│   ├── fonte-topdecks.json        coleta crua do onepiecetopdecks.com
│   └── decks.json                 as duas fontes juntas e sem repetição  <- o site lê este
├── scripts/                    <- os robôs
│   ├── sources.json               páginas do onepiecetopdecks a acompanhar
│   ├── coletar-cartas.mjs
│   ├── coletar-gumgum.mjs
│   ├── coletar-precos.mjs
│   ├── coletar-decks.mjs
│   ├── juntar-decks.mjs
│   └── lib.mjs                    funções compartilhadas pelos robôs
├── js/                         <- o site
│   ├── dados.js                   carrega os JSON e guarda os filtros
│   ├── analise.js                 contas do conjunto (meta share, consenso, comparação)
│   ├── analise-deck.js            contas de uma lista (counter, curvas, buscadores, preço)
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
- **Preços** — TCGplayer, pelo espelho público tcgcsv.com. Cada produto de carta traz um campo
  `Number` com o código ("OP17-028"), que casa direto com o resto do projeto. Quando a carta tem
  várias impressões guardamos a **mais barata**, que é o que interessa para saber quanto custa
  montar o deck. Valores em dólar.

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

**Meta share** — quanto cada líder representa do total de decks filtrados, com a **margem de
erro de 95%** (intervalo de Wilson) ao lado. Isso importa: no recorte do simulador são ~73
listas, e 30,1% na verdade quer dizer "algo entre 20% e 40%". Quando as faixas de dois líderes
se cruzam, eles estão tecnicamente empatados. Líder com menos de 5 decks aparece esmaecido, e
quando a amostra toda fica abaixo de 150 listas o site avisa em cima da tabela.

O winrate só aparece quando há pelo menos 20 partidas com placar informado, porque muita
decklist vem sem o placar e uma amostra pequena mentiria.

**Estatística de cartas** — para cada carta, em quantos % das listas daquele líder ela
aparece e quantas cópias em média. As cartas ficam classificadas em **núcleo** (90%+ das
listas), **flex** (entre 30% e 90%) e **tech** (menos de 30%).

**Deck consenso** — a lista de 50 cartas "média" de um líder. Cada carta entra com a parte
inteira da sua média de cópias, e as vagas que sobram vão para as cartas com a maior fração
pendente, então o total fecha exatamente em 50. Não é a lista "certa" — é o retrato do que a
maioria joga, e os slots flex são justamente onde as listas discordam.

**Comparar** — diferença carta a carta entre dois decks, ou entre um deck e o consenso do
líder dele. É o jeito rápido de ver onde uma lista se afasta do padrão.

### O painel que acompanha cada lista

Tanto o deck consenso quanto qualquer deck aberto na aba Decks vêm com a lista desenhada em
cartas (com o preço de cada uma) e mais:

**Counter** — quantas cartas de 1k e de 2k, quantos Events de counter (que valem 4k) e a média
por carta. A média divide o counter total pelas 50 cartas, não só pelas que dão counter: é assim
que dá para comparar a densidade de duas listas. Purple Enel, por exemplo, fica perto de 0.40k
enquanto Green Mihawk fica em 0.72k.

**Chance dos buscadores acharem algo** — cartas do tipo "olhe 3 do topo e revele 1 {Big Mom
Pirates}". O site lê o texto do efeito, descobre o que a carta procura, conta quantas cartas da
lista servem e calcula a chance pela distribuição hipergeométrica. A conta assume que o buscador
já foi jogado, então sobram 49 cartas no deck — por isso o número sai um tiquinho diferente do
gumgum, que usa 50. Buscador cujo critério é complicado demais para ler com segurança
simplesmente não aparece, em vez de mostrar número errado.

**Curva de custo**, **curva de poder**, **traços** e **preço para montar**.

### Quatro coisas para não se enganar

- Cerca de 11% das listas publicadas vêm incompletas (menos de 50 cartas). O filtro
  **"Só listas com 50 cartas"** já vem ligado por isso.
- Partidas de simulador aparecem misturadas com torneio de verdade no onepiecetopdecks. O filtro
  **"Excluir simulador"** também já vem ligado.
- A base tem bem mais decks japoneses que ocidentais, porque só uma das duas fontes cobre o
  formato EN. Se você joga no formato ocidental, use o filtro **Região = EN**.
- **Todo o dado de simulador é EN.** O onepiecetopdecks só marca partidas de sim nas páginas
  ocidentais, então o recorte "Simulador" nunca vai trazer resultado japonês.
- Os dados de simulador costumam ficar alguns dias atrás dos de torneio, porque a fonte publica
  eles em lote. Repare no "período coberto" na aba Meta.
- O preço é o de mercado na TCGplayer, em dólar, da impressão mais barata. Serve para comparar
  listas, não como orçamento de compra: no Brasil o valor real é outro.

---

Decklists: [gumgum.gg](https://gumgum.gg/) e [onepiecetopdecks.com](https://onepiecetopdecks.com/).
Dados de carta: [lista oficial da Bandai](https://en.onepiece-cardgame.com/cardlist/).
Preços: [TCGplayer](https://www.tcgplayer.com/) via [tcgcsv.com](https://tcgcsv.com/).
Projeto de fã, sem vínculo com a Bandai ou a Toei.
