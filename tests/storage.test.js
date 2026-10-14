import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchStorage, storageKey } from '../storage.js';
import { initialState, reduce } from '../engine.js';

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

test('a refresh restores the entire score, table, wins and history', () => {
  const memory = new MemoryStorage(), first = new MatchStorage(memory, 'test');
  let state = first.load();
  for (const action of [{ type: 'score', team: 0, delta: 12 }, { type: 'confirm' },
    { type: 'size', value: 3 }, { type: 'rotate' }, { type: 'score', team: 1, delta: 6 },
    { type: 'preferences', value: { theme: 'ocean', font: 'large', awake: false, sound: true } }]) {
    state = reduce(state, action); first.save(state);
  }
  const refreshed = new MatchStorage(memory, 'test');
  assert.deepEqual(refreshed.load(), state);
});

test('existing saved matches switch to Black once, preserving game and later preferences', () => {
  const memory = new MemoryStorage();
  let old = reduce(initialState(), { type: 'score', team: 0, delta: 12 });
  old = reduce(old, { type: 'confirm' });
  old = reduce(old, { type: 'score', team: 1, delta: 3 });
  old.preferences.theme = 'classic';
  delete old.preferences.themeRevision;
  memory.setItem('test', JSON.stringify(old));
  const storage = new MatchStorage(memory, 'test');
  const migrated = storage.load();
  assert.equal(migrated.preferences.theme, 'black');
  assert.deepEqual(migrated.scores, old.scores);
  assert.deepEqual(migrated.wins, old.wins);
  assert.deepEqual(migrated.events, old.events);
  assert.deepEqual(migrated.results, old.results);
  assert.equal(migrated.dealer, old.dealer);
  const custom = reduce(migrated, { type: 'preferences', value: {
    ...migrated.preferences, theme: 'ocean',
  } });
  storage.save(custom);
  assert.deepEqual(new MatchStorage(memory, 'test').load(), custom);
});

test('different GitHub project paths never share a match', () => {
  assert.notEqual(storageKey('/one/'), storageKey('/two/'));
  assert.equal(storageKey('/one/'), storageKey('/one/index.html'));
  assert.equal(storageKey('/one'), storageKey('/one/'));
});

test('unavailable/full browser storage reports failures', () => {
  const storage = new MatchStorage({ getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); } }, 'test');
  const state = storage.load(); assert.ok(storage.error);
  assert.equal(storage.save(state), false); assert.ok(storage.error);
  assert.equal(storage.latest(), null);
});

test('corrupt original data is retained until an explicit replacement', () => {
  const memory = new MemoryStorage(); memory.setItem('test', '{broken');
  const storage = new MatchStorage(memory, 'test'), state = storage.load();
  assert.equal(storage.blocked, true); assert.equal(storage.corrupt, '{broken');
  assert.throws(() => storage.save(state)); assert.equal(memory.getItem('test'), '{broken');
  storage.replace(initialState()); assert.equal(storage.blocked, false);
  assert.deepEqual(storage.load(), initialState());
});

test('replacement failure preserves original saved data and blocked state', () => {
  const memory = new MemoryStorage(); memory.setItem('test', 'broken');
  const storage = new MatchStorage(memory, 'test'); storage.load();
  memory.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => storage.replace(initialState()));
  assert.equal(memory.getItem('test'), 'broken'); assert.equal(storage.blocked, true);
});

test('a second tab reads the latest match before its next action', () => {
  const memory = new MemoryStorage(), first = new MatchStorage(memory, 'test'), second = new MatchStorage(memory, 'test');
  const original = first.load(); first.save(reduce(original, { type: 'score', team: 0, delta: 3 }));
  second.save(reduce(second.latest(), { type: 'score', team: 1, delta: 6 }));
  assert.deepEqual(first.latest().scores, [3, 6]);
});
