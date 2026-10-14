export const TUTORIAL_ID = 'trucoWebScore.v6';
export const SCORE_STEPS = [
  { target: 'scoreboard', title: 'Nós é o time de quem está embaixo', message: 'O time na parte inferior da mesa é Nós; o adversário é Eles. Os pontos e as vitórias ficam ligados às equipes durante a partida.' },
  { target: 'score-controls', title: 'Marque os pontos da mão', message: 'Toque no + do time que ganhou. Os pontos são salvos na hora e o baralho passa automaticamente. Para corrigir uma marcação, use Desfazer jogada, no botão largo abaixo dos botões de somar: a última marcação é revertida e continua identificada no histórico.' },
  { target: 'hand-selector', title: 'Truco, seis, nove ou doze?', message: 'Escolha 1, 3, 6, 9 ou 12 em Pontos da mão antes de marcar. Depois de somar, a seleção volta a 1. Ao alcançar 12 ou 15, confirme a partida para registrar a vitória e começar a próxima.' },
  { target: 'round-table', title: 'Os lugares e o baralho', message: 'Em dupla ou trio, N indica Nós e E indica Eles. Em 1 contra 1, aparece um jogador. As cartas marcam quem está com o baralho. As vitórias de Nós e Eles aparecem com os troféus nas laterais da mesa. Toque em dois parceiros para trocar os lugares ou segure e arraste um sobre o outro. Toque no selecionado para cancelar.' },
  { target: 'table-settings-button', title: 'Ajuste a mesa', message: 'Na engrenagem da mesa, escolha 1 contra 1, Dupla ou Trio, o limite de 12 ou 15 pontos e o sentido do baralho. Zerar vitórias mantém o placar atual e permite limpar o histórico anterior.' },
  { target: 'pass-button', title: 'Passe a vez manualmente', message: 'Use Passar o baralho quando precisar mudar a vez sem somar pontos. Se passar manualmente depois de uma marcação, desfazer a jogada preserva essa passagem manual.' },
  { target: 'history-button', title: 'Consulte o histórico', message: 'O relógio abre as partidas e suas jogadas, inclusive as desfeitas e passagens de baralho. Toque em uma partida para expandi-la. Limpar histórico apaga só as partidas anteriores, mantendo pontos, vitórias e a partida atual. Voltar ao placar retoma o jogo.' },
  { target: 'settings-button', title: 'Deixe do seu jeito', message: 'O marcador usa o tema Preto do Flutter, com degradê preto e grafite, destaques brancos e mesa em grafite. Na engrenagem à esquerda do cabeçalho, escolha cores, fonte Grande, tela sempre acesa e aviso sonoro na reta final: 11 no jogo até 12, ou 14 no jogo até 15. O Safari mantém o placar ao atualizar; limpar os dados do site apaga os dados locais.' },
];
export const HISTORY_STEPS = [
  { target: 'history-summary', title: 'Seu marcador continua aqui', message: 'Confira pontos, vitórias e a partida atual de Nós e Eles. Cada partida anterior mantém os nomes do formato em que foi jogada: Eu e Ele em 1 contra 1; Nós e Eles em dupla ou trio.' },
  { target: 'history-games', title: 'Abra uma partida para conferir', message: 'Toque no cabeçalho da partida para expandir ou recolher suas jogadas. Pontos, correções, jogadas desfeitas e passagens de baralho ficam registrados. A partida atual começa expandida.' },
  { target: 'clear-history-button', title: 'Limpe apenas as partidas anteriores', message: 'Limpar histórico mantém a partida atual, seus pontos e as vitórias. A exclusão das partidas anteriores exige confirmação.' },
  { target: 'back-button', title: 'Continue jogando', message: 'Voltar ao placar fecha o histórico e retoma o marcador. Todas as marcações são salvas automaticamente neste navegador.' },
];

