const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>YGGMETRO</title>
  <meta name="description" content="YGGMETRO official website">
  <style>
    :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d10;color:#f5f7fa;font-family:system-ui,-apple-system,sans-serif}.shell{width:min(92vw,760px);padding:48px 28px}h1{font-size:clamp(3rem,12vw,7rem);letter-spacing:-.06em;margin:0}p{font-size:1.05rem;line-height:1.6;color:#aeb6c2;max-width:42rem}.tag{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:#7f8a99}
  </style>
</head>
<body>
  <main class="shell">
    <div class="tag">Official website</div>
    <h1>YGGMETRO</h1>
    <p>The production web home for YGGMETRO is online.</p>
  </main>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "yggmetro-web",
        status: "READY"
      }, { headers: { "cache-control": "no-store" } });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    return new Response(request.method === "HEAD" ? null : html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin"
      }
    });
  }
};
