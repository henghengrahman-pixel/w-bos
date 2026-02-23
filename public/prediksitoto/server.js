// server.js
import express from "express";
import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";

import {
  upsertMarket, listMarkets, getMarket,
  upsertPrediction, getPrediction, clearPrediction,
  logJobOnce, getDayKeyInTZ, getHHMMInTZ
} from "./db.js";

/* ===================== PATH SAFE (ESM) ===================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===================== APP ===================== */
const app = express();
app.use(express.json());

// static folder aman walau dijalankan dari root mana pun
app.use(express.static(path.join(__dirname, "public")));

/* ===================== ADMIN KEY ===================== */
const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();
if (!ADMIN_KEY) console.warn("⚠️ Set ADMIN_KEY di Railway Variables!");

function requireAdmin(req, res, next) {
  const key = String(req.headers["x-admin-key"] || "");
  if (!ADMIN_KEY || key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

/* ===================== RANDOM GENERATOR ===================== */
const SHIO = [
  "Tikus","Kerbau","Macan","Kelinci","Naga","Ular",
  "Kuda","Kambing","Monyet","Ayam","Anjing","Babi"
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDigits(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += String(randInt(0, 9));
  return s;
}

function uniqueList(count, make) {
  const set = new Set();
  while (set.size < count) set.add(make());
  return [...set];
}

function makePrediction(marketName, dayKey) {
  const angkaMain = randDigits(5); // contoh: 39785
  const top4d = uniqueList(5, () => randDigits(4)).join("*");
  const top3d = uniqueList(5, () => randDigits(3)).join("*");
  const top2d = uniqueList(10, () => randDigits(2)).join("*");
  const colokBebas = uniqueList(2, () => String(randInt(0, 9))).join(" / ");
  const colok2d = uniqueList(2, () => randDigits(2)).join(" / ");
  const shioJitu = SHIO[randInt(0, SHIO.length - 1)];

  return {
    title: `OMTOGEL PREDIKSI ${marketName} TOGEL HARI: ${dayKey}`,
    angkaMain,
    top4d,
    top3d,
    top2d,
    colokBebas,
    colok2d,
    shioJitu
  };
}

/* ===================== HEALTH CHECK ===================== */
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, app: "prediksitoto", ts: Date.now() });
});

/* ===================== PUBLIC API ===================== */
app.get("/api/markets", (req, res) => {
  res.json({ markets: listMarkets() });
});

app.get("/api/prediksitoto/today", (req, res) => {
  const slug = String(req.query.market || "").trim();
  const market = getMarket(slug);
  if (!market) return res.status(404).json({ error: "Market not found" });

  // patok WIB (Asia/Jakarta)
  const dayKey = getDayKeyInTZ("Asia/Jakarta");
  const data = getPrediction(slug, dayKey);

  res.json({ market, day: dayKey, data });
});

/* ===================== ADMIN: ADD/EDIT MARKET ===================== */
app.post("/api/admin/markets", requireAdmin, (req, res) => {
  const m = req.body || {};
  const must = ["slug", "name"];
  for (const k of must) {
    if (!m[k]) return res.status(400).json({ error: `Missing: ${k}` });
  }

  // publish_times optional
  let times = m.publish_times || [];
  if (typeof times === "string") times = times.split(",").map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(times)) times = [];

  // reset_time optional (default 00:00)
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

/* ===================== AUTO RESET + AUTO GENERATE ===================== */
/**
 * JAM 00:00 WIB:
 * - hapus prediksi hari itu
 * - generate prediksi baru utk semua pasaran
 */
cron.schedule("0 0 * * *", () => {
  const dayKey = getDayKeyInTZ("Asia/Jakarta");
  for (const m of listMarkets()) {
    const jobKey = "daily_00_reset_generate";
    if (logJobOnce(m.slug, dayKey, jobKey)) {
      clearPrediction(m.slug, dayKey);
      const payload = makePrediction(m.name, dayKey);
      upsertPrediction(m.slug, dayKey, payload);
      console.log(`✅ 00:00 WIB generate: ${m.slug} (${dayKey})`);
    }
  }
}, { timezone: "Asia/Jakarta" });

/**
 * OPSIONAL: generate ulang di jam publish_times (WIB)
 */
cron.schedule("* * * * *", () => {
  const now = getHHMMInTZ("Asia/Jakarta");
  const dayKey = getDayKeyInTZ("Asia/Jakarta");

  for (const m of listMarkets()) {
    for (const t of (m.publish_times || [])) {
      if (now === t) {
        const jobKey = `publish_generate_${t}`;
        if (logJobOnce(m.slug, dayKey, jobKey)) {
          const payload = makePrediction(m.name, dayKey);
          upsertPrediction(m.slug, dayKey, payload);
          console.log(`✅ publish generate: ${m.slug} @${t} WIB (${dayKey})`);
        }
      }
    }
  }
}, { timezone: "Asia/Jakarta" });

/* ===================== START ===================== */
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log("✅ Server running on", PORT));
