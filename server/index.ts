import compression from "compression";
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError, ARCHIVE_VERSION, DEFAULT_HOME, DEFAULT_RIVAL, FRIENDLY_MATCH_TYPE, getArchive, INCLUDED_FRIENDLY_MODES } from "./archive.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const API_KEY = process.env.NEXON_API_KEY?.trim() || "";

app.use(compression());

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  apiKeyConfigured: Boolean(API_KEY),
  friendlyMatchType: FRIENDLY_MATCH_TYPE,
  includedFriendlyModes: INCLUDED_FRIENDLY_MODES,
  managerModeExcluded: true,
  databaseConfigured: false,
  version: ARCHIVE_VERSION,
}));

app.get("/api/archive", async (req, res, next) => {
  try {
    const home = typeof req.query.home === "string" ? req.query.home : DEFAULT_HOME;
    const rival = typeof req.query.rival === "string" ? req.query.rival : DEFAULT_RIVAL;
    res.set("Cache-Control", "private, max-age=60").json(await getArchive(API_KEY, home, rival));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof AppError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  console.error(error instanceof Error ? error.message : "Unknown server error");
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "예상하지 못한 오류가 발생했습니다." } });
});

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(dirname, "../dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => console.log(`FC ONLINE archive API: http://localhost:${PORT}`));


