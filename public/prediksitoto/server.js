import express from "express";
import cron from "node-cron";

import {
  upsertMarket, listMarkets, getMarket,
  setStaging, getStaging,
  upsertPrediction, getPrediction, clearPrediction,
  logJobOnce, getDayKeyInTZ, getHHMMInTZ
} from "./db.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();
if (!ADMIN_KEY) console.warn("⚠️ Set ADMIN_KEY di Railway Variables!");

function requireAdmin(req, res, next) {
  const key = String(req.headers["x-admin-key"] || "");
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

/* ===== PUBLIC ===== */
app.get("/api/markets", (req, res) => {
  res.json({ markets: listMarkets() });
});

app.get("/api/prediksitoto/today", (req, res) => {
  const slug = String(req.query.market || "");
  const market = getMarket(slug);
  if (!market) return res.status(404).json({ error: "Market not found" });

  const dayKey = getDayKeyInTZ(market.timezone);
  const data = getPrediction(slug, dayKey);
  res.json({ market, day: dayKey, data });
});

/* ===== ADMIN: tambah/edit pasaran ===== */
app.post("/api/admin/markets", requireAdmin, (req, res) => {
  const m = req.body || {};
  const must = ["slug","name","timezone","reset_time","publish_times"];
  for (const k of must) if (!m[k]) return res.status(400).json({ error: `Missing: ${k}` });

  let times = m.publish_times;
  if (typeof times === "string") times = times.split(",").map(s=>s.trim()).filter(Boolean);
  if (!Array.isArray(times)) return res.status(400).json({ error: "publish_times must be array or comma string" });

  const re = /^\d{2}:\d{2}$/;
  if (!re.test(m.reset_time)) return res.status(400).json({ error: "reset_time must be HH:MM" });
  for (const t of times) if (!re.test(t)) return res.status(400).json({ error: `publish_times invalid: ${t}` });

  upsertMarket({
    slug: String(m.slug).trim(),
    name: String(m.name).trim(),
    timezone: String(m.timezone).trim(),
    reset_time: String(m.reset_time).trim(),
    publish_times: times,
    logo_url: m.logo_url ? String(m.logo_url).trim() : null,
    tagline: m.tagline ? String(m.tagline).trim() : null,
    desc: m.desc ? String(m.desc).trim() : null
  });

  res.json({ ok: true });
});

/* ===== ADMIN: draft prediksi per pasaran ===== */
app.post("/api/admin/staging", requireAdmin, (req, res) => {
  const { market_slug, payload } = req.body || {};
  const market = getMarket(market_slug);
  if (!market) return res.status(404).json({ error: "Market not found" });

  const must = ["title","angkaMain","top4d","top3d","top2d","colokBebas","colok2d","shioJitu"];
  for (const k of must) if (payload?.[k] == null) return res.status(400).json({ error: `Missing field: ${k}` });

  const out = setStaging(market_slug, payload);
  res.json({ ok: true, ...out });
});

app.post("/api/admin/publish_now", requireAdmin, (req, res) => {
  const { market_slug } = req.body || {};
  const market = getMarket(market_slug);
  if (!market) return res.status(404).json({ error: "Market not found" });

  const dayKey = getDayKeyInTZ(market.timezone);
  const st = getStaging(market_slug);
  if (!st) return res.status(400).json({ error: "No staging data" });

  const out = upsertPrediction(market_slug, dayKey, st.payload);
  res.json({ ok: true, day: dayKey, ...out });
});

app.post("/api/admin/reset_now", requireAdmin, (req, res) => {
  const { market_slug } = req.body || {};
  const market = getMarket(market_slug);
  if (!market) return res.status(404).json({ error: "Market not found" });

  const dayKey = getDayKeyInTZ(market.timezone);
  clearPrediction(market_slug, dayKey);
  res.json({ ok: true, day: dayKey });
});

/* ===== SCHEDULER: cek tiap menit ===== */
cron.schedule("* * * * *", () => {
  for (const m of listMarkets()) {
    const dayKey = getDayKeyInTZ(m.timezone);
    const now = getHHMMInTZ(m.timezone);

    // reset per pasaran
    if (now === m.reset_time) {
      const jobKey = `reset_${m.reset_time}`;
      if (logJobOnce(m.slug, dayKey, jobKey)) {
        clearPrediction(m.slug, dayKey);
        console.log(`✅ reset ${m.slug} ${dayKey} @${now}`);
      }
    }

    // publish per jadwal
    for (const t of (m.publish_times || [])) {
      if (now === t) {
        const jobKey = `publish_${t}`;
        if (logJobOnce(m.slug, dayKey, jobKey)) {
          const st = getStaging(m.slug);
          if (st?.payload) {
            upsertPrediction(m.slug, dayKey, st.payload);
            console.log(`✅ publish ${m.slug} ${dayKey} @${t}`);
          } else {
            console.log(`⚠️ publish skip (no staging) ${m.slug} @${t}`);
          }
        }
      }
    }
  }
}, { timezone: "UTC" });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
