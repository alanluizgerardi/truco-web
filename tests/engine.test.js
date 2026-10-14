import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduce, validateState, bottomTeam, labelFor, winner,
  announcement, lastPlay } from '../engine.js';

const time = '2026-10-14T12:00:00.000Z';
const act = (state, action) => validateState(reduce(state, action, time));
const score = (state, team, delta) => act(state, { type: 'score', team, delta });

test('default is an immediately usable standalone double table', () => {
  const state = validateState(initialState());
  assert.equal(state.size, 2); assert.equal(bottomTeam(state), 0);
  assert.deepEqual(state.scores, [0, 0]); assert.equal(state.dealer, 1);
});

for (const size of [1, 2, 3]) {
  for (const direction of [-1, 1]) {
    test(`${size} per team, direction ${direction}: each seat gets the deck`, () => {
      let state = act(initialState(), { type: 'size', value: size });
      state = act(state, { type: 'direction', value: direction });
      const first = state.dealer, seen = new Set();
      for (let i = 0; i < size * 2; i++) { seen.add(state.dealer); state = act(state, { type: 'pass' }); }
      assert.equal(seen.size, size * 2); assert.equal(state.dealer, first);
    });
    test(`${size} per team: rotation follows the bottom seat without changing points`, () => {
      let state = act(initialState(), { type: 'size', value: size });
      state = score(state, 0, 3); state = score(state, 1, 6);
      for (let i = 0; i < size * 2; i++) {
        const before = bottomTeam(state);
        state = act(state, { type: 'rotate' });
        assert.notEqual(bottomTeam(state), before);
        assert.equal(labelFor(state, bottomTeam(state)), size === 1 ? 'Eu' : 'Nós');
        assert.deepEqual(state.scores, [3, 6]);
      }
    });
  }
}

test('valid hand values, target cap and exact undo at the cap', () => {
  let state = score(initialState(), 0, 9);
  state = score(state, 0, 6);
  assert.equal(state.scores[0], 12); assert.equal(winner(state), 0);
  assert.throws(() => score(state, 1, 1), /Confirme/);
  state = act(state, { type: 'undo' });
  assert.equal(state.scores[0], 9); assert.equal(state.dealer, 4);
  assert.equal(state.events.filter(e => e.undone).length, 1);
  assert.throws(() => score(state, 0, 2), /inválida/);
  assert.throws(() => score(state, 2, 1), /inválida/);
});

test('minus does not pass the deck; undo reverses both minus and positive play', () => {
  let state = score(initialState(), 0, 3);
  const dealer = state.dealer;
  state = score(state, 0, -1); assert.equal(state.dealer, dealer);
  assert.equal(state.scores[0], 2);
  state = act(state, { type: 'undo' }); assert.equal(state.scores[0], 3);
  state = act(state, { type: 'undo' }); assert.equal(state.scores[0], 0);
  assert.equal(state.dealer, 1); assert.equal(lastPlay(state), undefined);
  assert.equal(score(state, 0, -1), state);
});

test('undo preserves a later manual dealer pass', () => {
  let state = score(initialState(), 0, 3);
  state = act(state, { type: 'pass' }); const dealer = state.dealer;
  state = act(state, { type: 'undo' });
  assert.equal(state.dealer, dealer); assert.equal(state.scores[0], 0);
  assert.equal(state.events.filter(e => e.type === 'dealer').length, 1);
});

test('resize and undo with an old dealer keeps a valid seat and all history', () => {
  let state = act(initialState(), { type: 'size', value: 3 });
  while (state.dealer !== 6) state = act(state, { type: 'pass' });
  state = score(state, 0, 3);
  const events = state.events, bottom = bottomTeam(state);
  state = act(state, { type: 'size', value: 1 });
  assert.equal(bottomTeam(state), bottom); assert.deepEqual(state.events, events);
  state = act(state, { type: 'undo' });
  assert.ok(state.order.includes(state.dealer));
  assert.deepEqual(state.scores, [0, 0]);
});

test('only partners can swap and identity and dealer are preserved', () => {
  let state = score(initialState(), 0, 3);
  const dealer = state.dealer;
  state = act(state, { type: 'swap', from: 1, to: 3 });
  assert.deepEqual(state.order, [3, 2, 1, 4]); assert.equal(state.dealer, dealer);
  assert.deepEqual(state.scores, [3, 0]);
  assert.throws(() => act(state, { type: 'swap', from: 1, to: 2 }), /mesma equipe/);
});

