# Projeto HTML independente

- Este projeto abre diretamente o marcador avulso. Preserve os caminhos
  relativos para funcionar na raiz e em subpastas do GitHub Pages.
- Não adicione dependências ou compilação para funcionalidades que podem ser
  implementadas em HTML, CSS e JavaScript nativos.
- Toda mudança de interface deve atualizar as dicas em `tutorial.js`, incluindo
  alvos, nomes, ordem e controles de navegação. Atualize `TUTORIAL_ID` e os testes
  quando apresentar uma nova funcionalidade.
- Os modais usam o componente `openDialog` em `app.js` e as classes compartilhadas
  de `styles.css`. A secundária usa `.negative` e vem antes da primária `.positive`.
- Preserve o estado antes de ações rejeitadas. Não sobrescreva dados ilegíveis
  automaticamente. O salvamento usa somente o armazenamento local do navegador.
- Execute `npm run check` e `npm test`. Atualize `CACHE_VERSION` em `sw.js` em
  novas versões públicas dos arquivos do marcador.
