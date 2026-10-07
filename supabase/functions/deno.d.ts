// Ambient definitions for Deno runtime in Supabase Edge Functions
declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  const env: Env;
  function serve(handler: (req: Request) => Promise<Response> | Response): void;
}
