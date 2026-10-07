// Tribal Cruize — AI image proxy (Supabase Edge Function)
//
// The free image service refuses cross-origin browser requests, so the
// frontend posts the prompt here instead and receives image bytes back.
//
// Deploy:  supabase functions deploy image-generate
// (No extra secrets required.)
//
// POST { prompt: string, w?: number, h?: number }  -> image/png|jpeg bytes

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return errJson("Method not allowed", 405);

  try {
    const { prompt, w, h } = await req.json().catch(() => ({}));
    if (!prompt || typeof prompt !== "string") return errJson("Missing prompt", 400);

    const width = Math.min(1536, Math.max(256, Number(w) || 1024));
    const height = Math.min(1536, Math.max(256, Number(h) || 1024));
    const cleanPrompt = encodeURIComponent(prompt.trim().slice(0, 800));

    // Free tier can be flaky — retry up to 3 times with exponential backoff & fresh seeds.
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }

      const seed = Math.floor(Math.random() * 1e9);
      const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

      const res = await fetch(url);
      const contentType = res.headers.get("content-type") || "";

      if (res.ok && contentType.startsWith("image/")) {
        const imageBuffer = await res.arrayBuffer();
        return new Response(imageBuffer, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
      lastStatus = res.status;
    }

    return errJson(`Image service error (HTTP ${lastStatus})`, 502);
  } catch (err) {
    return errJson(err instanceof Error ? err.message : "Unexpected error", 500);
  }
});
