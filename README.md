# Truco avulso para o navegador

Projeto independente em HTML, CSS e JavaScript. Abre diretamente o marcador,
sem cadastro, torneio, servidor de aplicação ou compilação. Todos os arquivos
usados no jogo são locais, sem fontes, scripts ou serviços externos.

## Usar localmente

Com Node.js 22 ou superior, entre nesta pasta e execute:

```sh
npm start
```

Abra `http://127.0.0.1:4173/`. No PowerShell com restrição a scripts, use
`npm.cmd start`. Não abra `index.html` por `file://`: os módulos JavaScript e o
armazenamento devem ser usados por HTTP ou HTTPS.

## Publicar como outro projeto no GitHub Pages

1. Crie um repositório para o marcador, por exemplo `truco-avulso`.
2. Copie **o conteúdo desta pasta** para a raiz desse repositório, incluindo
   `assets`, `.nojekyll` e `.github` se escolher a opção por Actions. O
   `index.html` deve estar na raiz. Não precisa copiar o aplicativo Flutter.
3. Escolha uma das opções abaixo.

**Publicação simples pela branch:** em **Settings → Pages → Build and deployment**,
escolha **Deploy from a branch**, branch `main`, pasta **/(root)** e salve.
Não precisa executar Node ou instalar pacotes para publicar dessa forma.
Remova o workflow `.github/workflows/pages.yml` do novo repositório se escolher
essa opção, para manter uma única origem de publicação.

**Publicação com verificações automáticas:** mantenha o workflow fornecido,
escolha **GitHub Actions** em **Settings → Pages → Source** e faça push em `main`.
O workflow verifica o JavaScript, executa os testes e publica apenas os arquivos
públicos. Se sua branch principal tem outro nome, ajuste `branches` no workflow.
Não há dependências para instalar.

A URL do projeto será `https://SEU_USUARIO.github.io/truco-avulso/`.
Os caminhos de scripts, imagens, manifesto e service worker são relativos,
portanto funcionam também em subpastas do GitHub Pages.

O workflow está **dentro deste projeto** e não altera a publicação do repositório
Flutter. Para usar o mesmo repositório Flutter, é possível publicar os arquivos
desta pasta por um workflow que envie `truco-web` como artefato, mas isso muda
qual site é servido pelo Pages desse repositório.

