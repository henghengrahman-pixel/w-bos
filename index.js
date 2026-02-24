// index.js — GABUNGAN: Prediksi Bola + PrediksiToto (1 server)
import express from "express";
import cors from "cors";
import axios from "axios";
import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";

// ====== PREDIKSITOTO DB (pastikan file ini ada) ======
import {
  upsertMarket, listMarkets, getMarket,
  upsertPrediction, getPrediction, clearPrediction,
  logJobOnce, getDayKeyInTZ, getHHMMInTZ
} from "./public/prediksitoto/db.js";

// ====== PATH ESM ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== APP ======
const app = express();
app.use(cors());
app.use(express.json());

// Serve semua static dari /public (bola + admin + prediksitoto)
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// Home => prediksi bola
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

// /live => page live bola (kalau file kamu namanya live.html)
app.get("/live", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "live.html")));

// Biar /prediksitoto kebuka rapi
app.get("/prediksitoto", (req, res) => res.redirect("/prediksitoto/"));
app.get("/prediksitoto/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "prediksitoto/index.html")));

// Whoami debug
app.get("/__whoami", (_req, res) => res.send("✅ ROOT SERVER RUNNING"));

// =====================================================
// ================== PREDIKSITOTO API =================
// =====================================================
const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();
if (!ADMIN_KEY) console.warn("⚠️ Set ADMIN_KEY di Railway Variables!");

function requireAdmin(req, res, next) {
  const key = String(req.headers["x-admin-key"] || "");
  if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// Health
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, app: "w-bos-combined", ts: Date.now() });
});

// List markets (dipakai dropdown prediksitoto)
app.get("/api/markets", (_req, res) => {
  res.json({ markets: listMarkets() });
});

// Alias aman (kalau frontend kamu ada yang pakai ini)
app.get("/api/prediksitoto/markets", (_req, res) => {
  res.json({ markets: listMarkets() });
});

app.get("/api/prediksitoto/today", (req, res) => {
  const slug = String(req.query.market || "").trim();
  const market = getMarket(slug);
  if (!market) return res.status(404).json({ error: "Market not found" });

  const dayKey = getDayKeyInTZ("Asia/Jakarta");
  const data = getPrediction(slug, dayKey);
  res.json({ market, day: dayKey, data });
});

// Admin add/edit market
app.post("/api/admin/markets", requireAdmin, (req, res) => {
  const m = req.body || {};
  const must = ["slug", "name"];
  for (const k of must) if (!m[k]) return res.status(400).json({ error: `Missing: ${k}` });

  let times = m.publish_times || [];
  if (typeof times === "string") times = times.split(",").map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(times)) times = [];

  const reset_time = (m.reset_time || "00:00").trim();

  upsertMarket({
    slug: String(m.slug).trim(),
    name: String(m.name).trim(),
    timezone: "Asia/Jakarta",
    reset_time,
    publish_times: times,
    logo_url: m.logo_url ? String(m.logo_url).trim() : null,
    tagline: m.tagline ? String(m.tagline).trim() : null,
    desc: m.desc ? String(m.desc).trim() : null
  });

  res.json({ ok: true });
});

// Random generator prediksitoto
const SHIO = ["Tikus","Kerbau","Macan","Kelinci","Naga","Ular","Kuda","Kambing","Monyet","Ayam","Anjing","Babi"];
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const randDigits = (len) => Array.from({length:len}, ()=>String(randInt(0,9))).join("");
const uniqueList = (count, make) => {
  const set = new Set();
  while (set.size < count) set.add(make());
  return [...set];
};
function makePrediction(marketName, dayKey) {
  return {
    title: `OMTOGEL PREDIKSI ${marketName} TOGEL HARI: ${dayKey}`,
    angkaMain: randDigits(5),
    top4d: uniqueList(5, ()=>randDigits(4)).join("*"),
    top3d: uniqueList(5, ()=>randDigits(3)).join("*"),
    top2d: uniqueList(10, ()=>randDigits(2)).join("*"),
    colokBebas: uniqueList(2, ()=>String(randInt(0,9))).join(" / "),
    colok2d: uniqueList(2, ()=>randDigits(2)).join(" / "),
    shioJitu: SHIO[randInt(0, SHIO.length-1)]
  };
}

