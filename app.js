import { initialState, reduce, validateState, HAND_VALUES, bottomTeam, teamOf,
  labelFor, victoryMessage, scoreSpeech, winner, lastPlay, announcement, THEMES } from './engine.js';
import { MatchStorage, storageKey } from './storage.js';
import { Tutorial, TUTORIAL_ID, scoreSteps, historySteps } from './tutorial.js';

const $ = id => document.getElementById(id);
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const formatTime = value => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));
const sizeLabel = size => ['1 contra 1', 'Dupla', 'Trio'][size - 1];
const pix = '00020126460014BR.GOV.BCB.PIX0124alan_gerardi@hotmail.com5204000053039865802BR5917Alan Luiz Gerardi6009SAO PAULO62140510wYo4AjqgG263042800';
let browserStorage;
try { browserStorage = window.localStorage; } catch { browserStorage = null; }
const storage = new MatchStorage(browserStorage, storageKey(location.pathname));
let state = storage.load();
let hand = 1;
let selected = null;
let page = 'score';
let toastTimer;
let wakeLock = null;
let wakePending = false;
let audio = null;
let dialogCallback = null;
let dialogFocus = null;
const tutorial = new Tutorial(() => dispatch({ type: 'tutorial-seen', id: TUTORIAL_ID }));

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}

function dispatch(action) {
  try {
    if (storage.blocked) throw new Error(storage.error);
    const latest = storage.latest();
    if (latest && latest.revision !== state.revision) state = latest;
    if (action.type === 'score' && action.side !== undefined) {
      action = { ...action, team: action.side === 0 ? bottomTeam(state) : 1 - bottomTeam(state) };
    }
    const before = state;
    const next = reduce(state, action);
    if (next === state) return false;
    storage.save(next);
    state = next;
    if (action.type === 'score' && action.delta > 0) {
      hand = 1;
      const message = announcement(before, next, action.team);
      if (message) announce(message);
      else if (winner(next) !== -1) stopAudio();
    }
    if (action.type === 'score' && action.delta < 0) stopAudio();
    if (['undo', 'confirm'].includes(action.type)) { hand = 1; stopAudio(); }
    if (['size', 'swap'].includes(action.type)) selected = null;
    render();
    if (action.type === 'preferences') syncWakeLock();
    return true;
  } catch (error) {
    renderStorageStatus();
    toast(error.message || 'Não foi possível realizar esta ação.');
    return false;
  }
}

function render() {
  document.body.dataset.theme = state.preferences.theme;
  document.body.dataset.font = state.preferences.font;
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(document.body).getPropertyValue('--bg').trim();
  const ours = bottomTeam(state), theirs = 1 - ours;
  const won = winner(state);
  $('match-number').textContent = `Partida ${state.game}`;
  $('match-format').textContent = sizeLabel(state.size);
  $('page-title').textContent = page === 'history' ? 'Histórico' : 'Sequinha';
  $('target-label').textContent = page === 'history' ? `Partida ${state.game}` : `Até ${state.target} pontos`;
  for (const [name, team] of [['ours', ours], ['theirs', theirs]]) {
    const label = labelFor(state, team);
    $(`label-${name}`).textContent = label;
    $(`score-${name}`).textContent = state.scores[team];
    $(`score-${name}`).setAttribute('aria-label', state.size === 1 ? (name === 'ours' ? 'Meus pontos' : 'Pontos dele') : `Pontos de ${label}`);
    $(`score-${name}`).classList.toggle('double-digit', state.scores[team] >= 10);
    $(`wins-${name}`).textContent = state.wins[team];
    $(`wins-${name}`).setAttribute('aria-label', `${label}: ${state.wins[team]} ${state.wins[team] === 1 ? 'vitória' : 'vitórias'}`);
    $(`wins-group-${name}`).setAttribute('aria-label', state.size === 1 ? (name === 'ours' ? 'Minhas vitórias' : 'Vitórias dele') : `Vitórias de ${label}`);
    $(`add-${name}`).textContent = `+${hand}`;
    $(`add-${name}`).setAttribute('aria-label', `Adicionar ${hand} ${hand === 1 ? 'ponto' : 'pontos'} para ${label === 'Eu' ? 'mim' : label.toLowerCase()}`);
    $(`add-${name}`).disabled = won !== -1 || storage.blocked;
  }
  $('undo-button').disabled = !lastPlay(state) || storage.blocked;
  $('pass-button').disabled = won !== -1 || storage.blocked;
  $('winner-banner').hidden = won === -1;
  $('winner-label').textContent = won === -1 ? '' : `${victoryMessage(state, won)}!`;
  $('confirm-button').disabled = storage.blocked;
  $('hand-selector').hidden = won !== -1;
  for (const button of $('hand-values').children) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.value) === hand));
    button.disabled = storage.blocked;
  }
  renderSeats();
  renderStorageStatus();
  if (page === 'history') renderHistory();
}

