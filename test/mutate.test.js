const test = require('node:test');
const assert = require('node:assert/strict');
const { tempDataDir } = require('./helpers');

tempDataDir('morgana-mut-');
const db = require('../src/systems/database-sqlite');

const G = 'g1';

function persisted(userId) {
  const row = db.getDb().prepare('SELECT json FROM user_blob WHERE guild_id=? AND user_id=?').get(G, userId);
  return row ? JSON.parse(row.json) : null;
}

test('mutateUser concorrente (handlers async intercalados) não perde nem duplica', async () => {
  const data = db.loadData();
  db.mutateUser(data, G, 'a', (u) => {
    u.points = 1000;
  });

  // 200 "comandos" simultâneos: metade gasta 7, metade ganha 3, com awaits no meio
  const tasks = [];
  for (let i = 0; i < 200; i++) {
    tasks.push(
      (async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        const spend = i % 2 === 0;
        let ok = false;
        db.mutateUser(data, G, 'a', (u) => {
          if (spend) {
            if (u.points < 7) return; // checagem DENTRO da mutação
            u.points -= 7;
          } else {
            u.points += 3;
          }
          ok = true;
        });
        await new Promise((r) => setTimeout(r, Math.random() * 5)); // "reply"
        return ok;
      })()
    );
  }
  const results = await Promise.all(tasks);
  const spent = results.filter((ok, i) => ok && i % 2 === 0).length;
  const earned = results.filter((ok, i) => ok && i % 2 === 1).length;
  const expected = 1000 - spent * 7 + earned * 3;

  assert.equal(db.getUserData(data, G, 'a').points, expected);
  assert.equal(persisted('a').points, expected, 'disco == memória');
  assert.ok(persisted('a').points >= 0);
});

test('mutateUsers: transferência é tudo-ou-nada e soma se conserva', async () => {
  const data = db.loadData();
  db.mutateUsers(data, G, ['x', 'y'], ([x, y]) => {
    x.points = 500;
    y.points = 500;
  });
  const transfers = [];
  for (let i = 0; i < 300; i++) {
    const [from, to] = i % 3 === 0 ? ['y', 'x'] : ['x', 'y'];
    transfers.push(
      (async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 3));
        db.mutateUsers(data, G, [from, to], ([f, t]) => {
          const amt = 1 + (i % 9);
          if (f.points < amt) return;
          f.points -= amt;
          t.points += amt;
        });
      })()
    );
  }
  await Promise.all(transfers);
  const x = persisted('x').points;
  const y = persisted('y').points;
  assert.equal(x + y, 1000);
  assert.ok(x >= 0 && y >= 0);
  assert.equal(db.getUserData(data, G, 'x').points, x);
});

test('mutateUser com erro: rollback em memória e no disco', () => {
  const data = db.loadData();
  db.mutateUser(data, G, 'r', (u) => {
    u.points = 10;
  });
  const ref = db.getUserData(data, G, 'r');
  assert.throws(() =>
    db.mutateUser(data, G, 'r', (u) => {
      u.points = 999999;
      throw new Error('boom');
    })
  );
  assert.equal(ref.points, 10, 'memória intacta');
  assert.equal(persisted('r').points, 10, 'disco intacto');
});

test('mutateUsers recusa fn async', () => {
  const data = db.loadData();
  assert.throws(() => db.mutateUsers(data, G, ['z'], async () => {}), /síncrona/);
});

test('WAL ativo', () => {
  assert.equal(db.getDb().pragma('journal_mode', { simple: true }), 'wal');
});
