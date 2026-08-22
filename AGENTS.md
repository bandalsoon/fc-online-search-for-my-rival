# Codex project instructions

Before changing code in this repository:

1. Read `CODEX_START_HERE.md`, `HANDOFF_V4.5.md`, `PROJECT_HISTORY_V1_TO_V4.5.md`, and `V4.5_STABILITY_AUDIT.md` before editing. Then read the user's newest specification and every referenced attachment.
2. If a required attachment is missing or cannot be opened, stop only the image-dependent work and ask the user to attach it. Do not infer the design.
3. Read the relevant code path end to end before editing.
4. Apply the repository-local skills in `.agents/skills/` when their descriptions match the task.
5. For coding, refactoring, bug fixing, dependency choices, and code review, apply both:
   - `ponytail`
   - `karpathy-guidelines`
6. Preserve existing user-visible behavior unless the task explicitly requests a behavior change.
7. Prefer the smallest correct change, reuse existing code, and avoid speculative abstractions or dependencies.
8. Keep changes tightly scoped to the request. Mention unrelated dead code rather than deleting it unless the task explicitly asks for repository cleanup.
9. For cleanup/refactoring tasks, first trace actual imports, callers, build paths, and deployment paths; delete only code proven unused or redundant.
10. Never expose secrets or API keys in frontend code, committed files, logs, or examples. Never modify `.env`, `NEXON_API_KEY`, Cloudflare Secrets, or existing D1 data unless the user explicitly authorizes the exact operation.
11. Never overwrite an existing migration. D1 schema changes require a new migration, a read-only inspection of existing data, and a rollback plan before execution.
12. After non-trivial changes, run the smallest relevant verification available; for repository-wide changes, run `pnpm typecheck`, `pnpm test:formation`, and `pnpm build` when feasible.

When the user explicitly asks for a Ponytail audit/cleanup, deletion and simplification are in scope, but functionality must remain intact unless the user says otherwise.

