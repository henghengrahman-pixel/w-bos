const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const slug = params.get("market");

async function load(){
  if(!slug){ $("title").textContent = "Market tidak ada"; return; }

  // ambil market list biar dapat logo/namanya
  const mres = await fetch("/api/markets");
  const mj = await mres.json();
  const market = (mj.markets || []).find(x => x.slug === slug);

  if(market?.logo_url) $("logo").src = market.logo_url;

  const res = await fetch(`/api/prediksitoto/today?market=${encodeURIComponent(slug)}`);
  const j = await res.json();
  if(!res.ok){ $("title").textContent = j.error || "Error"; return; }

  const d = j.data?.payload;
  const name = j.market?.name || market?.name || slug;

  if(!d){
    $("title").textContent = `OMTOGEL PREDIKSI ${name} • ${j.day} (BELUM UPDATE)`;
    return;
  }

  $("title").textContent = `${d.title} ${name} TOGEL HARI: ${j.day}`;
  $("angkaMain").textContent = `(${d.angkaMain})`;
  $("top4d").textContent = d.top4d;
  $("top3d").textContent = d.top3d;
  $("top2d").textContent = d.top2d;
  $("colokBebas").textContent = d.colokBebas;
  $("colok2d").textContent = d.colok2d;
  $("shioJitu").textContent = d.shioJitu;
}
load();