function renderStorageStatus() {
  $('storage-alert').hidden = !storage.error;
  $('storage-message').textContent = storage.error || '';
  $('recovery-button').hidden = !storage.blocked;
}

function renderSeats() {
  const container = $('seats');
  const table = $('round-table');
  if (!table.clientWidth || !table.clientHeight) return;
  const seatWidth = Math.min(76, Math.max(48, table.clientWidth * .29));
  const diameter = Math.min(126, table.clientWidth - seatWidth, table.clientHeight - 48);
  table.style.setProperty('--seat-width', `${seatWidth}px`);
  table.style.setProperty('--table-diameter', `${diameter}px`);
  const radiusX = Math.min((table.clientWidth - seatWidth) / 2, (diameter + seatWidth) / 2 + 4);
  const radiusY = (table.clientHeight - 48) / 2;
  for (const old of [...container.children]) {
    if (!state.order.includes(Number(old.dataset.player))) old.remove();
  }
  state.order.forEach((id, index) => {
    let button = container.querySelector(`[data-player="${id}"]`);
    if (!button) {
      button = document.createElement('button');
      button.className = 'seat';
      button.id = `seat-${id}`;
      button.dataset.player = id;
      button.type = 'button';
      button.addEventListener('click', () => tapSeat(id));
      installDrag(button, id);
      container.append(button);
    }
    const label = labelFor(state, teamOf(id));
    const angle = -Math.PI / 2 + 2 * Math.PI * (index - state.rotation) / state.order.length;
    button.style.transform = `translate(${Math.cos(angle) * radiusX}px, ${Math.sin(angle) * radiusY}px)`;
    button.classList.toggle('ours', teamOf(id) === bottomTeam(state));
    button.classList.toggle('selected', id === selected);
    button.disabled = storage.blocked;
    button.setAttribute('aria-label', `Jogador ${id}, ${label}${state.dealer === id ? ', está com o baralho' : ''}${selected === id ? ', selecionado' : ''}`);
    button.setAttribute('aria-pressed', String(id === selected));
    button.innerHTML = state.size === 1 ? icon('person') : `<span aria-hidden="true">${label === 'Nós' ? 'N' : 'E'}</span>`;
    if (state.dealer === id) button.insertAdjacentHTML('beforeend', `<span class="dealer-cards">${icon('dealer')}</span>`);
  });
}

function tapSeat(id) {
  if (state.size === 1) { toast(`Jogador ${id} · ${labelFor(state, teamOf(id))}`); return; }
  if (selected === null) selected = id;
  else if (selected === id) selected = null;
  else if (dispatch({ type: 'swap', from: selected, to: id })) return;
  render();
}

function installDrag(button, id) {
  let timer, start, dragging = false, suppressClick = false, target = null;
  button.addEventListener('pointerdown', event => {
    if (button.disabled || state.size === 1) return;
    start = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      dragging = true;
      suppressClick = true;
      button.classList.add('selected');
      button.setPointerCapture(event.pointerId);
    }, 350);
  });
  button.addEventListener('pointermove', event => {
    if (!start) return;
    if (!dragging && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearTimeout(timer);
    if (!dragging) return;
    target?.classList.remove('drop-target');
    target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.seat');
    if (target && Number(target.dataset.player) !== id && teamOf(Number(target.dataset.player)) === teamOf(id)) target.classList.add('drop-target');
  });
  const finish = event => {
    clearTimeout(timer);
    start = null;
    if (!dragging) return;
    dragging = false;
    target?.classList.remove('drop-target');
    if (event.type === 'pointerup' && target && target !== button) dispatch({ type: 'swap', from: id, to: Number(target.dataset.player) });
    target = null;
    button.classList.remove('selected');
    render();
    setTimeout(() => { suppressClick = false; }, 0);
  };
  button.addEventListener('pointerup', finish);
  button.addEventListener('pointercancel', finish);
  button.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  button.addEventListener('contextmenu', event => event.preventDefault());
}

