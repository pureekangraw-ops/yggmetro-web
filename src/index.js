const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>YGGMETRO — Presentation Design</title>
  <meta name="description" content="YGGMETRO รับออกแบบ Presentation จากข้อมูลที่คุณมีอยู่แล้ว">
  <style>
    :root{color-scheme:dark;--bg:#0b1220;--panel:#121a2a;--soft:#162033;--line:#243147;--text:#f4f7fb;--muted:#a9b4c7;--faint:#7f8aa0;--accent:#1f8a70}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 82% -8%,rgba(31,138,112,.18),transparent 30rem),linear-gradient(180deg,#0b1220,#09101b);color:var(--text);font-family:system-ui,-apple-system,"Noto Sans Thai",sans-serif}
    .shell{width:min(1080px,calc(100% - 32px));margin:auto}.nav{height:72px;display:flex;align-items:center;justify-content:space-between}.brand{font-weight:900;letter-spacing:-.04em;font-size:1.35rem}.nav a{color:var(--muted);text-decoration:none;font-size:.9rem}
    .hero{padding:clamp(62px,11vw,128px) 0 56px;max-width:850px}.eyebrow{color:#58bca3;font-size:.75rem;font-weight:850;letter-spacing:.15em;text-transform:uppercase}.hero h1{font-size:clamp(2.8rem,8vw,5.8rem);line-height:.98;letter-spacing:-.06em;margin:12px 0 22px}.lead{font-size:clamp(1rem,2.4vw,1.2rem);line-height:1.75;color:var(--muted);max-width:720px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.btn{padding:14px 18px;border-radius:12px;text-decoration:none;font-weight:800;border:1px solid var(--line);color:var(--text)}.primary{background:var(--accent);border-color:var(--accent)}
    .trust{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--line);gap:1px}.trust div{background:rgba(18,26,42,.96);padding:18px}.trust strong{display:block;margin-bottom:6px}.trust span{font-size:.8rem;line-height:1.5;color:var(--faint)}
    section{padding:56px 0}.head h2{font-size:clamp(1.8rem,4vw,2.7rem);letter-spacing:-.04em;margin:7px 0}.head p{color:var(--muted);line-height:1.65}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:24px}.card{border:1px solid var(--line);background:rgba(18,26,42,.9);border-radius:18px;padding:22px}.card small{color:#58bca3;text-transform:uppercase;letter-spacing:.1em}.price{font-size:2rem;font-weight:900;margin:12px 0}.card p{color:var(--muted);line-height:1.6;font-size:.9rem}
    .start{margin:20px 0 72px;padding:clamp(24px,5vw,44px);border:1px solid #315b53;border-radius:22px;background:linear-gradient(135deg,rgba(31,138,112,.14),rgba(18,26,42,.94))}.start h2{font-size:clamp(1.8rem,5vw,3rem);margin:0 0 12px}.start p{color:var(--muted);line-height:1.7;max-width:700px}.note{font-size:.82rem;color:var(--faint);margin-top:14px}footer{padding:24px 0 40px;color:var(--faint);font-size:.8rem;border-top:1px solid var(--line)}
    @media(max-width:760px){.trust,.grid{grid-template-columns:1fr}.hero{padding-top:48px}.nav{height:60px}.trust div{padding:15px}.grid{gap:10px}}
  </style>
</head>
<body>
  <div class="shell">
    <nav class="nav"><div class="brand">YGGMETRO</div><a href="#pricing">ราคา</a></nav>
    <main>
      <header class="hero">
        <div class="eyebrow">YGGMETRO · PRESENTATION</div>
        <h1>ข้อมูลของคุณ<br>ควรนำเสนอได้ดีกว่านี้</h1>
        <p class="lead">ออกแบบ Presentation จากข้อความ เอกสาร ไฟล์เดิม หรือข้อมูลที่ยังไม่เป็นระเบียบ เราช่วยจัดลำดับเนื้อหาและออกแบบให้นำเสนอได้ชัดเจน โดยยึดข้อมูลต้นฉบับของคุณเป็นหลัก</p>
        <div class="actions"><a class="btn primary" href="#start">เริ่มงาน</a><a class="btn" href="#pricing">ดูราคา</a></div>
      </header>
      <div class="trust">
        <div><strong>ยึดข้อมูลของคุณ</strong><span>ไม่แต่งข้อเท็จจริงหรือตัวเลขเพิ่มเอง</span></div>
        <div><strong>Feedback 2 รอบ</strong><span>รวบรวมแก้ไขเป็นรอบ คุยกันง่าย</span></div>
        <div><strong>ยังไม่รู้จำนวนหน้าก็เริ่มได้</strong><span>ส่งข้อมูลมาให้ดูก่อนแล้วค่อยประเมิน</span></div>
        <div><strong>ข้อมูลยังไม่เรียบร้อยก็ส่งได้</strong><span>เริ่มจากสิ่งที่มี ไม่ต้องจัดไฟล์ให้สวยก่อน</span></div>
      </div>
      <section id="pricing">
        <div class="head"><div class="eyebrow">Pricing</div><h2>แพ็กเกจตามขนาดงาน</h2><p>ทุกแพ็กเกจช่วยจัดหมวด ลดความซ้ำ ปรับข้อความ วาง Layout สี ฟอนต์ และ Visual ตามข้อมูลต้นทาง</p></div>
        <div class="grid">
          <article class="card"><small>Starter</small><div class="price">490 บาท</div><p>ไม่เกิน 5 หน้า · Feedback 2 รอบ</p></article>
          <article class="card"><small>Standard</small><div class="price">790 บาท</div><p>ไม่เกิน 10 หน้า · Feedback 2 รอบ</p></article>
          <article class="card"><small>Business</small><div class="price">1,390 บาท</div><p>ไม่เกิน 20 หน้า · Feedback 2 รอบ</p></article>
        </div>
        <p class="note">หน้าเพิ่มเติม 70 บาท/หน้า · ขอบเขตและระยะเวลาจริงยืนยันก่อนเริ่มงาน</p>
      </section>
      <section id="start" class="start"><div class="eyebrow">Start here</div><h2>มีไฟล์อยู่แล้ว? เริ่มจากตรงนั้นได้เลย</h2><p>รองรับงาน Proposal, Company Profile, Portfolio / Case Study, Report / Summary และ Presentation รูปแบบอื่น ๆ ขั้นรับบรีฟและ GO Client แบบโต้ตอบกำลังย้ายเข้าสู่เว็บไซต์ Production โดยคง workflow เดิมจาก Metro</p></section>
    </main>
    <footer>YGGMETRO · Official website</footer>
  </div>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok:true, service:"yggmetro-web", status:"READY" }, { headers:{"cache-control":"no-store"} });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status:405, headers:{ allow:"GET, HEAD" } });
    }
    return new Response(request.method === "HEAD" ? null : html, { headers:{
      "content-type":"text/html; charset=utf-8",
      "x-content-type-options":"nosniff",
      "referrer-policy":"strict-origin-when-cross-origin",
      "content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
    }});
  }
};