[Documentação oficial de configuração do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Usar no Safari do iPhone

Abra a URL HTTPS no Safari. A interface considera as áreas seguras do iPhone,
permite zoom e oferece botões grandes, layout em retrato e paisagem e troca de
lugares por toque ou arraste. O alvo de compatibilidade é iOS/Safari 16.4 ou mais
recente. O marcador também funciona em navegadores modernos de Android e desktop.

Em **Compartilhar → Adicionar à Tela de Início**, crie um atalho. O manifesto e
o ícone Apple já estão incluídos. Depois do primeiro acesso e do carregamento
do service worker, os arquivos do marcador podem ser reabertos sem conexão.
O cache offline depende da disponibilidade do armazenamento do navegador.

O recurso **Tela sempre acesa** usa a Screen Wake Lock API. Ele é liberado ao
ocultar ou sair da página e solicitado novamente ao voltar. Restrições do
sistema, bateria ou versão do Safari podem impedir o bloqueio da suspensão.
O aviso sonoro usa Web Audio e a síntese de voz do navegador em português.
Use **Testar aviso sonoro** nas configurações para conferir no seu iPhone.

[Screen Wake Lock no Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)
e [síntese de voz no navegador](https://developer.mozilla.org/en-US/docs/Web/API/Window/speechSynthesis).

## Funcionalidades

- 1 contra 1, dupla e trio, com 2, 4 ou 6 lugares.
- N para Nós e E para Eles em dupla/trio; ícone de jogador em 1 contra 1.
- Em 1 contra 1, os lados são Eu e Ele; em dupla ou trio, Nós e Eles.
- Eu ou Nós identifica o lado na parte inferior da mesa. A vitória acompanha
  o nome: Eu venci, Ele venceu, Nós vencemos ou Eles venceram, inclusive no histórico.
- Mãos de 1, 3, 6, 9 e 12 pontos; a seleção volta a 1 depois de somar.
- Correção pelo botão Desfazer jogada, com confirmação. O desfazer recupera os pontos
  exatos antes da jogada, inclusive quando a soma foi limitada a 12 ou 15.
- Limites de 12 e 15, com validação do placar e histórico antes de reduzir.
- Confirmação da partida, contagem de vitórias e início da próxima no mesmo marcador.
- Baralho automático ao somar pontos, passagem manual e sentido horário/anti-horário.
- Troca de parceiros por dois toques ou arraste após segurar.
- Histórico expansível com partidas, pontos, correções, jogadas desfeitas e baralho.
- Limpeza somente do histórico anterior e opção de zerar vitórias preservando
  a partida em andamento, com escolha de limpar o histórico anterior.
- Layout do marcador Flutter: cabeçalho centralizado, placar grande, Desfazer
  jogada abaixo dos botões de somar, seletor de mão contornado e vitórias nas
  laterais da mesa compacta.
- Tema Preto do Flutter por padrão, com degradê preto → `#687B89` → preto,
  destaques brancos e mesa em grafite; seis esquemas de cores, fonte
  Pequena/Grande e tela sempre acesa.
- Assovio e voz na reta final: 11 no jogo até 12, ou 14 no jogo até 15.
- Tutorial pelo botão de informação, específico para marcador e histórico.
- Apoio ao projeto por PIX, com convite a cada oito partidas confirmadas.

## Salvamento e histórico

Cada ação salva imediatamente em `localStorage`; não depende de fechar a aba.
Atualizar ou fechar e reabrir a mesma URL recupera pontos, vitórias, jogadores,
baralho, sentido, posição da mesa, preferências e histórico. O valor selecionado
da mão volta a 1 para evitar marcar um truco por engano depois de reabrir.

Os dados pertencem ao **navegador, dispositivo, origem e caminho do projeto**.
O site não envia os placares a um servidor. Outros navegadores, outro endereço
ou o app Flutter têm seu próprio histórico.

Limpar os dados do site, usar navegação privada ou o navegador remover dados
locais pode eliminar o histórico. Ao faltar espaço ou ser negado o armazenamento,
um aviso persistente informa que o placar só está na aba. Dados ilegíveis não
são sobrescritos automaticamente: reiniciar o marcador exige confirmação.

Abas diferentes recebem atualizações pelo evento `storage`; antes de uma ação,
o marcador verifica os dados mais recentes. Para marcações exatamente simultâneas
em múltiplas abas, use uma única aba: `localStorage` não fornece transações entre abas.

[Comportamento do localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## Verificar e manter

```sh
npm run check
npm test
```

Os testes usam o executor nativo do Node e verificam as regras, desfazer,
baralho, formatos, limites, vitórias, histórico, falhas de armazenamento
e restauração após nova leitura dos dados. A validação de arquivos também
confere os caminhos publicados, manifesto e cache offline.

Ao publicar alterações, atualize `CACHE_VERSION` em `sw.js`. Uma nova versão
do cache é ativada depois que as abas com a versão antiga forem fechadas,
preservando o jogo aberto. Atualize `tutorial.js` em toda mudança de interface
e avance `TUTORIAL_ID` quando novas dicas precisarem de uma nova versão.
Modais usam um único componente (`openDialog` em `app.js`) e as classes
compartilhadas `.positive` e `.negative`; secundária antes da primária.

O ícone Apple pode ser regenerado sem dependências:

```sh
python tools/generate-icon.py
```

`engine.js` concentra as regras, `storage.js` o armazenamento, `app.js` a
interface e recursos do navegador, `tutorial.js` as dicas, e `styles.css` o tema.
Não há dependências de produção nem etapa de build.
