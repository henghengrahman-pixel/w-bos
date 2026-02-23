*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:#000;
  color:#fff;
  font-family:system-ui,Segoe UI,Arial;
  overflow-x:hidden;
}

/* side background kiri/kanan (ganti URL) */
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

.wrap{position:relative; z-index:2; max-width:1280px; margin:0 auto; padding:22px 16px;}

.hr{height:1px;background:rgba(255,255,255,.18);margin:12px 0}
.title{
  text-align:center;
  font-weight:900;
  letter-spacing:.08em;
  font-size:18px;
  margin:8px 0;
}

.tools{
  display:flex; align-items:center; gap:12px;
  margin:10px 0 18px;
}
.tools .spacer{flex:1}
.tools select{
  min-width:280px;
  padding:10px 12px;
  border-radius:3px;
  border:1px solid rgba(255,255,255,.25);
  background:#fff; color:#111;
  outline:none;
}

.list{display:flex; flex-direction:column; gap:18px}

/* CARD ITEM */
.item{
  display:grid;
  grid-template-columns: 240px 1fr 170px;
  gap:16px;
  align-items:center;
  padding:18px;
  border-radius:6px;
  background:rgba(25,25,25,.86);
  border:1px solid rgba(255,255,255,.10);
}

.logoBox{display:flex; justify-content:center; align-items:center}
.logoBox img{
  width:180px; height:110px;
  object-fit:cover;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.05);
}

.mid .t{
  font-weight:900;
  letter-spacing:.02em;
  font-size:16px;
  margin-bottom:8px;
}
.mid .s{
  font-weight:900;
  font-size:12px;
  opacity:.9;
  margin-bottom:8px;
}
.mid .d{
  font-size:13px;
  opacity:.85;
  line-height:1.6;
}

.right{display:flex; justify-content:flex-end}
.btn{
  display:inline-flex; align-items:center; gap:8px;
  padding:8px 12px;
  border-radius:4px;
  border:1px solid rgba(255,255,255,.22);
  background:linear-gradient(180deg, rgba(255,255,255,.12), rgba(0,0,0,.12));
  color:#fff;
  text-decoration:none;
  font-weight:900;
  font-size:12px;
  box-shadow:0 6px 18px rgba(0,0,0,.35);
}
.btn:active{transform:translateY(1px)}

@media (max-width:980px){
  .item{grid-template-columns:1fr}
  .logoBox{justify-content:flex-start}
  .right{justify-content:flex-start}
}
