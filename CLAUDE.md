# CLAUDE.md

A working copy of `InteractiveHTMLBOM4Altium2` — an Altium Designer Pascal-script
plugin that generates Interactive HTML BOMs (modeled on KiCad's
[InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom)).

**Before any change, load the maintainer overlay if installed:**

- [`./.claude/agents/core.md`](./.claude/agents/core.md) — universal review posture: aggressive at every corner, no flattery, verify before claiming, push back on bad framing.
- [`./.claude/agents/workflow.md`](./.claude/agents/workflow.md) — diagnostic patterns, ask-for-data, no-sloppy-reads.
- [`./.claude/docs/overview.md`](./.claude/docs/overview.md) — IBOM problem and scope.
- [`./.claude/docs/workflow.md`](./.claude/docs/workflow.md) — IBOM-specific conventions: branching, commit hygiene, issue identifiers.
- [`./.claude/docs/altium-api.md`](./.claude/docs/altium-api.md) — verified Altium DXP API surface. Read before touching any `DM_*` or `IPCB_*` call.
- [`./.claude/docs/pcbdata-contract.md`](./.claude/docs/pcbdata-contract.md) — the JSON shape `web/ibom.js` and the openscopeproject schema actually consume. Read before touching any `Parse*Generic` emit code.
- [`./.claude/docs/issues.md`](./.claude/docs/issues.md) — local issue tracker.

**If `.claude/agents/` or `.claude/docs/` is missing or empty, the maintainer overlay isn't
installed on this clone.** Announce that you have partial context and proceed with care
— the public CLAUDE.md below is upstream-worthy guidance only; agent rules and
project-specific context live in the overlay.

## Repo at a glance

