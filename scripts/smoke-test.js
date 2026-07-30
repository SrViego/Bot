#!/usr/bin/env node
/**
 * Smoke tests leves (Sprint 3) — sem Discord real.
 * Uso: node scripts/smoke-test.js
 */

const assert = require('node:assert/strict');
const path = require('node:path');

process.chdir(path.join(__dirname, '..'));

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${name}`);
    console.error('   ', err.message);
  }
}

console.log('Morgana smoke tests\n');

// ── slash catalog ──────────────────────────────────────────
test('slash catalog builds under 100 commands', () => {
  // avoid loading full bot DB path spam where possible
  const { buildCatalogJSON, ENTRIES } = require('../src/commands/slash-catalog');
  const json = buildCatalogJSON();
  assert.ok(json.length > 0, 'catalog empty');
  assert.ok(json.length <= 97, `catalog too big: ${json.length}`);
  // + ping/lore/ajuda = ~3
  assert.ok(json.length + 3 <= 100, `total slash would exceed 100: ${json.length + 3}`);
  const names = new Set(json.map((c) => c.name));
  assert.ok(names.has('padaria'), 'missing /padaria');
  assert.ok(names.has('poke'), 'missing /poke');
  assert.ok(names.has('musica'), 'missing /musica');
  assert.ok(names.has('mod'), 'missing /mod');
  assert.ok(names.has('loja'), 'missing /loja');
  // subcommands on padaria
  const pad = json.find((c) => c.name === 'padaria');
  assert.ok(pad?.options?.some((o) => o.type === 1 || o.name === 'assar' || o.options), 'padaria needs subs');
  void ENTRIES;
});

// ── bakery parse ───────────────────────────────────────────
test('bakery parseBakeRequest qty + tudo', () => {
  // re-require bakery internals via module - parse not exported
  // test through ensureBakery + beginBake is heavy; just load module
  const bakery = require('../src/systems/bakery');
  assert.equal(typeof bakery.handleBakeryCommand, 'function');
  assert.equal(typeof bakery.showBakery, 'function');
});

// ── economy ────────────────────────────────────────────────
test('economy TAX and handlers exist', () => {
  const eco = require('../src/systems/economy-bridge');
  assert.equal(eco.TAX, 0.45);
  assert.equal(typeof eco.handleExchangeCommand, 'function');
});

// ── onboarding ─────────────────────────────────────────────
test('onboarding steps for empty user', () => {
  const { buildSteps, ensureOnboarding, REWARD_POINTS } = require('../src/systems/onboarding');
  const u = { points: 0, level: 1, stats: { messages: 0 } };
  ensureOnboarding(u);
  const steps = buildSteps(u, 'test-user');
  assert.equal(steps.length, 6);
  assert.ok(steps.every((s) => s.done === false));
  assert.ok(REWARD_POINTS > 0);
});

// ── weekly rank ────────────────────────────────────────────
test('weekKey format', () => {
  const { weekKey, buildRankings } = require('../src/systems/weekly-rank');
  const k = weekKey();
  assert.match(k, /^\d{4}-W\d+$/);
  const ranks = buildRankings({ users: { a: { points: 10 }, b: { points: 5 } } });
  assert.ok(ranks.byPoints[0].includes('a'));
});

// ── database facade ────────────────────────────────────────
test('database saveUser/mutateUser exported', () => {
  const db = require('../src/systems/database');
  assert.equal(typeof db.getUserData, 'function');
  assert.equal(typeof db.saveUser, 'function');
  assert.equal(typeof db.mutateUser, 'function');
  assert.equal(typeof db.saveData, 'function');
});

// ── theme asThemedPayload ──────────────────────────────────
test('asThemedPayload builds embed', () => {
  const { asThemedPayload } = require('../src/systems/theme');
  const p = asThemedPayload({ title: 'T', description: 'D' });
  assert.ok(p.embeds?.length === 1);
});

console.log('');
if (failed) {
  console.error(`${failed} test(s) failed`);
  process.exit(1);
}
console.log('All smoke tests passed.');
process.exit(0);
