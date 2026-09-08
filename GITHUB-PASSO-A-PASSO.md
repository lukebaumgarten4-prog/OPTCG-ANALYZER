# Colocar o projeto no GitHub — passo a passo

Você me disse que tem conta mas nunca usou. Então aqui vai tudo mastigado, sem pular etapa.
São 6 passos, uns 10 minutos. **Já deixei o projeto pronto e com o primeiro commit feito** —
falta só criar o repositório no site e mandar para lá.

Antes, três palavras que vão aparecer o tempo todo:

| Palavra | O que é, sem enrolação |
|---|---|
| **repositório** (ou *repo*) | A pasta do projeto lá no GitHub |
| **commit** | Uma foto do projeto num momento. É o "salvar" do Git |
| **push** | Mandar seus commits do PC para o GitHub |

---

## Passo 1 — Criar o repositório no site

1. Entre em **https://github.com/new**
2. Preencha assim:
   - **Repository name:** `optcg-analyzer`
   - **Description:** `Análise dos decks do One Piece Card Game que deram top`
   - Deixe marcado **Public** (precisa ser público para o site no ar ser de graça)
   - **NÃO marque** nenhuma das caixinhas de baixo (*Add a README*, *Add .gitignore*,
     *Choose a license*). O repositório tem que nascer vazio, senão dá conflito com o
     que já está aqui no seu PC.
3. Clique em **Create repository**.

Vai aparecer uma página com comandos. **Ignore ela**, use os do passo 2.

---

## Passo 2 — Mandar o projeto para lá

Abra o **PowerShell** na pasta do projeto. O jeito mais fácil: abra a pasta
`optcg-analyzer` no Explorador de Arquivos, clique na barra de endereço, digite `powershell`
e aperte Enter.

Agora cole os dois comandos abaixo, **trocando `SEU-USUARIO` pelo seu usuário do GitHub**:

```bash
git remote add origin https://github.com/SEU-USUARIO/optcg-analyzer.git
git push -u origin main
```

Na primeira vez, vai abrir uma janela pedindo para você entrar na conta do GitHub.
Escolha **"Sign in with your browser"**, faça o login e pronto — ele nunca mais vai pedir.

Deu certo? Atualize a página do repositório no navegador. Seus arquivos estão lá.

---

## Passo 3 — Deixar a automação salvar sozinha

Por padrão o GitHub não deixa o robô automático escrever no seu repositório.
Sem liberar isso, a atualização diária vai falhar.

1. No seu repositório, clique em **Settings** (a engrenagem, no menu de cima)
2. No menu da esquerda: **Actions** → **General**
3. Role até **Workflow permissions**
4. Marque **Read and write permissions**
5. Clique em **Save**

---

## Passo 4 — Colocar o site no ar

1. Ainda em **Settings**, menu da esquerda: **Pages**
2. Em **Source**, escolha **Deploy from a branch**
3. Em **Branch**, escolha **main** e a pasta **/ (root)**
4. **Save**

Espere uns 2 minutos e recarregue a página. Vai aparecer o link:

```
https://SEU-USUARIO.github.io/optcg-analyzer/
```

Esse é o seu site, no ar, de graça, acessível de qualquer lugar.

---

## Passo 5 — Testar a atualização automática

Ela já está programada para rodar todo dia às 3h da manhã (horário de Brasília), mas dá
para chamar na mão para conferir se funciona:

1. Aba **Actions**, lá em cima
2. Se aparecer um aviso verde pedindo para habilitar, clique em
   **I understand my workflows, go ahead and enable them**
3. No menu da esquerda, clique em **Atualizar dados**
4. Botão **Run workflow** (à direita) → **Run workflow**

Uns 2 minutos depois deve aparecer um ✅. Se aparecer um ❌ vermelho, clique nele para ver
onde travou — quase sempre é o passo 3 que ficou faltando.

---

## Passo 6 — O dia a dia

Sempre que você mexer em algo no seu PC e quiser mandar para o GitHub, são três comandos:

```bash
git add .
git commit -m "escreva aqui o que você mudou"
git push
```

E quando a automação atualizar os dados lá, para trazer as novidades para o seu PC:

```bash
git pull
```

> **A regra que evita 90% da dor de cabeça:** dê `git pull` **antes** de começar a mexer,
> e `git push` quando terminar. Como o robô faz commits sozinho todo dia, seu PC vive um
> pouco atrasado em relação ao GitHub.

---

## Quando der errado

**`git push` reclama de "rejected" ou "non-fast-forward"**
O GitHub tem commits que você não tem (provavelmente o robô rodou). Resolva com:

```bash
git pull --rebase
git push
```

**A Action falha com "Permission denied" ou erro 403**
Faltou o passo 3. Vá em Settings → Actions → General → Workflow permissions →
**Read and write permissions**.

**O site abre mas fica em branco, ou aparece "não consegui carregar os dados"**
Espere uns minutos: depois de cada push o GitHub Pages leva um tempo para republicar.
Se continuar, aperte `Ctrl+F5` para forçar o navegador a recarregar.

**A Action rodou verde mas os dados não mudaram**
Normal. Se o onepiecetopdecks.com não publicou nada novo, não há o que commitar —
a Action escreve "Nada mudou desde a última coleta" e encerra.

**Mandei alguma coisa errada e quero desfazer**
Enquanto não deu `push`, dá para desfazer o último commit mantendo os arquivos:

```bash
git reset --soft HEAD~1
```