| Path | Purpose |
|---|---|
| `InteractiveHTMLBOM4Altium2.pas` | Main script (~3000 lines). PCB walk, GUI form code, OutJob entry points, JSON/HTML emit. |
| `InteractiveHTMLBOM4Altium2.dfm` | Delphi form (`TMainFrm`) — options, field/group checkbox lists. |
| `InteractiveHTMLBOM4Altium2.PrjScr` | Altium script project descriptor. |
| `altium-pcbdata.js` | JS glue: adapts Altium-shaped data to the `pcbdata` structure `web/ibom.js` expects. |
| `altium-fontdata.js` | Static stroke-font outline subset. Loaded by `ParseFontData` (`:1502`) as a plain file read; if missing, a hardcoded copy of the same data is emitted instead. **No runtime extraction from Altium happens** — both paths produce the same curated subset. (Issue #21 is about extending this subset.) |
| `altium-user.js` | User-side hook (default: `// no hacks needed`). |
| `web/` | Upstream KiCad IBOM bundle — **vendored; treat as read-only**. UI/UX changes go to [openscopeproject/InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom). |
| `web/user-file-examples/` | `user.css` / `user.js` / `userheader.html` / `userfooter.html` injection points. |

## How to run

The plugin runs **inside Altium Designer**. There is no headless build. Two run modes:

1. **Standalone script** — open the project in Altium, focus a PCB document, run the script
   (entry: `RunGUI`). The Delphi form opens; pick options; click Generate.
2. **OutJob** — add `InteractiveHTMLBOM4Altium2.pas` to the project, add a Script Output to the
   OutJob, and configure it. OutJob calls `Configure(Parameters)`, `PredictOutputFileNames(Parameters)`,
   and `Generate(Parameters)` directly — no GUI on Generate.

Both paths converge through `OnFormCreated → Initialize → SetState_FromParameters → GenerateIBOM`.

There is **no automated test suite**. Validate changes by running against a real Altium project
(or the upstream sample in `__Previews/`).

## DelphiScript conventions and gotchas

The script language is **DelphiScript** (Altium's name) — a Delphi-like dialect with its own
parser. See Altium's [DelphiScript ↔ Delphi differences](https://www.altium.com/documentation/altium-designer/scripting/delphiscript/delphi-differences) page once.

- **No typed constants** (commit `b038c51`), forward declarations needed for circular
  references, no generics, no `inline`, no native `set` type (use `MkSet`). Mirror existing
  patterns rather than inventing.
- **Block comments are terminated by `}` regardless of which opener was used.** DelphiScript
  inherits classic Pascal's interchangeable comment delimiters: `{ ... }` *and* `(* ... *)`
  both end at the first `}` (or `*)`). So `(* ... ${TOKEN} ... *)` still breaks at the inner
  `}`. **For any comment whose body contains `}`, use `//` line comments** — those are
  terminated only by newline.
- **`MyAbort` is a no-op stub.** Don't rely on it to halt; check `Result` codes and `Exit`
  explicitly. There is a `// TODO: Crash in Release Manager` near it — don't assume errors abort.
- **Coordinate / angle handling lives in `Parse*Generic`** (`ParseArcGeneric`, `ParseTrackGeneric`,
  `ParseComponentGeneric`, `ParsePadGeneric`, `ParseFootprintGeneric`, `ParseTextGeneric`,
  `ParseRegionGeneric`, `ParsePolyGeneric`, `ParseVIAGeneric`). Altium origin/rotation differ from
  KiCad's pcbdata expectations; mistakes here are silent visual bugs. `NormalizeAngle` exists for
  a reason.
- **Multi-PCB projects:** `FindProjectPcbDocFile` prefers `DM_PrimaryImplementationDocument` and
  falls back to scanning all logical documents. Don't regress this (commit `03426f7`).
- **Empty primitives** can divide-by-zero in text scaling — guard before dividing (commit `becf2b4`).
- **Path discovery (`UglyDoIt` / `UglyValidateHome`)** supports both standalone runs and the
  Release Manager. It's fragile; if you change it, manually test both paths.
- **JSON emission is hand-rolled** (`JSONFloatToStr`, `JSONBoolToStr`, `JSONStrToStr`). Use these,
  not string concatenation, to avoid locale issues (`,` vs `.` decimal separator). DelphiScript's
  `FloatToStr` honors the system decimal separator — emit floats through `JSONFloatToStr` only.
- **`DM_GetParameterByName` and `DM_ParameterCount` on `IComponent` are parser-rejected
  on AD25/26** ("Undeclared identifier" — issue #14). The earlier "use ListAllFields'
  pattern" advice was wrong: `ListAllFields` is dead code, never parsed at runtime.
  For Component Kind / "Standard (No BOM)" detection, use the PCB-side typed enum:
  `Ord(Component.GetState_ComponentKind) = 5`. For arbitrary schematic parameters there
  is no clean cross-build path on AD26 — diagnose via the diagnostic-emit recipe in
  `.claude/agents/workflow.md`. Full explanation in `.claude/docs/altium-api.md`.
- **Two distinct component interfaces.** `IPCB_Component` (PCB-side, geometry) ≠ `IComponent`
  (logical/flattened, parameters). Bridge via `SourceUniqueId` ↔ `DM_UniqueId`. `GetCompFromCompEx`
  at `:392` is the canonical bridge.
- **Iterator lifecycle.** Every `*_Create` must be `*_Destroy`'d on the same parent
  (`Board.BoardIterator_Destroy(iter)`, `Comp.GroupIterator_Destroy(giter)`). Leaks can
  crash the PCB editor mid-run.
- **State round-trip:** `Configure` returns a serialized parameter string that OutJob persists.
  `SetState_FromParameters` parses it on next invocation. Defaults are defined inline at the top of
  `SetState_FromParameters` — change them there.

## When NOT to change `web/`

The `web/` directory is openscopeproject's IBOM frontend, vendored. Two rules:

1. UI/UX bugs and feature requests for the rendered page belong upstream. Don't fix them here.
2. If the upstream bundle needs an update, replace `web/` wholesale from a tagged release; don't
   hand-edit. Re-validate `altium-pcbdata.js` adapter against the new pcbdata schema.

The Altium-side adapter (`altium-pcbdata.js`) is fair game and is where extension typically lives.

## Feedback for code changes

- Keep diffs minimal and Altium-Pascal-idiomatic. Don't refactor surrounding code while fixing a bug.
- Don't add comments that restate what the code does. Comments should explain a non-obvious *why*
  (e.g., why the legacy fallback in `FindProjectPcbDocFile` exists).
- Don't introduce new dependencies (no extra JS libs in `web/`, no Python tooling). The plugin is
  intentionally a single Pascal file plus a vendored web bundle.
- Prefer fixing root causes over try/except shims — there's no error-reporting infrastructure here,
  silent failures are the failure mode.

## Credits

MIT-licensed. See `LICENSE`. Built on
[lianlian33/InteractiveHtmlBomForAD](https://github.com/lianlian33/InteractiveHtmlBomForAD) and
[openscopeproject/InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom).
