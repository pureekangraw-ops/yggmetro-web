const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>YGGMETRO — Ideas, made visible.</title>
  <meta name="description" content="YGGMETRO creates distinctive visual work from your brief — presentations, visual concepts and prototypes.">
  <style>
    :root{color-scheme:dark;--ink:#071017;--paper:#f5ead2;--muted:#c9bea9;--gold:#d9b66f;--line:#ffffff1f}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 70% 5%,#142f38 0,#0a171d 32%,#060b0f 70%);color:var(--paper);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}
    a{color:inherit}.top{position:absolute;z-index:5;inset:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:22px clamp(20px,5vw,72px);letter-spacing:.12em}.brand{font-family:Georgia,serif;font-size:18px}.nav{display:flex;gap:22px;font-size:11px;text-transform:uppercase;color:var(--muted)}.nav a{text-decoration:none}
    .hero{min-height:100svh;display:grid;place-items:end start;padding:clamp(110px,16vw,180px) clamp(22px,7vw,100px) clamp(52px,8vw,90px);position:relative;overflow:hidden}
    .hero:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 62% 45%,#d8b46e26 0 4%,transparent 28%),linear-gradient(115deg,#061015 5%,transparent 55%);pointer-events:none}
    .beam{position:absolute;width:min(55vw,700px);height:2px;right:-8vw;top:36%;background:linear-gradient(90deg,transparent,#f2d99eaa,transparent);transform:rotate(-11deg);filter:blur(.3px);box-shadow:0 0 24px #f2d99e88}
    .hero-copy{position:relative;z-index:2;max-width:820px}.eyebrow,.kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
    h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(52px,9vw,118px);line-height:.9;letter-spacing:-.055em;margin:16px 0 22px;max-width:900px}.lead{font-size:clamp(17px,2vw,22px);line-height:1.55;color:#ddd2bd;max-width:660px}
    .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:13px}.btn.primary{background:var(--paper);color:#0a1115;border-color:var(--paper)}
    section{padding:90px clamp(22px,7vw,100px);border-top:1px solid var(--line)}.intro{display:grid;grid-template-columns:1fr 1.5fr;gap:8vw}.intro h2,.work h2,.go h2{font:400 clamp(34px,5vw,64px)/1 Georgia,serif;margin:10px 0}.intro p{font-size:18px;line-height:1.7;color:var(--muted);margin:0;max-width:720px}
    .stations{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);padding:1px}.station{background:#091219;padding:34px;min-height:230px;display:flex;flex-direction:column;justify-content:space-between}.station b{font:400 28px Georgia,serif}.station p{color:var(--muted);line-height:1.55}.station span{font-size:11px;letter-spacing:.15em;color:var(--gold)}
    .work-head{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:36px}.work-head p{max-width:520px;color:var(--muted);line-height:1.6}.gallery{display:grid;grid-template-columns:1.25fr .75fr;gap:16px}.card{position:relative;min-height:360px;padding:26px;overflow:hidden;border:1px solid var(--line);background:radial-gradient(circle at 70% 20%,#d8b46e22,transparent 25%),linear-gradient(145deg,#13242b,#080d11)}.card:nth-child(2){background:radial-gradient(circle at 30% 35%,#7557c933,transparent 28%),linear-gradient(145deg,#111727,#080d11)}.card:nth-child(3){grid-column:1/-1;min-height:250px;background:linear-gradient(120deg,#17110c,#0b1519)}.card small{letter-spacing:.14em;color:var(--gold)}.card h3{font:400 clamp(28px,4vw,52px) Georgia,serif;margin:14px 0;max-width:620px}.card p{color:var(--muted);max-width:520px;line-height:1.6}
    .go{display:grid;grid-template-columns:1fr 1fr;gap:8vw;align-items:center}.go-box{border:1px solid #d9b66f55;background:#d9b66f0b;padding:30px;border-radius:22px}.go-box label{display:block;color:var(--gold);font-size:11px;letter-spacing:.15em;margin-bottom:15px}.prompt{border:1px solid var(--line);border-radius:16px;padding:18px;color:#e8ddc8;background:#05090c}.hint{font-size:13px;color:#9d9485;line-height:1.55;margin-top:14px}
    footer{padding:34px clamp(22px,7vw,100px);display:flex;justify-content:space-between;color:#8f897f;font-size:12px;border-top:1px solid var(--line)}
    @media(max-width:760px){.nav a:not(:last-child){display:none}.hero{padding-bottom:44px}.beam{width:90vw;right:-30vw}.intro,.go{grid-template-columns:1fr}.stations{grid-template-columns:1fr}.station{min-height:170px}.gallery{grid-template-columns:1fr}.card:nth-child(3){grid-column:auto}.work-head{display:block}section{padding-top:64px;padding-bottom:64px}footer{gap:18px;flex-direction:column}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  </style>
</head>
<body>
  <header class="top"><div class="brand">YGG METRO</div><nav class="nav"><a href="#work">Work</a><a href="#services">Services</a><a href="#go">Ask GO</a></nav></header>
  <main>
    <section class="hero">
      <div class="beam" aria-hidden="true"></div>
      <div class="hero-copy">
        <div class="eyebrow">Independent creative studio · Bangkok</div>
        <h1>Your brief.<br>Your own answer.</h1>
        <p class="lead">เราไม่ได้เลือกสไตล์ให้คุณ เราสร้างคำตอบจากโจทย์ของคุณ — ให้ความคิด ข้อมูล และเรื่องราว กลายเป็นงานที่มองเห็นและใช้งานได้จริง</p>
        <div class="actions"><a class="btn primary" href="#go">เริ่มงานกับ GO</a><a class="btn" href="#work">ดูผลงาน</a></div>
      </div>
    </section>

    <section class="intro" id="services">
      <div><div class="kicker">Built around the brief</div><h2>Different problems deserve different answers.</h2></div>
      <p>ไม่มีเทมเพลตที่บังคับทุกงานให้หน้าตาเหมือนกัน เรารับโจทย์ตามที่คุณต้องการ แล้วเลือกภาษา ภาพ โครงสร้าง และรูปแบบที่เหมาะกับงานนั้นโดยเฉพาะ</p>
    </section>

    <div class="stations" aria-label="Services">
      <article class="station"><span>01 / PRESENTATION</span><div><b>Presentation Station</b><p>เปลี่ยนข้อมูลให้เป็นเรื่องที่คนดูเข้าใจ เห็นภาพ และจดจำได้</p></div></article>
      <article class="station"><span>02 / VISUAL</span><div><b>Visual Station</b><p>สร้างภาพและทิศทางภาพจากโจทย์ ไม่ใช่จากสไตล์สำเร็จรูป</p></div></article>
      <article class="station"><span>03 / PROTOTYPE</span><div><b>Prototype Lab</b><p>ทำความคิดให้ทดลองจับต้องได้ ก่อนขยายเป็นของจริง</p></div></article>
    </div>

    <section class="work" id="work">
      <div class="work-head"><div><div class="kicker">Selected studio studies</div><h2>One studio.<br>Different answers.</h2></div><p>งานทดลองเพื่อทดสอบวิธีคิดและฝีมือในโจทย์ที่ต่างกัน — ไม่แอบอ้างว่าเป็น client work.</p></div>
      <div class="gallery">
        <article class="card"><small>CONCEPT STUDY / WORLD & STORY</small><h3>Cinematic worlds with a reason to exist.</h3><p>จาก atmosphere ไปสู่ visual language ที่รองรับเรื่องและอารมณ์ของโจทย์</p></article>
        <article class="card"><small>DESIGN EXERCISE / BRAND</small><h3>A different voice for a different product.</h3><p>สินค้าและผู้ชมเปลี่ยน ภาษาภาพก็ต้องเปลี่ยนตาม</p></article>
        <article class="card"><small>STUDIO STUDY / BUSINESS COMMUNICATION</small><h3>Complex information, made clear.</h3><p>Presentation และ information design ที่ให้โครงสร้างรับใช้สาร ไม่ใช่บังคับสารให้เข้ากับ template</p></article>
      </div>
    </section>

    <section class="go" id="go">
      <div><div class="kicker">GO · YGG Metro Concierge</div><h2>มีโจทย์แล้ว?<br>เริ่มตรงนี้ได้เลย.</h2><p class="lead">GO ช่วยรับ requirement ที่คุณเตรียมมา จัดให้ครบ และพาเข้าสู่บริการที่ตรงกับงาน โดยไม่บังคับให้คุณรู้ชื่อแพ็กเกจก่อน</p></div>
      <div class="go-box"><label>ASK GO / START HERE</label><div class="prompt">“มีไฟล์บริษัทเก่า อยากทำใหม่ให้คนเข้าใจง่ายขึ้น” &nbsp; →</div><div class="hint">GO Client จะเป็นพื้นที่ลูกค้าโดยเฉพาะ แยกจากระบบ GO หลังบ้านและ authority ภายใน.</div><div class="actions"><a class="btn primary" href="/client">คุยกับ GO</a></div></div>
    </section>
  </main>
  <footer><span>YGGMETRO · Ideas made visible.</span><span>Designed around your brief.</span></footer>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ok:true,service:"yggmetro-web",status:"READY"},{headers:{"cache-control":"no-store"}});
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed",{status:405,headers:{allow:"GET, HEAD"}});
    return new Response(request.method === "HEAD" ? null : html,{headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
  }
};
