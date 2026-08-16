import { AppError, DEFAULT_HOME, DEFAULT_RIVAL, FRIENDLY_MATCH_TYPE, getArchive } from "../server/archive.js";

interface Env {
  NEXON_API_KEY?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function json(value: unknown, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return json({ ok: true, apiKeyConfigured: Boolean(env.NEXON_API_KEY?.trim()), friendlyMatchType: FRIENDLY_MATCH_TYPE });
    }
    if (url.pathname === "/api/archive") {
      try {
        const home = url.searchParams.get("home") || DEFAULT_HOME;
        const rival = url.searchParams.get("rival") || DEFAULT_RIVAL;
        return json(await getArchive(env.NEXON_API_KEY || "", home, rival), 200, "private, max-age=60");
      } catch (error) {
        if (error instanceof AppError) return json({ error: { code: error.code, message: error.message } }, error.status);
        return json({ error: { code: "INTERNAL_ERROR", message: "예상하지 못한 오류가 발생했습니다." } }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
