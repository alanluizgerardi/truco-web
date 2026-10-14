// Pure match rules. Identities stay fixed; labels follow table position and size.
export const HAND_VALUES = [1, 3, 6, 9, 12];
export const THEMES = ['classic', 'ocean', 'purple', 'terracotta', 'graphite', 'black'];
export const VERSION = 1;

export function initialState() {
  return {
    version: VERSION,
    revision: 0,
    target: 12,
    size: 2,
    scores: [0, 0],
    wins: [0, 0],
    game: 1,
    completed: 0,
    order: [1, 2, 3, 4],
    rotation: 0,
    direction: -1,
    dealer: 1,
    nextId: 1,
    events: [],
    results: [],
    preferences: { theme: 'black', font: 'small', awake: true, sound: true, themeRevision: 1 },
    tutorials: [],
  };
}

export const teamOf = id => (id - 1) % 2;
export function bottomTeam(state) {
  return teamOf(state.order[(state.size + state.rotation) % state.order.length]);
}
export function labelFor(state, team, size = state.size) {
  const ours = team === bottomTeam(state);
  return size === 1 ? (ours ? 'Eu' : 'Ele') : (ours ? 'Nós' : 'Eles');
}
export function victoryMessage(state, team, size = state.size) {
  return { Eu: 'Eu venci', Ele: 'Ele venceu', Nós: 'Nós vencemos', Eles: 'Eles venceram' }[labelFor(state, team, size)];
}
export function scoreSpeech(state, scores = state.scores) {
  const ours = bottomTeam(state);
  return `Placar: ${scores[ours]} para ${state.size === 1 ? 'mim' : 'nós'} e ${scores[1 - ours]} para ${state.size === 1 ? 'ele' : 'eles'}.`;
}
export const winner = state => state.scores.findIndex(score => score >= state.target);
export const lastPlay = state => [...state.events].reverse().find(
  event => event.game === state.game && event.type === 'score' && !event.undone,
);

function pass(state, reason, timestamp, playId = null) {
  const from = state.order.includes(state.dealer) ? state.dealer : state.order[0];
  const index = state.order.indexOf(from);
  const to = state.order[(index + state.direction + state.order.length) % state.order.length];
  state.dealer = to;
  state.events.push({ id: state.nextId++, game: state.game, type: 'dealer',
    from, to, reason, playId, timestamp });
}

export function targetError(state, target) {
  if (![12, 15].includes(target)) return 'Escolha 12 ou 15 pontos.';
  if (target === state.target) return null;
  if (state.scores.some(score => score >= target)) {
    return 'Um time já alcançou esse limite. Conclua a partida antes de reduzi-lo.';
  }
  if (state.events.some(event => event.game === state.game && event.type === 'score'
      && !event.undone && event.after > target)) {
    return 'Há jogadas acima desse limite no histórico atual. Conclua a partida antes de reduzi-lo.';
  }
  return null;
}

// Returns a new state; rejecting an action leaves the old state untouched.
export function reduce(state, action, timestamp = new Date().toISOString()) {
  const next = JSON.parse(JSON.stringify(state));
  switch (action.type) {
    case 'score': {
      const { team, delta } = action;
      if (![0, 1].includes(team) || (delta !== -1 && !HAND_VALUES.includes(delta))) {
        throw new Error('Pontuação inválida.');
      }
      if (delta > 0 && winner(next) !== -1) {
        throw new Error('Confirme a partida antes de adicionar pontos.');
      }
      if (delta < 0 && next.scores[team] === 0) return state;
      const before = next.scores[team];
      const after = Math.max(0, Math.min(next.target, before + delta));
      const id = next.nextId++;
      next.events.push({ id, game: next.game, type: 'score', team, delta,
        before, after, undone: false, timestamp });
      next.scores[team] = after;
      if (delta > 0) pass(next, 'score', timestamp, id);
      break;
    }
    case 'undo': {
      const play = lastPlay(next);
      if (!play) throw new Error('Não há jogadas para desfazer.');
      next.scores[play.team] = play.before;
      play.undone = true;
      const dealerEvents = next.events.filter(event => event.game === next.game && event.type === 'dealer');
      const automatic = dealerEvents.find(event => event.playId === play.id);
      if (automatic) {
        // A later manual pass must not be reverted with the score.
        if (dealerEvents.at(-1).id === automatic.id) {
          next.dealer = next.order.includes(automatic.from) ? automatic.from : next.order[0];
        }
        next.events = next.events.filter(event => event.id !== automatic.id);
      }
      break;
    }
    case 'confirm': {
      const won = winner(next);
      if (won === -1) throw new Error('Nenhum time alcançou o limite ainda.');
      next.results.push({ game: next.game, scores: [...next.scores], winner: won,
        target: next.target, size: next.size, bottom: bottomTeam(next), timestamp });
      next.wins[won]++;
      next.completed++;
      next.game++;
      next.scores = [0, 0];
      break;
    }
    case 'pass':
      if (winner(next) !== -1) throw new Error('Confirme a partida antes de passar o baralho.');
      pass(next, 'manual', timestamp);
      break;
    case 'rotate':
      next.rotation++;
      break;
    case 'swap': {
      const { from, to } = action;
      if (!next.order.includes(from) || !next.order.includes(to)) throw new Error('Lugar inválido.');
      if (teamOf(from) !== teamOf(to)) throw new Error('Você só pode trocar jogadores da mesma equipe.');
      const first = next.order.indexOf(from);
      const second = next.order.indexOf(to);
      [next.order[first], next.order[second]] = [next.order[second], next.order[first]];
      break;
    }
    case 'size': {
      if (![1, 2, 3].includes(action.value)) throw new Error('Escolha 1 contra 1, dupla ou trio.');
      if (action.value === next.size) return state;
      const bottom = bottomTeam(next);
      next.size = action.value;
      next.order = Array.from({ length: next.size * 2 }, (_, index) => index + 1);
      next.rotation %= next.order.length;
      if (bottomTeam(next) !== bottom) next.rotation = (next.rotation + 1) % next.order.length;
      if (!next.order.includes(next.dealer)) next.dealer = next.order[0];
      break;
    }
    case 'target': {
      const error = targetError(next, action.value);
      if (error) throw new Error(error);
      next.target = action.value;
      break;
    }
    case 'direction':
      if (![-1, 1].includes(action.value)) throw new Error('Sentido inválido.');
      next.direction = action.value;
      break;
    case 'reset-wins':
      next.wins = [0, 0];
      if (action.clearHistory) clearHistory(next);
      break;
    case 'clear-history':
      clearHistory(next);
      break;
    case 'preferences': {
      const values = action.value;
      if (!THEMES.includes(values.theme) || !['small', 'large'].includes(values.font)
          || typeof values.awake !== 'boolean' || typeof values.sound !== 'boolean') {
        throw new Error('Preferências inválidas.');
      }
      next.preferences = { ...values, themeRevision: 1 };
      break;
    }
    case 'tutorial-seen':
      if (!next.tutorials.includes(action.id)) next.tutorials.push(action.id);
      break;
    default:
      throw new Error('Ação inválida.');
  }
  next.revision++;
  return next;
}