export function scoreSteps(hasWinner, size = 2) {
  const steps = size === 1 ? SCORE_STEPS.map(step => {
    if (step.target === 'scoreboard') return { ...step, title: 'Eu sou o jogador de baixo',
      message: 'Em 1 contra 1, o seu lado aparece como Eu e o adversário como Ele. Em dupla ou trio, os nomes passam a Nós e Eles. Pontos e vitórias continuam ligados aos mesmos lados.' };
    if (step.target === 'round-table') return { ...step,
      message: 'Em 1 contra 1, cada ícone representa um jogador. As cartas indicam quem está com o baralho, e os troféus nas laterais mostram as vitórias de Eu e Ele. Escolha Dupla ou Trio nas configurações da mesa para jogar com parceiros; nesses formatos, N indica Nós e E indica Eles.' };
    return step;
  }) : SCORE_STEPS;
  if (!hasWinner) return steps;
  return steps.map(step => step.target === 'hand-selector' ? {
    target: 'confirm-button', title: 'Confirme a partida',
    message: 'O time alcançou o limite de pontos. Confirme a partida para registrar a vitória, salvar o resultado no histórico e começar a próxima com zero pontos. Se houve um engano, use Desfazer jogada antes de confirmar.',
  } : step);
}

export function historySteps(size = 2) {
  return size === 1 ? HISTORY_STEPS.map(step => step.target === 'history-summary' ? {
    ...step, message: 'Confira pontos, vitórias e a partida atual de Eu e Ele. Cada partida anterior mantém os nomes do formato em que foi jogada: Eu e Ele em 1 contra 1; Nós e Eles em dupla ou trio.',
  } : step) : HISTORY_STEPS;
}

export class Tutorial {
  constructor(onFinish) {
    this.overlay = document.getElementById('tutorial-overlay');
    this.card = this.overlay.querySelector('.tutorial-card');
    this.onFinish = onFinish;
    this.index = 0;
    document.getElementById('tutorial-next').addEventListener('click', () => {
      if (this.index === this.steps.length - 1) this.close();
      else { this.index++; this.show(); }
    });
    document.getElementById('tutorial-previous').addEventListener('click', () => { this.index--; this.show(); });
    document.getElementById('tutorial-skip').addEventListener('click', () => this.close());
    window.addEventListener('resize', () => { if (!this.overlay.hidden) this.position(); });
    window.addEventListener('scroll', () => { if (!this.overlay.hidden) this.position(); }, true);
    this.overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); this.close(); }
      if (event.key === 'Tab') {
        const buttons = [...this.card.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }

  open(steps) {
    this.previousFocus = document.activeElement;
    this.previousScroll = window.scrollY;
    document.body.classList.add('tutorial-open');
    this.steps = steps;
    this.index = 0;
    this.overlay.hidden = false;
    document.querySelector('.app-shell').inert = true;
    this.show();
  }

  show() {
    const step = this.steps[this.index];
    this.target = document.getElementById(step.target);
    document.getElementById('tutorial-title').textContent = step.title;
    document.getElementById('tutorial-message').textContent = step.message;
    document.getElementById('tutorial-progress').textContent = `${this.index + 1} de ${this.steps.length}`;
    document.getElementById('tutorial-previous').disabled = this.index === 0;
    const next = document.getElementById('tutorial-next');
    next.textContent = this.index === this.steps.length - 1 ? 'Concluir' : 'Próximo';
    next.focus({ preventScroll: true });
    if (this.target) {
      this.target.scrollIntoView({ block: 'center', behavior: 'auto' });
      // Keep the highlighted target above the card, even after page scrolling.
      requestAnimationFrame(() => {
        const target = this.target.getBoundingClientRect();
        const card = this.card.getBoundingClientRect();
        if (target.bottom > card.top - 16 && matchMedia('(orientation: portrait)').matches) {
          window.scrollBy(0, target.bottom - card.top + 24);
        }
        this.position();
      });
    }
  }

  position() {
    if (!this.target) return;
    const rect = this.target.getBoundingClientRect();
    if (matchMedia('(orientation: landscape) and (max-height: 550px)').matches) {
      const targetOnRight = rect.left + rect.width / 2 > innerWidth / 2;
      this.card.style.left = targetOnRight ? '16px' : 'auto';
      this.card.style.right = targetOnRight ? 'auto' : '16px';
    } else {
      this.card.style.left = '';
      this.card.style.right = '';
    }
    const highlight = document.getElementById('tutorial-highlight');
    Object.assign(highlight.style, {
      left: `${Math.max(4, rect.left - 5)}px`, top: `${rect.top - 5}px`,
      width: `${Math.min(innerWidth - 8, rect.width + 10)}px`, height: `${rect.height + 10}px`,
    });
  }

  close() {
    this.overlay.hidden = true;
    document.body.classList.remove('tutorial-open');
    document.querySelector('.app-shell').inert = false;
    window.scrollTo(0, this.previousScroll);
    this.previousFocus?.focus({ preventScroll: true });
    this.onFinish();
  }
}
