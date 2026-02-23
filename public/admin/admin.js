const $ = (id) => document.getElementById(id);

function headers(){
  return {
    "Content-Type": "application/json",
    "x-admin-key": $("key").value.trim()
  };
}

async function refreshMarkets(){
  const res = await fetch("/api/markets");
  const j = await res.json();
  const mk = j.markets || [];
  $("market").innerHTML = mk.map(m => `<option value="${m.slug}">${m.name}</option>`).join("");
}

$("saveMarket").onclick = async () => {
  $("msg").textContent = "Menyimpan pasaran...";
  const body = {
    slug: $("m_slug").value.trim(),
    name: $("m_name").value.trim(),
    timezone: $("m_tz").value.trim(),
    reset_time: $("m_reset").value.trim(),
    publish_times: $("m_publish").value.trim(),
    logo_url: $("m_logo").value.trim(),
    tagline: $("m_tagline").value.trim(),
    desc: $("m_desc").value.trim()
  };

  const res = await fetch("/api/admin/markets", { method:"POST", headers: headers(), body: JSON.stringify(body) });
  const j = await res.json();
  $("msg").textContent = res.ok ? "✅ Pasaran tersimpan. Buka /prediksitoto/ untuk lihat." : `❌ ${j.error || "gagal"}`;
  if(res.ok) await refreshMarkets();
};

$("saveDraft").onclick = async () => {
  $("msg").textContent = "Menyimpan draft...";
  const payload = {
    title: $("title").value.trim(),
    angkaMain: $("angkaMain").value.trim(),
    top4d: $("top4d").value.trim(),
    top3d: $("top3d").value.trim(),
    top2d: $("top2d").value.trim(),
    colokBebas: $("colokBebas").value.trim(),
    colok2d: $("colok2d").value.trim(),
    shioJitu: $("shioJitu").value.trim()
  };

  const res = await fetch("/api/admin/staging", {
    method:"POST",
    headers: headers(),
    body: JSON.stringify({ market_slug: $("market").value, payload })
  });
  const j = await res.json();
  $("msg").textContent = res.ok ? "✅ Draft tersimpan. Akan auto publish sesuai jam." : `❌ ${j.error || "gagal"}`;
};

$("publishNow").onclick = async () => {
  $("msg").textContent = "Publish...";
  const res = await fetch("/api/admin/publish_now", {
    method:"POST",
    headers: headers(),
    body: JSON.stringify({ market_slug: $("market").value })
  });
  const j = await res.json();
  $("msg").textContent = res.ok ? `✅ Published (${j.day})` : `❌ ${j.error || "gagal"}`;
};

$("resetNow").onclick = async () => {
  if(!confirm("Reset prediksi hari ini untuk pasaran ini?")) return;
  $("msg").textContent = "Reset...";
  const res = await fetch("/api/admin/reset_now", {
    method:"POST",
    headers: headers(),
    body: JSON.stringify({ market_slug: $("market").value })
  });
  const j = await res.json();
  $("msg").textContent = res.ok ? `✅ Reset (${j.day})` : `❌ ${j.error || "gagal"}`;
};

refreshMarkets();
