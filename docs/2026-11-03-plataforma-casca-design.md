# Plataforma de fechamento, visual B: especificação (03/11/2026)

## Objetivo
O site Fechamento vira uma plataforma no visual **B · Grafite**, escolhido pela coordenadora:
1. entrada;
2. crachá da Cosampa;
3. regiões.

O **interior da EDP também é refeito no visual B**, com o mesmo funcionamento de hoje.

**Não publicar:** o site no ar fica como está até o Italo mandar. O trabalho vai num ramo separado (`plataforma`), e o `main` continua livre para correções urgentes da EDP.

## Visual B (vale para todas as telas)
- Referência: https://italoleandrojs.github.io/fechamento-rascunhos/b-grafite.html (fonte local em `Desktop\AUTOMACAO KIT MATERIAL\rascunhos-plataforma\b-grafite.html`).
- **Sempre escuro**, sem versão clara:
  - fundo #131315, painel #1c1c1f, painel-2 #2f2f35;
  - texto #f4f4f5 e #a1a1aa;
  - linhas rgb(255 255 255 / .13).
- Verde Cosampa #5abd79 como **único destaque**, no lugar do amarelo atual: botões principais, estado "Abrir", seleção, foco e a linha que "liga". Sem brilho/glow. Vermelho e verde de alerta continuam, com contraste AA.
- Fonte Sora. Logo do Grupo Cosampa em branco (o mesmo do rascunho), no lugar do logo "Cosampa Fechamento" com o A amarelo.

## Entrada
- Foto da **linha viva em rede de distribuição MT, com cesto aéreo**: `Desktop\LINKEDIN\cosampa-site\public\fotos\servicos-eletricos-4-1920.webp`, do site público da Cosampa. Vai em preto e branco, escurecida à esquerda, com o selo "Foto provisória".
- "Fechamento" em letras gigantes, com a linha verde que se desenha uma vez.
- Formulário com os dados do crachá:
  - **Nome** e **Cargo** obrigatórios;
  - **Matrícula** e **Foto** opcionais (a foto é reduzida no navegador);
  - nota: "Seus dados ficam guardados só neste navegador."
- Sem servidor: tudo no `localStorage`. Nenhum nome, foto ou matrícula de colega vai para o código (o repositório é público). O login com e-mail e senha fica para depois do aval da empresa.

## Crachá: o modelo da Cosampa
- O modelo é o crachá real que o Italo mandou: `Downloads\CRACHÁ COSAMPA_COMPARTILHADO (44) (2)\`, frente e verso, 649×1039.
  - **Os dois arquivos têm foto e dados reais de colegas:** servem só de referência visual e **nunca entram no projeto**.
- O modelo **em branco é redesenhado** em canvas:
  - **Frente:** curva preta no topo, anéis cinza à esquerda, grade de pontos, círculo grande da foto à direita (sem foto, as iniciais), nome em negrito, cargo abaixo, logo "GRUPO COSAMPA" embaixo e meia-lua preta no canto.
  - **Verso:** curva preta com o logo em branco e os campos "Nome:", "Setor:", "Matrícula:" e "Empresa:", mais o aviso "Este crachá é de uso pessoal e intransferível. Uso obrigatório durante a permanência na empresa." e a grade de pontos.
  - **Sem número de emergência.**
- Os valores do verso:
  - Setor: "FECHAMENTO";
  - Empresa: "GRUPO COSAMPA";
  - Matrícula em branco quando não for informada.
- Base técnica: o pacote `Desktop\cracha-3d.zip` (13/10), feito para esse layout. Traz `LAYOUT` com as posições, `arte.js` e o Lanyard do React Bits. A fonte Poppins passa a ser local (o pacote buscava no Google Fonts, o que a CSP proíbe).
- **3D no computador:** o crachá pendurado no cordão, que dá para puxar, com o cordão preto e o logo da Cosampa.
- **Parado no celular,** e também com "reduzir movimento", aparelho fraco, economia de dados ou sem WebGL: a mesma arte da frente como imagem; tocar vira para o verso.

## Painel
- Cabeçalho com o logo e "Trocar pessoa".
- O crachá.
- A saudação pelo horário: "Bom dia/Boa tarde/Boa noite, <primeiro nome>."
- A lista numerada de regiões:
  - 01 EDP, Pronto;
  - 02 Ceará, Em breve;
  - 03 Sergipe, Em breve.
- Região "em breve" mostra "<Região> ainda está em construção." e não navega.
- **Ceará em teste** sai da vista da equipe e fica em `#ceara-teste`, para o Italo continuar testando.

## Interior da EDP no visual B
- Telas:
  - início do inventário;
  - etapas: estruturas, materiais e mão de obra, ajuste de materiais, fichas (DP, aterramento, equipamentos), fotos, carimbo e boletim;
  - revisão e download;
  - a página do Ceará em teste.
- Mesmo funcionamento e mesmos textos. Mudam as cores, o logo e o acabamento.
- No cabeçalho, o botão "← Regiões". Com obra lançada, ele pede confirmação antes de descartar.

## Fora do escopo
Login/servidor, fotos reais do fechamento, contagem pelo CAD (próxima etapa), mão de obra do Ceará, Sergipe e a publicação.

## Pronto quando
- Entrada, painel e crachá iguais ao rascunho B e ao modelo Cosampa, em 1366×768 e 390×844.
- O fluxo inteiro da EDP passa (testes de unidade e e2e verdes), já no visual novo.
- axe sem erros em todas as telas. Nada carregado de fora (CSP mantida; só entra `'wasm-unsafe-eval'` para a física do crachá).
- Nada publicado: o ramo `plataforma` é mostrado ao Italo localmente.
