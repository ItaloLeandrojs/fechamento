// Servidor local para mostrar o site sem internet.
// Uso: `node servir.mjs` serve a pasta dist/ em http://localhost:4400/
// Só usa módulos que já vêm com o Node.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

function ehArquivo(caminho) {
  try {
    return fs.statSync(caminho).isFile();
  } catch {
    return false;
  }
}

function ehPasta(caminho) {
  try {
    return fs.statSync(caminho).isDirectory();
  } catch {
    return false;
  }
}

// Texto (HTML, CSS, JS, JSON, SVG) vai comprimido em gzip quando o navegador aceita: no
// celular ligado ao notebook pela rede, a página chega 4 a 5 vezes menor. A versão comprimida
// fica guardada na memória enquanto o arquivo não muda (mesmo tamanho e mesma data).
const COMPRIMIR = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml"]);
const comprimidos = new Map();

function gzipDe(caminho, stat) {
  const chave = `${stat.size}:${stat.mtimeMs}`;
  const guardado = comprimidos.get(caminho);
  if (guardado?.chave === chave) return guardado.dados;
  const dados = zlib.gzipSync(fs.readFileSync(caminho), { level: 6 });
  comprimidos.set(caminho, { chave, dados });
  return dados;
}

function aceitaGzip(req) {
  return /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
}

function enviarArquivo(req, res, caminho, status) {
  const ext = path.extname(caminho).toLowerCase();
  const tipo = TIPOS[ext] || "application/octet-stream";
  const stat = fs.statSync(caminho);
  const cabecalhos = {
    "Content-Type": tipo,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
  if (COMPRIMIR.has(ext)) {
    cabecalhos.Vary = "Accept-Encoding";
    if (aceitaGzip(req) && stat.size > 1024) {
      let dados;
      try {
        dados = gzipDe(caminho, stat);
      } catch {
        dados = null;
      }
      if (dados) {
        res.writeHead(status, { ...cabecalhos, "Content-Encoding": "gzip", "Content-Length": dados.length });
        res.end(req.method === "HEAD" ? undefined : dados);
        return;
      }
    }
  }
  res.writeHead(status, { ...cabecalhos, "Content-Length": stat.size });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const leitura = fs.createReadStream(caminho);
  leitura.on("error", () => res.destroy());
  leitura.pipe(res);
}

// Cria o servidor, mas NÃO começa a escutar: quem chama usa server.listen(porta).
// `porta` é guardada em server.portaPadrao para o modo "rodar direto".
export function criarServidor({ raiz, porta }) {
  const base = path.resolve(raiz);

  const servidor = http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      res.end("Método não permitido");
      return;
    }

    const respostaNaoEncontrada = () => {
      const pagina404 = path.join(base, "404.html");
      if (ehArquivo(pagina404)) {
        enviarArquivo(req, res, pagina404, 404);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(req.method === "HEAD" ? undefined : "Página não encontrada");
      }
    };

    let caminhoUrl;
    try {
      caminhoUrl = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Endereço inválido");
      return;
    }

    if (caminhoUrl.includes("\0")) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Endereço inválido");
      return;
    }

    // Qualquer "..", mesmo disfarçado, é negado antes de tocar no disco.
    if (caminhoUrl.split(/[\/]+/).includes("..")) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Acesso negado");
      return;
    }

    const alvo = path.resolve(base, "." + path.sep + caminhoUrl.replace(/^[\/]+/, ""));
    if (alvo !== base && !alvo.startsWith(base + path.sep)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Acesso negado");
      return;
    }

    if (ehPasta(alvo)) {
      if (!caminhoUrl.endsWith("/")) {
        res.writeHead(301, { Location: caminhoUrl + "/" });
        res.end();
        return;
      }
      const indice = path.join(alvo, "index.html");
      if (ehArquivo(indice)) {
        enviarArquivo(req, res, indice, 200);
        return;
      }
      respostaNaoEncontrada();
      return;
    }

    if (ehArquivo(alvo)) {
      enviarArquivo(req, res, alvo, 200);
      return;
    }

    respostaNaoEncontrada();
  });

  servidor.portaPadrao = porta;
  return servidor;
}

// Rodando direto: node servir.mjs
const rodandoDireto =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (rodandoDireto) {
  const pasta = path.dirname(fileURLToPath(import.meta.url));
  const porta = 4400;
  const servidor = criarServidor({ raiz: path.join(pasta, "dist"), porta });

  servidor.on("error", (erro) => {
    if (erro.code === "EADDRINUSE") {
      console.log(`A porta ${porta} já está em uso. O site provavelmente já está aberto.`);
      process.exit(2);
    }
    console.error("Não foi possível iniciar o servidor:", erro.message);
    process.exit(1);
  });

  servidor.listen(porta, "127.0.0.1", () => {
    console.log(`Site no ar em http://localhost:${porta}/`);
    console.log("Para encerrar, feche esta janela ou aperte Ctrl+C.");
  });
}