function openDialog({ title, content, primary = 'Confirmar', secondary = 'Cancelar', onConfirm }) {
  stopAudio();
  dialogFocus = document.activeElement;
  if ($('app-dialog').open) $('app-dialog').close();
  $('dialog-title').textContent = title;
  $('dialog-content').replaceChildren();
  if (typeof content === 'string') {
    const paragraph = document.createElement('p');
    paragraph.textContent = content;
    $('dialog-content').append(paragraph);
  } else $('dialog-content').append(content);
  $('dialog-primary').textContent = primary;
  $('dialog-secondary').textContent = secondary;
  dialogCallback = onConfirm;
  $('app-dialog').showModal();
  $('dialog-secondary').focus();
}
function closeDialog() { $('app-dialog').close(); dialogFocus?.focus({ preventScroll: true }); }
$('dialog-form').addEventListener('submit', event => {
  event.preventDefault();
  const callback = dialogCallback;
  // Read form values before closing; nested dialogs can reuse the same component.
  if (callback?.() !== false) closeDialog();
});
$('dialog-secondary').addEventListener('click', closeDialog);
$('dialog-close').addEventListener('click', closeDialog);
$('app-dialog').addEventListener('cancel', () => { stopAudio(); });
$('app-dialog').addEventListener('click', event => {
  if (event.target === $('app-dialog')) {
    const rect = $('app-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
  }
});

function block(title, child, description = '') {
  const section = document.createElement('section');
  section.className = 'setting-block';
  const heading = document.createElement('h3'); heading.textContent = title;
  section.append(heading, child);
  if (description) { const small = document.createElement('small'); small.textContent = description; section.append(small); }
  return section;
}
function segments(id, values, selectedValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'segments'; wrapper.id = id; wrapper.setAttribute('role', 'group');
  values.forEach(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.value = value; button.textContent = label;
    button.setAttribute('aria-pressed', String(value === selectedValue));
    button.addEventListener('click', () => {
      for (const other of wrapper.children) other.setAttribute('aria-pressed', String(other === button));
    });
    wrapper.append(button);
  });
  return wrapper;
}
const selectedValue = id => $(id).querySelector('[aria-pressed=true]').dataset.value;
function actionButton(label, id, handler) {
  const button = document.createElement('button'); button.type = 'button';
  button.className = 'button outline'; button.textContent = label; button.id = id;
  button.addEventListener('click', handler); return button;
}
function checkbox(id, label, value) {
  const wrapper = document.createElement('label'); wrapper.className = 'check-label';
  const input = document.createElement('input'); input.type = 'checkbox'; input.id = id; input.checked = value;
  wrapper.append(input, document.createTextNode(label)); return wrapper;
}

function openTableSettings() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  content.append(
    block('Jogadores por time', segments('team-size', [[1, '1 contra 1'], [2, 'Dupla'], [3, 'Trio']], state.size)),
    block('Limite da partida', segments('target-score', [[12, '12 pontos'], [15, '15 pontos']], state.target)),
    block('Sentido da mesa', segments('table-direction', [[1, 'Horário'], [-1, 'Anti-horário']], state.direction), 'Define para quem o baralho passa.'),
  );
  const actions = document.createElement('div'); actions.className = 'setting-actions';
  actions.append(
    actionButton('Zerar vitórias', 'reset-wins', () => { closeDialog(); requestResetWins(); }),
  );
  content.append(actions);
  openDialog({ title: 'Configurações da mesa', content, primary: 'Salvar', onConfirm: () => {
    // Validate all fields atomically, so an invalid target cannot partly save the form.
    try {
      const latest = storage.latest();
      if (latest) state = latest;
      let next = reduce(state, { type: 'target', value: Number(selectedValue('target-score')) });
      next = reduce(next, { type: 'size', value: Number(selectedValue('team-size')) });
      next = reduce(next, { type: 'direction', value: Number(selectedValue('table-direction')) });
      storage.save(next); state = next; selected = null; render(); toast('Configurações da mesa salvas.');
    } catch (error) { toast(error.message); return false; }
  } });
}