function clearHistory(state) {
  state.events = state.events.filter(event => event.game === state.game);
  state.results = [];
}

export function announcement(before, after, team) {
  if (before.game !== after.game || before.target !== after.target || winner(before) !== -1
      || after.scores[team] <= before.scores[team]) return null;
  const alert = after.target - 1;
  if (![...before.scores, ...after.scores].includes(alert)) return null;
  if (after.scores.every(score => score === alert)) return `Tá ${alert} a ${alert}!`;
  return scoreSpeech(after);
}

// Validate local data before rendering or writing over a saved match.
export function validateState(state) {
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const pair = (value, max = Number.MAX_SAFE_INTEGER) => Array.isArray(value)
    && value.length === 2 && value.every(item => integer(item) && item <= max);
  const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const bad = () => { throw new Error('Os dados do marcador de truco não são válidos.'); };
  if (!state || state.version !== VERSION || !integer(state.revision)
      || ![12, 15].includes(state.target) || ![1, 2, 3].includes(state.size)
      || !pair(state.scores, state.target) || !pair(state.wins)
      || !integer(state.game) || state.game < 1 || !integer(state.completed)
      || !integer(state.nextId) || state.nextId < 1 || !integer(state.rotation)
      || ![-1, 1].includes(state.direction) || !Array.isArray(state.order)
      || state.order.length !== state.size * 2 || new Set(state.order).size !== state.order.length
      || !state.order.every(id => Number.isInteger(id) && id >= 1 && id <= state.size * 2)
      || !state.order.includes(state.dealer) || !Array.isArray(state.events)
      || !Array.isArray(state.results) || !Array.isArray(state.tutorials)
      || !state.tutorials.every(id => typeof id === 'string' && id.length < 100)) bad();
  const p = state.preferences;
  if (!p || !THEMES.includes(p.theme) || !['small', 'large'].includes(p.font)
      || typeof p.awake !== 'boolean' || typeof p.sound !== 'boolean') bad();
  const ids = new Set();
  for (const event of state.events) {
    if (!event || !integer(event.id) || event.id < 1 || event.id >= state.nextId
        || ids.has(event.id) || !integer(event.game) || event.game < 1 || event.game > state.game
        || !time(event.timestamp)) bad();
    ids.add(event.id);
    if (event.type === 'score') {
      if (![0, 1].includes(event.team) || (event.delta !== -1 && !HAND_VALUES.includes(event.delta))
          || !integer(event.before) || event.before > 15 || !integer(event.after) || event.after > 15
          || typeof event.undone !== 'boolean') bad();
    } else if (event.type === 'dealer') {
      if (![event.from, event.to].every(id => Number.isInteger(id) && id >= 1 && id <= 6)
          || !['manual', 'score'].includes(event.reason)
          || (event.reason === 'manual' && event.playId !== null)
          || (event.reason === 'score' && (!integer(event.playId) || event.playId < 1))) bad();
    } else bad();
  }
  const gameNumbers = new Set();
  for (const result of state.results) {
    if (!result || !integer(result.game) || result.game < 1 || result.game >= state.game
        || gameNumbers.has(result.game) || ![0, 1].includes(result.winner)
        || ![12, 15].includes(result.target) || !pair(result.scores, result.target)
        || result.scores[result.winner] !== result.target
        || result.scores[1 - result.winner] >= result.target
        || ![1, 2, 3].includes(result.size) || ![0, 1].includes(result.bottom)
        || !time(result.timestamp)) bad();
    gameNumbers.add(result.game);
  }
  if (state.scores.every(score => score >= state.target)) bad();
  // The persisted current score must agree with the surviving plays.
  for (const team of [0, 1]) {
    const plays = state.events.filter(e => e.game === state.game && e.type === 'score'
      && e.team === team && !e.undone);
    if ((plays.at(-1)?.after ?? 0) !== state.scores[team]) bad();
  }
  return state;
}
