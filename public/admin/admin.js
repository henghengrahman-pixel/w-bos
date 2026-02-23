const $ = (id) => document.getElementById(id);

function setMsg(text, ok=true){
  $("msg").className = ok ? "msg ok" : "msg bad";
  $("msg").textContent = text;
}

$("save").onclick = async () => {
  const body = {
    slug: $("slug").value.trim(),
    name: $("name").value.trim(),
    logo_url: $("logo_url").value.trim(),
    tagline: $("tagline").value.trim(),
    desc: $("desc").value.trim(),
    reset_time: $("reset_time").value.trim() || "00:00",
    publish_times: $("publish_times").value.trim() // boleh kosong, atau "12:00,18:00"
  };

  if(!body.slug || !body.name){
    return setMsg("Slug dan Nama wajib diisi.", false);
  }

  setMsg("Menyimpan...");
  const res = await fetch("/api/admin/markets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": $("key").value.trim()
    },
    body: JSON.stringify(body)
  });

  const j = await res.json().catch(()=>({}));
  if(!res.ok) return setMsg(j.error || "Gagal simpan.", false);

  setMsg("✅ Pasaran tersimpan. Buka /prediksitoto/ untuk lihat.");
  // optional: bersihkan input
  $("slug").value = "";
  $("name").value = "";
  $("logo_url").value = "";
  $("tagline").value = "";
  $("desc").value = "";
  $("publish_times").value = "";
};