function requestResetWins() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  const p = document.createElement('p'); p.textContent = 'As vitórias dos dois lados serão zeradas. Os pontos e as jogadas da partida atual serão mantidos.';
  content.append(p, checkbox('clear-on-reset', 'Limpar histórico das partidas anteriores', true));
  openDialog({ title: 'Zerar vitórias?', content, primary: 'Zerar vitórias', onConfirm: () => {
    if (!dispatch({ type: 'reset-wins', clearHistory: $('clear-on-reset').checked })) return false;
    toast('Vitórias zeradas.');
  } });
}

function openPreferences() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  const colors = document.createElement('select'); colors.id = 'color-theme'; colors.setAttribute('aria-label', 'Esquema de cores');
  const names = ['Verde clássico', 'Azul oceano', 'Roxo', 'Terracota', 'Grafite', 'Preto'];
  THEMES.forEach((theme, index) => { const option = document.createElement('option'); option.value = theme; option.textContent = names[index]; colors.append(option); });
  colors.value = state.preferences.theme;
  content.append(
    block('Esquema de cores', colors),
    block('Tamanho de fonte', segments('font-size', [['small', 'Pequena'], ['large', 'Grande']], state.preferences.font)),
    block('Tela sempre acesa', checkbox('keep-awake', 'Manter a tela acesa', state.preferences.awake),
      'wakeLock' in navigator ? 'Disponível quando o Safari permite. Ao sair do marcador, o bloqueio automático volta ao normal.' : 'Este navegador não oferece o recurso de manter a tela acesa. O marcador continua funcionando normalmente.'),
    block('Aviso na reta final', checkbox('sound-enabled', 'Assovio e placar falado', state.preferences.sound), 'Anuncia ao chegar a 11 (até 12) ou 14 (até 15) e a cada nova marcação na reta final. Confira o volume e uma voz em português no iPhone.'),
  );
  const actions = document.createElement('div'); actions.className = 'setting-actions';
  actions.append(actionButton('Testar aviso sonoro', 'test-audio', () => {
      const scores = [0, 0], ours = bottomTeam(state);
      scores[ours] = state.target - 1; scores[1 - ours] = state.target - 2;
      announce(scoreSpeech(state, scores), true);
    }),
    actionButton('Ajude o projeto', 'support-button', () => { closeDialog(); showSupport(); }));
  content.append(actions);
  openDialog({ title: 'Configurações', content, primary: 'Salvar', onConfirm: () => {
    return dispatch({ type: 'preferences', value: { theme: colors.value,
      font: selectedValue('font-size'), awake: $('keep-awake').checked, sound: $('sound-enabled').checked } });
  } });
}

