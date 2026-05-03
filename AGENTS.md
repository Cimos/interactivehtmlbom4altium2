# AGENTS.md

**Read these before any change, in this order:**

1. [`./.claude/agents/core.md`](./.claude/agents/core.md) — review posture: aggressive at every corner, no flattery, verify before claiming, push back on bad framing.
2. [`./.claude/agents/workflow.md`](./.claude/agents/workflow.md) — diagnostic patterns, ask-for-data, no-sloppy-reads.
3. [`CLAUDE.md`](./CLAUDE.md) — repo conventions, gotchas, run/release.
4. [`./.claude/docs/overview.md`](./.claude/docs/overview.md) — product context.
5. [`./.claude/docs/workflow.md`](./.claude/docs/workflow.md) — IBOM-specific conventions: branching, commit hygiene, issue identifiers.
6. [`./.claude/docs/altium-api.md`](./.claude/docs/altium-api.md) — verified Altium DXP API. Mandatory before any `DM_*` / `IPCB_*` call.
7. [`./.claude/docs/pcbdata-contract.md`](./.claude/docs/pcbdata-contract.md) — what `web/ibom.js` and the openscopeproject schema actually consume. Mandatory before any `Parse*Generic` emit edit.
8. [`./.claude/docs/issues.md`](./.claude/docs/issues.md) — local issue tracker.

**If `.claude/agents/` or `.claude/docs/` is missing or empty, the maintainer overlay isn't
installed on this clone.** Announce partial context to the user and proceed with care.

## Review mode

Aggressive reviewer at every corner. No "Great question," no "should be straightforward,"
no closing recap of what the user just read. Disagree explicitly when you disagree. Tag
technical claims `[verified]` / `[deduced]` / `[guess]`; don't ship `[guess]`. Push back on
the user when their framing is wrong, when their request risks a destructive action, when
a better alternative exists. Full rules: [`./.claude/agents/core.md`](./.claude/agents/core.md).

## TL;DR for agents

- This is an **Altium Designer Pascal-script plugin** (not a Python tool, not a web app). It runs
  inside Altium and emits a self-contained Interactive HTML BOM.
- Main file: `InteractiveHTMLBOM4Altium2.pas` (~3000 lines). Form: `InteractiveHTMLBOM4Altium2.dfm`.
- The `web/` directory is **vendored from upstream KiCad IBOM** — treat as read-only. UI/UX
  changes go upstream to [openscopeproject/InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom).
- The Altium-side adapter is `altium-pcbdata.js` — that's where extension usually lives.
- **No automated tests, no headless build.** Validation means running the script in Altium against
  a real project. Say so explicitly if you can't run it.
- Script language is **DelphiScript** (Altium's dialect) — no typed consts, no generics, no native `set` type (use `MkSet`). Mirror existing patterns.
- Hand-rolled JSON emit (`JSONFloatToStr` / `JSONBoolToStr` / `JSONStrToStr`) — use these, not raw
  concatenation, to avoid locale decimal-separator bugs.
- `MyAbort` is a no-op stub. Don't rely on it to halt execution. Check return codes and `Exit`.
- **`DM_GetParameterByName` AND `DM_ParameterCount` on `IComponent` are parser-rejected on AD25/26** (issue #14). Don't use either. For Component Kind detection use the PCB-side `Ord(Component.GetState_ComponentKind) = 5`. For other schematic parameters, diagnose via the `_*`-field diagnostic-emit recipe in `.claude/agents/workflow.md` before coding.
- **`IPCB_Component` ≠ `IComponent`** — they're two distinct interfaces for the same physical part. Bridge via `SourceUniqueId` ↔ `DM_UniqueId`.
- Every iterator `*_Create` must be paired with a `*_Destroy`. Leaks crash the PCB editor.
- **"It's in the file" is not verified.** DelphiScript may not parse functions that are never called from a reachable entry. Verify a call by reaching it from a regen, not by spotting it in source.
- **When stuck, emit a `_*` diagnostic field per component/primitive and inspect the regen.** See "Diagnostic emit recipe" in `.claude/agents/workflow.md`. Two diagnostic regens beat four speculative fix attempts.

## Don'ts

- Don't add Python, Node tooling, or new JS libraries. The plugin's purity is a feature.
- Don't hand-edit files in `web/`. If you need a newer bundle, replace it wholesale from an
  upstream release.
- Don't refactor `Parse*Generic` "for clarity" — they encode coordinate/angle conventions that
  fail silently when broken.
