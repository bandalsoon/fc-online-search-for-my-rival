# Codex project instructions

Before changing code in this repository:

1. Read the relevant code path end to end before editing.
2. Apply the repository-local skills in `.agents/skills/` when their descriptions match the task.
3. For coding, refactoring, bug fixing, dependency choices, and code review, apply both:
   - `ponytail`
   - `karpathy-guidelines`
4. Preserve existing user-visible behavior unless the task explicitly requests a behavior change.
5. Prefer the smallest correct change, reuse existing code, and avoid speculative abstractions or dependencies.
6. Keep changes tightly scoped to the request. Mention unrelated dead code rather than deleting it unless the task explicitly asks for repository cleanup.
7. For cleanup/refactoring tasks, first trace actual imports, callers, build paths, and deployment paths; delete only code proven unused or redundant.
8. Never expose secrets or API keys in frontend code, committed files, logs, or examples.
9. After non-trivial changes, run the smallest relevant verification available; for repository-wide changes, run `pnpm typecheck` and `pnpm build` when feasible.

When the user explicitly asks for a Ponytail audit/cleanup, deletion and simplification are in scope, but functionality must remain intact unless the user says otherwise.