function renderHistory() {
  const ours = bottomTeam(state), theirs = 1 - ours;
  const ourLabel = labelFor(state, ours), theirLabel = labelFor(state, theirs);
  $('history-summary').replaceChildren();
  const title = document.createElement('h2'); title.textContent = `Partida ${state.game} · Em andamento`;
  const score = document.createElement('strong'); score.textContent = `${ourLabel} ${state.scores[ours]} × ${state.scores[theirs]} ${theirLabel}`;
  const wins = document.createElement('p'); wins.textContent = `Vitórias: ${ourLabel} ${state.wins[ours]} · ${theirLabel} ${state.wins[theirs]}`;
  $('history-summary').append(title, score, wins);
  const openGames = new Set([...$('history-games').querySelectorAll('details[open]')].map(el => Number(el.dataset.game)));
  const numbers = [...new Set([state.game, ...state.results.map(result => result.game), ...state.events.map(event => event.game)])].sort((a, b) => b - a);
  $('history-games').replaceChildren();
  for (const number of numbers) {
    const detail = document.createElement('details'); detail.className = 'history-game'; detail.dataset.game = number;
    detail.open = number === state.game || openGames.has(number);
    const summary = document.createElement('summary'), labels = document.createElement('div');
    const heading = document.createElement('strong'); heading.textContent = `Partida ${number}`;
    const result = state.results.find(item => item.game === number);
    const subtitle = document.createElement('small'); subtitle.textContent = result
      ? `${victoryMessage(state, result.winner, result.size)} · ${result.scores[ours]} × ${result.scores[theirs]} · ${formatTime(result.timestamp)}` : 'Em andamento';
    labels.append(heading, subtitle); summary.append(labels); detail.append(summary);
    const events = state.events.filter(event => event.game === number).sort((a, b) => b.id - a.id);
    if (!events.length) { const empty = document.createElement('p'); empty.className = 'empty-history'; empty.textContent = 'Nenhum evento nesta partida.'; detail.append(empty); }
    events.forEach(event => {
      const row = document.createElement('div'); row.className = `history-event${event.undone ? ' undone' : ''}`;
      const copy = document.createElement('div'), strong = document.createElement('strong'), sub = document.createElement('p');
      if (event.type === 'score') {
        strong.textContent = labelFor(state, event.team, result?.size ?? state.size);
        sub.textContent = `${formatTime(event.timestamp)} · ${event.undone ? 'Jogada desfeita' : `placar após a ação: ${event.after}`}`;
        const delta = document.createElement('span'); delta.className = 'delta'; delta.textContent = `${event.delta > 0 ? '+' : '−'}${Math.abs(event.delta)} ${Math.abs(event.delta) === 1 ? 'ponto' : 'pontos'}${event.undone ? ' ↶' : ''}`;
        copy.append(strong, sub); row.append(copy, delta);
      } else {
        strong.textContent = event.reason === 'manual' ? 'Vez passada manualmente' : 'Baralho avançou após a pontuação';
        sub.textContent = `${formatTime(event.timestamp)} · Jogador ${event.from} → Jogador ${event.to}`;
        copy.append(strong, sub); row.append(copy);
      }
      detail.append(row);
    });
    $('history-games').append(detail);
    if (number === state.game) {
      const clear = actionButton('Limpar histórico', 'clear-history-button', () => openDialog({
        title: 'Limpar histórico?', content: 'As partidas anteriores e suas jogadas serão excluídas. A partida em andamento, o placar e as vitórias serão mantidos.',
        primary: 'Limpar', onConfirm: () => { if (!dispatch({ type: 'clear-history' })) return false; toast('Histórico limpo.'); },
      }));
      clear.classList.add('clear-history'); $('history-games').append(clear);
    }
  }
}

function setPage(value) {
  stopAudio(); page = value;
  $('score-view').hidden = value !== 'score'; $('history-view').hidden = value !== 'history';
  $('history-button').hidden = value === 'history';
  render();
  window.scrollTo(0, 0);
  syncWakeLock();
}

function recover() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  const p = document.createElement('p'); p.textContent = 'Os dados salvos não puderam ser lidos. Reiniciar substitui o marcador salvo e apaga o placar, as vitórias e o histórico. Deseja começar novamente?';
  content.append(p);
  openDialog({ title: 'Reiniciar marcador?', content, primary: 'Reiniciar', onConfirm: () => {
    try { state = storage.replace(initialState()); hand = 1; selected = null; render(); }
    catch { toast('Não foi possível gravar no navegador. Os dados originais foram mantidos.'); return false; }
  } });
}

function stopAudio() { window.speechSynthesis?.cancel(); }
function announce(message, force = false) {
  if (!force && !state.preferences.sound) return;
  stopAudio();
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audio ||= new AudioContext();
      audio.resume().catch(() => {});
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.frequency.setValueAtTime(1400, audio.currentTime);
      oscillator.frequency.linearRampToValueAtTime(2100, audio.currentTime + .14);
      gain.gain.setValueAtTime(.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.1, audio.currentTime + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .19);
      oscillator.start(); oscillator.stop(audio.currentTime + .2);
    }
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message); utterance.lang = 'pt-BR'; utterance.rate = 1;
      const voice = speechSynthesis.getVoices().find(item => item.lang.toLowerCase() === 'pt-br')
        || speechSynthesis.getVoices().find(item => item.lang.startsWith('pt'));
      if (voice) utterance.voice = voice;
      utterance.onerror = event => { if (!['interrupted', 'canceled'].includes(event.error)) toast('O Safari não reproduziu a voz. Confira o volume e as vozes do iPhone.'); };
      speechSynthesis.speak(utterance);
    } else toast(message);
  } catch { toast(message); }
}

