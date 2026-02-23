const $ = (id) => document.getElementById(id);

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

let markets = [];

function makeTitle(m){
  const today = new Date().toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" }).toUpperCase();
  return `PREDIKSI TOGEL ${m.name} POOLS ${today} OMTOGEL`;
}

function cardHTML(m){
  const logo = m.logo_url || "https://via.placeholder.com/150x86.png?text=LOGO";
  const title = makeTitle(m);
  const tagline = m.tagline || `PASANG ${m.name} POOLS TOGEL ONLINE`;
  const desc = m.desc || `Prediksi Togel ${m.name} hari ini, bocoran & info akurat dari Bandar OMTOGEL.`;

  return `
    <div class="item">
      <div class="logoBox"><img src="${esc(logo)}" alt="${esc(m.name)}"></div>
      <div class="mid">
        <div class="t">${esc(title)}</div>
        <div class="s">● ${esc(tagline)}</div>
        <div class="d">${esc(desc)}</div>
      </div>
      <div class="right">
        <a class="btn" href="/prediksitoto/detail.html?market=${encodeURIComponent(m.slug)}">👁 Lihat Prediksi</a>
      </div>
    </div>
  `;
}

function renderList(list){
  $("list").innerHTML = list.map(cardHTML).join("");
}

function fillSelects(list){
  const opts = list.map(m => `<option value="${esc(m.slug)}">${esc(m.name)}</option>`).join("");
  $("marketTop").innerHTML = `<option value="">— Pilih Pasaran —</option>` + opts;
  $("marketFilter").innerHTML = `<option value="">Cari Pasaran</option>` + opts;
}

async function loadMarkets(){
  const res = await fetch("/api/markets");
  const j = await res.json();
  markets = (j.markets || []).map(m => ({
    ...m,
    logo_url: m.logo_url,
    tagline: m.tagline,
    desc: m.desc
  }));

  fillSelects(markets);
  renderList(markets);
}

$("goTop").addEventListener("click", () => {
  const slug = $("marketTop").value;
  if(!slug) return alert("Pilih pasarannya dulu.");
  location.href = `/prediksitoto/detail.html?market=${encodeURIComponent(slug)}`;
});

$("marketFilter").addEventListener("change", () => {
  const slug = $("marketFilter").value;
  if(!slug) return renderList(markets);
  renderList(markets.filter(m => m.slug === slug));
});

// search keyword (topbar)
$("q").addEventListener("input", () => {
  const term = $("q").value.trim().toLowerCase();
  if(!term) return renderList(markets);
  renderList(markets.filter(m =>
    (m.name || "").toLowerCase().includes(term) ||
    (m.slug || "").toLowerCase().includes(term) ||
    (m.desc || "").toLowerCase().includes(term)
  ));
});

loadMarkets();
