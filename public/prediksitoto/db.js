import Database from "better-sqlite3";
import fs from "fs";

const DB_DIR = process.env.DB_DIR || "./data";
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(`${DB_DIR}/app.db`);

db.exec(`
CREATE TABLE IF NOT EXISTS markets (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  reset_time TEXT NOT NULL,
  publish_times TEXT NOT NULL,
  logo_url TEXT,
  tagline TEXT,
  desc TEXT
);

CREATE TABLE IF NOT EXISTS predictions (
  market_slug TEXT NOT NULL,
  day TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(market_slug, day)
);

CREATE TABLE IF NOT EXISTS staging (
  market_slug TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_log (
  market_slug TEXT NOT NULL,
  day TEXT NOT NULL,
  job_key TEXT NOT NULL,
  ran_at TEXT NOT NULL,
  PRIMARY KEY(market_slug, day, job_key)
);
`);

export function upsertMarket(m) {
  db.prepare(`
    INSERT INTO markets(slug,name,timezone,reset_time,publish_times,logo_url,tagline,desc)
    VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET
      name=excluded.name,
      timezone=excluded.timezone,
      reset_time=excluded.reset_time,
      publish_times=excluded.publish_times,
      logo_url=excluded.logo_url,
      tagline=excluded.tagline,
      desc=excluded.desc
  `).run(
    m.slug,
    m.name,
    m.timezone,
    m.reset_time,
    JSON.stringify(m.publish_times || []),
    m.logo_url || null,
    m.tagline || null,
    m.desc || null
  );
}

export function listMarkets() {
  return db.prepare(`SELECT * FROM markets ORDER BY name ASC`).all().map(r => ({
    ...r,
    publish_times: JSON.parse(r.publish_times || "[]")
  }));
}

export function getMarket(slug) {
  const r = db.prepare(`SELECT * FROM markets WHERE slug=?`).get(slug);
  if (!r) return null;
  return { ...r, publish_times: JSON.parse(r.publish_times || "[]") };
}

export function setStaging(slug, payload) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO staging(market_slug,payload,updated_at)
    VALUES(?,?,?)
    ON CONFLICT(market_slug) DO UPDATE SET
      payload=excluded.payload,
      updated_at=excluded.updated_at
  `).run(slug, JSON.stringify(payload), now);
  return { ok: true, updated_at: now };
}

export function getStaging(slug) {
  const r = db.prepare(`SELECT payload, updated_at FROM staging WHERE market_slug=?`).get(slug);
  if (!r) return null;
  return { payload: JSON.parse(r.payload), updated_at: r.updated_at };
}

export function upsertPrediction(slug, dayKey, payload) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO predictions(market_slug,day,payload,updated_at)
    VALUES(?,?,?,?)
    ON CONFLICT(market_slug,day) DO UPDATE SET
      payload=excluded.payload,
      updated_at=excluded.updated_at
  `).run(slug, dayKey, JSON.stringify(payload), now);
  return { ok: true, updated_at: now };
}

export function getPrediction(slug, dayKey) {
  const r = db.prepare(`SELECT payload, updated_at FROM predictions WHERE market_slug=? AND day=?`).get(slug, dayKey);
  if (!r) return null;
  return { payload: JSON.parse(r.payload), updated_at: r.updated_at };
}

export function clearPrediction(slug, dayKey) {
  db.prepare(`DELETE FROM predictions WHERE market_slug=? AND day=?`).run(slug, dayKey);
}

export function logJobOnce(slug, dayKey, jobKey) {
  const now = new Date().toISOString();
  try {
    db.prepare(`INSERT INTO job_log(market_slug,day,job_key,ran_at) VALUES(?,?,?,?)`).run(slug, dayKey, jobKey, now);
    return true;
  } catch {
    return false;
  }
}

export function getDayKeyInTZ(tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit"
  }).formatToParts(new Date());
  const y = parts.find(p=>p.type==="year").value;
  const m = parts.find(p=>p.type==="month").value;
  const d = parts.find(p=>p.type==="day").value;
  return `${y}-${m}-${d}`;
}

export function getHHMMInTZ(tz) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour:"2-digit", minute:"2-digit", hourCycle:"h23"
  }).formatToParts(new Date());
  const hh = parts.find(p=>p.type==="hour").value;
  const mm = parts.find(p=>p.type==="minute").value;
  return `${hh}:${mm}`;
}
