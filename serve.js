// Servidor local simples, só para abrir o site no navegador durante o desenvolvimento.
// O navegador se recusa a ler os JSON quando a página é aberta por duplo clique
// (protocolo file://), por isso precisamos servir por http://.
//
//   node serve.js        -> http://localhost:8080

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORTA = Number(process.env.PORT) || 8080;
// A raiz e a pasta deste arquivo, entao funciona mesmo se rodar de outro diretorio.
const RAIZ = dirname(fileURLToPath(import.meta.url));

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORTA}`);
    let caminho = decodeURIComponent(url.pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';

    // Impede sair da pasta do projeto com ".." na URL.
    const destino = join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
    if (!destino.startsWith(RAIZ)) {
      res.writeHead(403).end('403');
      return;
    }

    const info = await stat(destino);
    const arquivo = info.isDirectory() ? join(destino, 'index.html') : destino;
    const conteudo = await readFile(arquivo);

    res.writeHead(200, {
      'Content-Type': TIPOS[extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>Arquivo não encontrado.</p>');
  }
});

servidor.listen(PORTA, () => {
  console.log(`OPTCG Analyzer rodando em http://localhost:${PORTA}`);
  console.log('Para parar, feche esta janela ou aperte Ctrl+C.');
});