// Cron 00:00 WIB generate semua pasaran
cron.schedule("0 0 * * *", () => {
  const dayKey = getDayKeyInTZ("Asia/Jakarta");
  for (const m of listMarkets()) {
    const jobKey = "daily_00_reset_generate";
    if (logJobOnce(m.slug, dayKey, jobKey)) {
      clearPrediction(m.slug, dayKey);
      upsertPrediction(m.slug, dayKey, makePrediction(m.name, dayKey));
      console.log(`✅ 00:00 WIB generate: ${m.slug} (${dayKey})`);
    }
  }
}, { timezone: "Asia/Jakarta" });

// Cron optional publish_times
cron.schedule("* * * * *", () => {
  const now = getHHMMInTZ("Asia/Jakarta");
  const dayKey = getDayKeyInTZ("Asia/Jakarta");

  for (const m of listMarkets()) {
    for (const t of (m.publish_times || [])) {
      if (now === t) {
        const jobKey = `publish_generate_${t}`;
        if (logJobOnce(m.slug, dayKey, jobKey)) {
          upsertPrediction(m.slug, dayKey, makePrediction(m.name, dayKey));
          console.log(`✅ publish generate: ${m.slug} @${t} WIB (${dayKey})`);
        }
      }
    }
  }
}, { timezone: "Asia/Jakarta" });

// =====================================================
// ================== API BOLA (punyamu) ===============
// =====================================================
const API = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY;
const SEASON = process.env.SEASON || "2025";
const CACHE_TTL = Number(process.env.CACHE_TTL || 300);
const WHITELIST_MODE = (process.env.WHITELIST_MODE || "off").toLowerCase() === "on";

// cache
const cache = new Map();
const getC = (k) => {
  const d = cache.get(k);
  if (!d) return null;
  if (Date.now() > d.exp) { cache.delete(k); return null; }
  return d.val;
};
const setC = (k, val, ttlSec) => cache.set(k, { val, exp: Date.now() + ttlSec * 1000 });

const norm = (s="") => s
  .toString()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/[^A-Za-z0-9]+/g, " ")
  .trim()
  .toUpperCase();

async function apiGet(pathUrl, params) {
  if (!KEY) throw new Error("Missing API_FOOTBALL_KEY");
  const { data } = await axios.get(`${API}${pathUrl}`, {
    headers: { "x-apisports-key": KEY },
    params
  });
  return data?.response || [];
}

// Priority/whitelist (tetap pakai punya kamu)
const PRIORITY_IDS = (process.env.PRIORITY_IDS || "")
  .split(",").map(s=>s.trim()).filter(Boolean).map(Number);
const PRIORITY_ID_RANK = new Map(PRIORITY_IDS.map((id,i)=>[id,i]));
const PRIORITY_ID_SET = new Set(PRIORITY_IDS);

const PRIORITY_LABELS = [
  "UEFA CHAMPIONS LEAGUE",
  "UEFA EUROPA LEAGUE",
  "UEFA EUROPA CONFERENCE LEAGUE",
  "ENGLISH PREMIER LEAGUE",
  "SPAIN LA LIGA",
  "ITALY SERIE A",
  "GERMANY BUNDESLIGA",
  "FRANCE LIGUE 1",
  "INDONESIA SUPER LEAGUE",
  "SAUDI ARABIA PRO LEAGUE",
  "JAPAN J1 LEAGUE",
  "KOREA K-LEAGUE 1",
  "CHINA FOOTBALL SUPER LEAGUE",
  "TURKIYE SUPER LEAGUE",
  "PORTUGAL LIGA PORTUGAL",
  "NETHERLANDS EREDIVISIE",
  "BELGIUM FIRST DIVISION A",
  "SCOTLAND PREMIERSHIP",
  "AUSTRIA BUNDESLIGA",
  "SWISS SUPER LEAGUE",
  "ARGENTINA LIGA PROFESIONAL",
  "BRAZIL SERIE A",
  "MEXICO PRIMERA DIVISION",
  "USA MAJOR LEAGUE SOCCER",
  "ENGLISH CHAMPIONSHIP",
  "GERMANY BUNDESLIGA 2",
  "ITALY SERIE B",
  "FRANCE LIGUE 2",
  "ENGLISH FA CUP",
  "ENGLISH EFL CUP",
  "COPA LIBERTADORES",
  "COPA SUDAMERICANA",
];
const PRIO_LABEL_RANK = new Map(PRIORITY_LABELS.map((s,i)=>[norm(s), i]));