test('confirm records the match and keeps settings/dealer in next match', () => {
  let state = act(initialState(), { type: 'target', value: 15 });
  state = act(state, { type: 'size', value: 3 });
  state = score(state, 1, 12); state = score(state, 1, 3);
  const dealer = state.dealer;
  state = act(state, { type: 'confirm' });
  assert.equal(state.game, 2); assert.equal(state.completed, 1);
  assert.deepEqual(state.wins, [0, 1]); assert.deepEqual(state.scores, [0, 0]);
  assert.deepEqual(state.results[0].scores, [0, 15]);
  assert.equal(state.target, 15); assert.equal(state.size, 3); assert.equal(state.dealer, dealer);
  assert.throws(() => act(state, { type: 'confirm' }), /Nenhum/);
  assert.throws(() => act(state, { type: 'undo' }), /Não há/);
});

test('lower target checks current scores AND surviving current history', () => {
  let state = act(initialState(), { type: 'target', value: 15 });
  state = score(state, 0, 12);
  assert.throws(() => act(state, { type: 'target', value: 12 }), /Conclua/);
  state = score(state, 0, 1); state = score(state, 0, -1); state = score(state, 0, -1);
  assert.equal(state.scores[0], 11);
  assert.throws(() => act(state, { type: 'target', value: 12 }), /histórico/);
  state = act(state, { type: 'undo' }); state = act(state, { type: 'undo' });
  state = act(state, { type: 'undo' }); state = score(state, 0, -1);
  state = act(state, { type: 'target', value: 12 }); assert.equal(state.target, 12);
});

test('clear history and reset wins preserve current match and lifetime count', () => {
  let state = score(initialState(), 0, 12); state = act(state, { type: 'confirm' });
  state = score(state, 1, 3);
  let reset = act(state, { type: 'reset-wins', clearHistory: false });
  assert.deepEqual(reset.wins, [0, 0]); assert.equal(reset.results.length, 1);
  const cleared = act(state, { type: 'clear-history' });
  assert.deepEqual(cleared.wins, [1, 0]); assert.equal(cleared.results.length, 0);
  assert.ok(cleared.events.every(e => e.game === 2)); assert.deepEqual(cleared.scores, [0, 3]);
  reset = act(state, { type: 'reset-wins', clearHistory: true });
  assert.deepEqual(reset.wins, [0, 0]); assert.equal(reset.results.length, 0);
  assert.equal(reset.completed, 1); assert.equal(reset.game, 2);
});

for (const target of [12, 15]) for (const size of [1, 2]) {
  test(`speech triggers at ${target - 1} with ${size} per side, subsequent scores and winning hand`, () => {
    let before = act(initialState(), { type: 'target', value: target });
    before = act(before, { type: 'size', value: size });
    before = score(before, 0, 9); if (target === 15) before = score(before, 0, 3);
    before = score(before, 0, 1);
    let after = score(before, 0, 1);
    assert.match(announcement(before, after, 0), size === 1 ? /para mim/ : /para nós/);
    before = after; after = score(before, 1, 3);
    assert.match(announcement(before, after, 1), size === 1 ? /para ele\./ : /para eles/);
    before = after; after = score(before, 0, 1);
    assert.match(announcement(before, after, 0), /Placar/);
    assert.equal(announcement(after, after, 0), null);
  });
}

test('malformed or unsupported saved data is rejected before use', () => {
  for (const change of [{ version: 99 }, { target: 13 }, { size: 4 }, { scores: [1, 0] },
    { dealer: 8 }, { order: [1, 1, 3, 4] }, { wins: [-1, 0] }, { events: [{}] },
    { preferences: { theme: '<script>' } }, { revision: NaN }]) {
    assert.throws(() => validateState({ ...initialState(), ...change }), /válido/);
  }
});

test('rules never mutate the incoming state', () => {
  const state = initialState(), copy = JSON.stringify(state);
  score(state, 0, 3); assert.equal(JSON.stringify(state), copy);
  assert.throws(() => score(state, 0, 8)); assert.equal(JSON.stringify(state), copy);
});

test('long match session survives JSON round trips, target/size changes and undo', () => {
  let state = initialState();
  for (let i = 0; i < 180; i++) {
    state = act(state, { type: 'size', value: (i % 3) + 1 });
    state = score(state, i % 2, 3);
    state = act(state, { type: 'undo' });
    state = score(state, i % 2, 12);
    state = act(state, { type: 'confirm' });
    state = validateState(JSON.parse(JSON.stringify(state)));
  }
  assert.deepEqual(state.wins, [90, 90]); assert.equal(state.results.length, 180);
});
