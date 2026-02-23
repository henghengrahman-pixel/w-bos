*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#000;color:#fff;font-family:system-ui,Segoe UI,Arial;overflow-x:hidden}

/* side bg kiri/kanan (samakan dengan list) */
:root{
  --sideLeft: url("https://ISI_BG_KIRI.jpg");
  --sideRight: url("https://ISI_BG_KANAN.jpg");
}
body::before, body::after{
  content:"";
  position:fixed; top:0; bottom:0;
  width:240px;
  background-size:cover;
  background-position:center;
  background-repeat:no-repeat;
  z-index:0;
  pointer-events:none;
}
body::before{left:0;background-image:var(--sideLeft)}
body::after{right:0;background-image:var(--sideRight)}
@media (max-width:1000px){ body::before, body::after{display:none} }

.wrap{position:relative;z-index:2;max-width:980px;margin:0 auto;padding:18px 16px;text-align:center}

.back{
  display:inline-flex; align-items:center; gap:8px;
  padding:8px 10px;
  border-radius:4px;
  border:1px solid rgba(255,255,255,.22);
  background:rgba(255,255,255,.06);
  color:#fff; text-decoration:none;
  font-weight:900; font-size:12px;
}

.hr{height:1px;background:rgba(255,255,255,.18);margin:14px 0}
.h1{
  font-weight:900;
  letter-spacing:.08em;
  font-size:18px;
  margin:6px 0;
}

.logo{
  width:130px;height:80px;object-fit:cover;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06);
  margin:16px auto 8px;
  display:block;
}

.row{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:14px}
.check{
  width:18px;height:18px;border-radius:4px;
  background:#15c66f;
  display:grid;place-items:center;
  font-size:13px;font-weight:900;
}
.secTitle{font-weight:900;font-size:20px;letter-spacing:.03em}

.valMain{margin:10px 0 18px;opacity:.55;font-weight:900;font-size:16px}

.k{margin:18px 0 6px;font-weight:900;letter-spacing:.05em}
.v{opacity:.35;font-weight:900}

.k2{margin-top:24px;font-weight:900}
.v2{opacity:.55;font-weight:900;margin-top:6px}

.smallIcon{
  width:34px;height:34px;border-radius:50%;
  background:#0fa85a;
  display:grid;place-items:center;
  margin:10px auto 0;
  font-weight:900;
}
