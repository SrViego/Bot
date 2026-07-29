/**
 * Métricas simples (stub semana 1) — JSON Lines em data/metrics/
 * Não grava conteúdo de mensagens (só nome do comando / tipo de erro).
 */

const fs = require('node:fs');
const path = require('node:path');
const { createEmbed } = require('./theme');

const metricsDir = path.join(__dirname, '..', '..', 'data', 'metrics');
const RETENTION_DAYS = Number(process.env.METRICS_RETENTION_DAYS || 14);

function ensureDir() {
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }
}

function dayFile(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return path.join(metricsDir, `${y}-${m}-${day}.jsonl`);
}

/**
 * @param {{ kind: string, name?: string, ok?: boolean, ms?: number, guildId?: string, userId?: string, detail?: string }} evt
 */
function track(evt) {
  try {
    ensureDir();
    const row = {
      t: Date.now(),
      kind: evt.kind || 'unknown',
      name: evt.name || null,
      ok: evt.ok !== false,
      ms: typeof evt.ms === 'number' ? evt.ms : null,
      guildId: evt.guildId || null,
      userId: evt.userId || null,
      // detail truncado — sem tokens / conteúdo longo
      detail: evt.detail ? String(evt.detail).slice(0, 200) : null
    };
    fs.appendFileSync(dayFile(row.t), `${JSON.stringify(row)}\n`, 'utf8');

    // Semana 4: também grava na tabela SQLite se o backend for sqlite
    if ((process.env.DATA_BACKEND || 'json').toLowerCase() === 'sqlite') {
      try {
        const { getDb } = require('./database');
        const db = getDb();
        if (db) {
          db.prepare(
            `INSERT INTO metrics_event (ts, guild_id, user_id, kind, name, ok, ms, detail)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            row.t,
            row.guildId,
            row.userId,
            row.kind,
            row.name,
            row.ok ? 1 : 0,
            row.ms,
            row.detail
          );
        }
      } catch {
        /* tabela pode não existir em DB antigo — ignore */
      }
    }
  } catch (err) {
    console.error('[metrics] write failed:', err.message);
  }
}

function trackCommand(name, ctx = {}) {
  track({
    kind: 'command',
    name: String(name).slice(0, 64),
    ok: ctx.ok !== false,
    ms: ctx.ms,
    guildId: ctx.guildId,
    userId: ctx.userId,
    detail: ctx.detail
  });
}

function trackError(name, err, ctx = {}) {
  const msg = err?.message || String(err);
  track({
    kind: 'error',
    name: String(name || 'unknown').slice(0, 64),
    ok: false,
    guildId: ctx.guildId,
    userId: ctx.userId,
    detail: msg
  });
}

function pruneOldMetrics() {
  try {
    ensureDir();
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(metricsDir)) {
      if (!name.endsWith('.jsonl')) continue;
      const full = path.join(metricsDir, name);
      const st = fs.statSync(full);
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        console.log(`[metrics] removido antigo: ${name}`);
      }
    }
  } catch (err) {
    console.error('[metrics] prune failed:', err.message);
  }
}

function readRecentEvents(hours = 24) {
  ensureDir();
  const since = Date.now() - hours * 60 * 60 * 1000;
  const events = [];
  let files = [];
  try {
    files = fs.readdirSync(metricsDir).filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    return events;
  }
  // últimos 3 arquivos de dia cobrem 24–72h
  for (const name of files.slice(-3)) {
    const full = path.join(metricsDir, name);
    let text = '';
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row.t >= since) events.push(row);
      } catch {
        /* linha corrompida */
      }
    }
  }
  return events;
}

function summarize(hours = 24) {
  const events = readRecentEvents(hours);
  const commands = new Map();
  const errors = [];
  let cmdOk = 0;
  let cmdFail = 0;
  let totalMs = 0;
  let msCount = 0;

  for (const e of events) {
    if (e.kind === 'command') {
      const key = e.name || '?';
      commands.set(key, (commands.get(key) || 0) + 1);
      if (e.ok) cmdOk += 1;
      else cmdFail += 1;
      if (typeof e.ms === 'number') {
        totalMs += e.ms;
        msCount += 1;
      }
    } else if (e.kind === 'error') {
      errors.push(e);
    }
  }

  const top = [...commands.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    hours,
    totalEvents: events.length,
    cmdOk,
    cmdFail,
    avgMs: msCount ? Math.round(totalMs / msCount) : null,
    top,
    recentErrors: errors.slice(-10).reverse()
  };
}

function handleMetricsCommand(message) {
  const content = message.content.trim().toLowerCase();
  if (content !== '!metrics' && content !== '!metricas' && !content.startsWith('!metrics ') && !content.startsWith('!metricas ')) {
    return false;
  }

  const { PermissionFlagsBits } = require('discord.js');
  if (!message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    message
      .reply({
        embeds: [
          createEmbed('Só quem tem **Gerenciar servidor** pode ver métricas.', {
            title: '🔒 Métricas'
          })
        ]
      })
      .catch(() => {});
    return true;
  }

  const sub = content.split(/\s+/)[1] || '';
  const s = summarize(24);

  if (sub === 'errors' || sub === 'erros') {
    const lines =
      s.recentErrors.length === 0
        ? '_Nenhum erro registrado nas últimas 24h._'
        : s.recentErrors
            .map(
              (e) =>
                `• \`${e.name || '?'}\` — ${(e.detail || 'sem detalhe').replace(/`/g, "'")}`
            )
            .join('\n');
    message.reply({
      embeds: [createEmbed(lines, { title: '⚠️ Erros (24h)' })]
    }).catch(() => {});
    return true;
  }

  const topLines =
    s.top.length === 0
      ? '_Nenhum comando registrado ainda._'
      : s.top.map(([name, n], i) => `\`${i + 1}.\` **${name}** — ${n}×`).join('\n');

  const body = [
    `⏱ Janela: **${s.hours}h** · eventos: \`${s.totalEvents}\``,
    `✅ cmds ok: \`${s.cmdOk}\` · ❌ falha: \`${s.cmdFail}\``,
    s.avgMs != null ? `⚡ latência média (amostra): \`${s.avgMs}ms\`` : null,
    '',
    '**Top comandos**',
    topLines,
    '',
    '_Detalhes: `!metrics errors` · retenção ~14 dias em `data/metrics/`_'
  ]
    .filter(Boolean)
    .join('\n');

  message.reply({
    embeds: [createEmbed(body, { title: '📊 Métricas Morgana' })]
  }).catch(() => {});
  return true;
}

/** Extrai nome do comando prefix (!play foo → !play) */
function prefixCommandName(content) {
  if (!content || content[0] !== '!') return null;
  const word = content.trim().split(/\s+/)[0];
  return word.length > 1 ? word.slice(0, 64) : null;
}

module.exports = {
  track,
  trackCommand,
  trackError,
  pruneOldMetrics,
  summarize,
  handleMetricsCommand,
  prefixCommandName,
  metricsDir,
  RETENTION_DAYS
};