const SYN = new Map([
  ["INDONESIA SUPER LEAGUE", ["INDONESIA LIGA 1", "INDONESIA LIGA1", "LIGA 1"]],
  ["TURKIYE SUPER LEAGUE", ["TURKIYE SUPER LIG", "TURKEY SUPER LIG", "SUPER LIG"]],
  ["SAUDI ARABIA PRO LEAGUE", ["SAUDI PRO LEAGUE"]],
  ["SPAIN LA LIGA", ["LA LIGA", "PRIMERA DIVISION"]],
  ["ENGLISH PREMIER LEAGUE", ["PREMIER LEAGUE"]],
  ["GERMANY BUNDESLIGA", ["BUNDESLIGA"]],
  ["FRANCE LIGUE 1", ["LIGUE 1"]],
  ["FRANCE LIGUE 2", ["LIGUE 2"]],
  ["BELGIUM FIRST DIVISION A", ["BELGIUM JULIPER PRO LEAGUE", "BELGIUM PRO LEAGUE"]],
  ["BELGIUM FIRST DIVISION B", ["BELGIUM CHALLENGER PRO LEAGUE"]],
  ["MEXICO PRIMERA DIVISION", ["LIGA MX"]],
  ["UEFA CHAMPIONS LEAGUE", ["UEFA CL"]],
  ["UEFA EUROPA LEAGUE", ["UEFA EL"]],
  ["UEFA EUROPA CONFERENCE LEAGUE", ["UEFA ECL"]],
  ["ENGLISH FA CUP", ["FA CUP"]],
  ["ENGLISH EFL CUP", ["EFL CUP","CARABAO CUP"]],
  ["COPA LIBERTADORES", ["LIBERTADORES"]],
  ["COPA SUDAMERICANA", ["SUDAMERICANA"]],
]);

function leagueWeight(g) {
  if (PRIORITY_ID_SET.size && PRIORITY_ID_SET.has(g.id)) return PRIORITY_ID_RANK.get(g.id) ?? 0;
  const nTitle = norm(g.rawTitle || g.title || "");
  const nCombo = norm(`${g.country || ""} ${g.rawTitle || g.title || ""}`);
  if (PRIO_LABEL_RANK.has(nTitle)) return PRIO_LABEL_RANK.get(nTitle);
  if (PRIO_LABEL_RANK.has(nCombo)) return PRIO_LABEL_RANK.get(nCombo);
  for (const [label, syns] of SYN.entries()) {
    const nLabel = norm(label);
    const bag = new Set([nLabel, ...(syns||[]).map(norm)]);
    if (bag.has(nTitle) || bag.has(nCombo)) return PRIO_LABEL_RANK.get(nLabel) ?? 999;
  }
  return 999;
}

// whitelist minimal (tetap jalan, tapi kalau mode off ya include all)
let ALLOWED_LEAGUE_IDS = new Set();
async function buildWhitelist() {
  if (!WHITELIST_MODE) { ALLOWED_LEAGUE_IDS = new Set(); return; }
  try {
    const allLeagues = await apiGet("/leagues");
    // kalau kamu butuh whitelist label lengkap, taruh lagi list WL_LABELS_RAW di sini
    // sementara: kalau ON tapi belum mapping, biar tidak memblok semua:
    ALLOWED_LEAGUE_IDS = new Set(allLeagues.map(x => x.league?.id).filter(Boolean));
  } catch {
    ALLOWED_LEAGUE_IDS = new Set();
  }
}
await buildWhitelist();
setInterval(buildWhitelist, 24 * 60 * 60 * 1000);