async function syncWakeLock() {
  if (!state.preferences.awake || page !== 'score' || document.visibilityState !== 'visible') {
    if (wakeLock) { const lock = wakeLock; wakeLock = null; await lock.release().catch(() => {}); }
    return;
  }
  if (wakeLock || wakePending || !('wakeLock' in navigator)) return;
  wakePending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!state.preferences.awake || page !== 'score' || document.visibilityState !== 'visible') { await lock.release(); return; }
    wakeLock = lock;
    lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
  } catch { /* System restrictions never prevent scoring. */ }
  finally { wakePending = false; }
}

function showSupport() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  const p = document.createElement('p'); p.textContent = 'Pague uma cervejinha pro desenvolvedor e ajude o placar a continuar evoluindo. 🍺';
  const image = document.createElement('img'); image.src = './assets/toast_mascot.png'; image.alt = ''; image.className = 'support-image';
  const code = document.createElement('p'); code.className = 'pix-code'; code.textContent = pix;
  content.append(p, image, code, actionButton('Copiar PIX', 'copy-pix', async () => {
    try { await navigator.clipboard.writeText(pix); toast('PIX copiado.'); }
    catch { const range = document.createRange(); range.selectNodeContents(code); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); toast('Selecione e copie o código PIX acima.'); }
  }));
  openDialog({ title: 'Ajude o projeto', content, primary: 'Valeu! 🍻', secondary: 'Continuar jogando', onConfirm: () => { toast('Valeu por apoiar o projeto!'); } });
}

HAND_VALUES.forEach(value => {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.value = value; button.textContent = value;
  button.setAttribute('aria-label', `${value} ${value === 1 ? 'ponto' : 'pontos'}`);
  button.addEventListener('click', () => { hand = value; render(); }); $('hand-values').append(button);
});
for (const [name, side] of [['ours', 0], ['theirs', 1]]) {
  $(`add-${name}`).addEventListener('click', () => dispatch({ type: 'score', side, delta: hand }));
}
$('undo-button').addEventListener('click', () => openDialog({ title: 'Desfazer última jogada', content: 'Deseja desfazer a última jogada?', primary: 'Desfazer', onConfirm: () => dispatch({ type: 'undo' }) }));
$('confirm-button').addEventListener('click', () => {
  if (dispatch({ type: 'confirm' })) { toast('Partida confirmada. O placar foi reiniciado.'); if (state.completed % 8 === 0) showSupport(); }
});
$('pass-button').addEventListener('click', () => dispatch({ type: 'pass' }));
$('table-settings-button').addEventListener('click', openTableSettings);
$('settings-button').addEventListener('click', openPreferences);
$('history-button').addEventListener('click', () => { setPage('history'); history.pushState({ truco: 'history' }, '', '#historico'); });
$('back-button').addEventListener('click', () => { if (location.hash === '#historico') history.back(); else setPage('score'); });
$('help-button').addEventListener('click', () => { stopAudio(); tutorial.open(page === 'history' ? historySteps(state.size) : scoreSteps(winner(state) !== -1, state.size)); });
$('recovery-button').addEventListener('click', recover);
window.addEventListener('popstate', () => setPage(location.hash === '#historico' ? 'history' : 'score'));
window.addEventListener('storage', event => {
  if (event.key !== storage.key && event.key !== null) return;
  try {
    state = event.newValue ? validateState(JSON.parse(event.newValue)) : initialState();
    storage.error = null; storage.blocked = false; hand = 1; selected = null;
    stopAudio(); render(); syncWakeLock(); toast('Marcador atualizado por outra aba.');
  } catch { storage.error = 'Outra aba gravou dados ilegíveis. O placar desta aba foi mantido, mas não pode ser salvo.'; storage.blocked = true; render(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); syncWakeLock(); });
document.addEventListener('pointerdown', () => syncWakeLock(), { passive: true });
window.addEventListener('resize', renderSeats);
window.addEventListener('pagehide', () => { stopAudio(); wakeLock?.release().catch(() => {}); wakeLock = null; });
window.addEventListener('pageshow', () => syncWakeLock());
render();
syncWakeLock();
// Every reload starts at the score, even if a history URL was bookmarked.
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* Offline caching is optional. */ });
}
