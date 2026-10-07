// Tribal Cruize — AI image proxy (Supabase Edge Function)
//
// The free image service refuses cross-origin browser requests, so the
// frontend posts the prompt here instead and receives image bytes back.
//
// Deploy:  supabase functions deploy image-generate
// (No extra secrets required.)
//
// POST { prompt: string, w?: number, h?: number }  -> image/png|jpeg bytes

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function errJson(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return errJson("Method not allowed", 405);

  try {
    const { prompt, w, h } = await req.json().catch(() => ({}));
    if (!prompt || typeof prompt !== "string") return errJson("Missing prompt", 400);

    const width = Math.min(1536, Math.max(256, Number(w) || 1024));
    const height = Math.min(1536, Math.max(256, Number(h) || 1024));
    const seed = Math.floor(Math.random() * 1e9);
    const url =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt.slice(0, 800)) +
      `?width=${width}&height=${height}&nologo=true&seed=${seed}`;

    // Free tier is flaky — retry a couple of times with a fresh seed.
    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000 * i));
      const res = await fetch(url.replace(/seed=\d+/, "seed=" + Math.floor(Math.random() * 1e9)));
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.startsWith("image/")) {
        const buf = await res.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": ct,
            "Cache-Control": "no-store",
          },
        });
      }
      lastStatus = res.status;
    }
    return errJson(`Image service error (HTTP ${lastStatus})`, 502);
  } catch (e) {
    return errJson(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