// helper prediksi bola (punyamu)
function toWIB(iso) {
  try {
    const d = new Date(iso);
    const hm = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(d);
    const dm = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit" }).format(d);
    return `${dm} ${hm} WIB`;
  } catch { return "-"; }
}
async function getFixturesAll(date) {
  const ck = `fxall:${date}`;
  const c = getC(ck); if (c) return c;
  const resp = await apiGet("/fixtures", { date });
  const out = resp.map(m => ({ league: m.league, fixture: m.fixture, teams: m.teams, goals: m.goals }));
  setC(ck, out, CACHE_TTL);
  return out;
}
async function getStandings(league, season) {
  const ck = `std:${league}:${season}`;
  const c = getC(ck); if (c) return c;
  try {
    const resp = await apiGet("/standings", { league, season });
    const table = (((resp[0] || {}).league || {}).standings || [])[0] || [];
    const map = {};
    for (const row of table) map[row.team.id] = row.rank;
    setC(ck, map, 3600);
    return map;
  } catch {
    setC(ck, {}, 600);
    return {};
  }
}
function predictFromRanks(homeId, awayId, rankMap) {
  const hasRank = rankMap && Object.keys(rankMap).length;
  const rh = hasRank ? (rankMap[homeId] || 20) : 20;
  const ra = hasRank ? (rankMap[awayId] || 20) : 22;
  const diff = ra - rh;
  const k = 6;
  let pHome = 1 / (1 + Math.exp(-diff / k)) + 0.05;
  pHome = Math.min(Math.max(pHome, 0.05), 0.9);
  const pDraw = 0.18 * Math.exp(-Math.abs(diff) / 6);
  let pAway = 1 - pHome - pDraw;
  if (pAway < 0.05) { pAway = 0.05; pHome = 1 - pDraw - pAway; }
  let tip = "Draw", conf = Math.round(pDraw * 100);
  if (pHome >= pAway && pHome >= pDraw) { tip = "Home"; conf = Math.round(pHome * 100); }
  if (pAway >= pHome && pAway >= pDraw) { tip = "Away"; conf = Math.round(pAway * 100); }
  return { tip, conf };
}
function estimateScoreFromTip(matchLabel, tip, confidence) {
  const [home] = (matchLabel || "").split(" vs ");
  const c = Math.max(0, Math.min(100, Number(confidence ?? 50)));
  const flip = s => { const [a,b]=s.split("-").map(v=>v.trim()); return `${b} - ${a}`; };
  if (tip === "Draw") {
    if (c >= 75) return "1 - 1";
    if (c >= 55) return "0 - 0";
    return "1 - 1";
  }
  let s = "1 - 0";
  if (c >= 85) s = "3 - 1";
  else if (c >= 75) s = "2 - 0";
  else if (c >= 65) s = "2 - 1";
  if (tip !== home) s = flip(s);
  return s;
}

// endpoint utama prediksi bola
app.get("/api/fixtures", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0,10);
    const season = req.query.season || SEASON;

    const fixtures = await getFixturesAll(date);

    const useFilter = WHITELIST_MODE && ALLOWED_LEAGUE_IDS.size > 0;
    const list = useFilter ? fixtures.filter(fx => ALLOWED_LEAGUE_IDS.has(fx.league?.id)) : fixtures;

    const byLeague = new Map();
    for (const m of list) {
      const key = m.league?.id || 0;
      if (!byLeague.has(key)) {
        byLeague.set(key, {
          id: key,
          rawTitle: m.league?.name || "League",
          country: m.league?.country || "",
          flag: m.league?.flag || null,
          rows: []
        });
      }
      byLeague.get(key).rows.push(m);
    }

    const groups = [];
    for (const [leagueId, info] of byLeague) {
      const rankMap = await getStandings(leagueId, season).catch(()=> ({}));
      const rows = (info.rows || []).map(m => {
        const h = m.teams.home, a = m.teams.away;
        const match = `${h.name} vs ${a.name}`;
        const pred = predictFromRanks(h.id, a.id, rankMap);
        const tipName = pred.tip === "Home" ? h.name : pred.tip === "Away" ? a.name : "Draw";
        return {
          fixtureId: m.fixture.id,
          homeId: h.id,
          awayId: a.id,
          kickoff: toWIB(m.fixture.date),
          match,
          score: `${m.goals.home ?? "-"} - ${m.goals.away ?? "-"}`,
          tip: tipName,
          confidence: pred.conf,
          predictedScore: estimateScoreFromTip(match, tipName, pred.conf),
        };
      });

      const displayTitle = `${(info.country || "").toUpperCase()} - ${info.rawTitle}`.trim();
      groups.push({ id: leagueId, displayTitle, country: info.country, flag: info.flag, rows });
    }

    groups.sort((a, b) => {
      const wa = leagueWeight({ id: a.id, rawTitle: a.displayTitle, country: a.country });
      const wb = leagueWeight({ id: b.id, rawTitle: b.displayTitle, country: b.country });
      if (wa !== wb) return wa - wb;
      return (a.displayTitle || "").localeCompare(b.displayTitle || "");
    });

    res.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
    res.json({ date, groups, filtered: useFilter });
  } catch (e) {
    res.status(e?.response?.status || 500).json({ ok:false, message: e?.response?.data || e.message });
  }
});

// ===== START SERVER =====
const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => console.log("✅ Server running on port", PORT));
