# HANDOFF-FANTASY — `@mars2050/combat-core@0.1.0-o22mv.1` (O2.2 accepted)

Prepared for the Fantasy integrator by the Mars2050 combat-core owner. Nothing here changes the
runtime: this document pins an already accepted archive and the checks that were actually run on it.
The bundle is self-describing — the archive is held outside git, its `dist` content is pinned by
`manifest.json`, and `verify-archive.mjs` re-checks an installed copy.

Status: **accepted for handoff** (`ACCEPT` for `bd5299a0b0d43274059290f32c808b929117837b`). Fantasy
integration is **PENDING** — no Fantasy file, dependency, vendor archive or stand was touched.

## 1. Identities

| Item | Value |
| --- | --- |
| Source commit | `bd5299a0b0d43274059290f32c808b929117837b` (branch `perf/combat-core-o2-next-v1`) |
| Package | `@mars2050/combat-core@0.1.0-o22mv.1` |
| Original tarball | `D:\Max\o2\evidence-o22\mars2050-combat-core-0.1.0-o22mv.1.tgz` |
| Tarball SHA256 | `6715905ace79dd7108bb1a688b7c554774818187c5b52a5a886306b97373d4fd` |
| Tarball bytes | 419 515 |
| Dist files | 912 (`dist/**`, per-file SHA256 in the manifest) |
| Manifest (content pin) | `packages/combat-core/certify/o22-20261020/manifest.json` |
| Report | `packages/combat-core/certify/o22-20261020/REPORT.md` |
| Verifier | `packages/combat-core/certify/o22-20261020/verify-archive.mjs` |
| Linux CI for this SHA | <https://github.com/Llayon/Mars2050/actions/runs/39568622969> (Node 22.23.3 and 26.12.0) |

Previous generations in the same line (kept, not superseded in their own bundles):

| Generation | Package | Tarball SHA256 | Note |
| --- | --- | --- | --- |
| SDK52 (what Fantasy runs today) | `0.1.0-52a91f4e` | `52a91f4eb406125247426f044eb0dbdf8ab440a8285d211af63e5f9c75bf61dd` | `apps/fantasy/vendor/core/…-52a91f4e.tgz`, unchanged |
| CORE-HANDOFF (O1mv) | `0.1.0-o1mv.1` | `421ad6e35821aeafa0f1bbd3a93cfd69a3fbb81523d031ab6eaa0f8bb13a67f3` | `certify/core-handoff-20261018/` |
| O2 | `0.1.0-o2mv.1` | `4e4a0f36754a5a6918970e9ca06f5729fdc52ce48f3a3b90e70c46130be6b6c7` | `certify/o2-20261018/` |
| **O2.2 (this handoff)** | **`0.1.0-o22mv.1`** | **`6715905ace79dd7108bb1a688b7c554774818187c5b52a5a886306b97373d4fd`** | `certify/o22-20261020/` |

The repository gitignores `*.tgz`, so no archive is committed; pass the tarball path explicitly (see
§8). Do not repack: bytes produced on another OS differ (Linux `npm pack` of this same content is
`2a770704a795f5735cbde2235aa487e3f76727c488265736995a7e2dd197bf93`). Content identity — not tar
bytes — is what the manifest enforces.

## 2. Confirmed checks of the installed package

All of the following were executed on the installed archive (a scratch consumer), never on the
workspace `dist`:

| Check | Result | Where |
| --- | --- | --- |
| Tarball SHA256 vs pinned value | equal, 419 515 bytes | Windows, this station |
| Extracted `dist` vs manifest | **912/912**, 0 missing, 0 mismatched, 0 extra | Windows (re-checked for this handoff) |
| Installed archive vs manifest | **912/912**, `version 0.1.0-o22mv.1` | Windows Node 26.11.1; Linux Node 22.23.3 and 26.12.0 |
| R7 golden matrix (5 scenarios) | **5/5**, fields `winner`, `terminationReason`, `elapsedTicks`, `initialStateSha256`, `survivorsSha256`, `logsSha256`, `metadataSha256` | Windows Node 22.20.0 / 25.6.0 / 26.11.1, Chromium 155.0.8059.85, Linux Node 22.23.3 / 26.12.0 |
| Both CORE-HANDOFF MREs, per-tick journal vs live world | 600 ticks each, **0 inconsistent intermediate frames**; case-1 5 survivors, case-2 39 survivors; max delta 0.005 (the journal rounding bound) | Windows Node 26.11.1, Linux Node 22.23.3 / 26.12.0 |
| Browser bundle isolation | 282 inputs, **0** workspace inputs, private subpaths blocked | Chromium 155.0.8059.85 |
| Public surface | 177 root exports, `exports` map `"."`, `"./contracts"`, `"./replay"`, `"./math"` | all environments |

`ARCHIVE-VERIFY=PASS` in every run above. `dist/index.js` is byte-identical to `o1mv.1` and
`o2mv.1` (`502b750f8baba5fc05246ae696bd6580bf10659d41566309091b280048a54579`), the schema modules are
identical too; only the modules listed in §4 changed.

## 3. Public entry points and full identity

Entry points (public, no private subpath is reachable — `ERR_PACKAGE_PATH_NOT_EXPORTED`):

```text
@mars2050/combat-core            -> dist/index.js            (177 exports, simulateCombat, schemas, identity helpers)
@mars2050/combat-core/contracts  -> dist/contracts/index.js  (contracts/schemas)
@mars2050/combat-core/replay     -> dist/replay/index.js     (replay wire codec)
@mars2050/combat-core/math       -> dist/math/index.js       (deterministic math helpers)
```

Identity constants (`dist/index.js`, unchanged by O2/O2.2):

```text
PUBLIC_CONTRACT_VERSION = 1.0.0
ENGINE_ID               = @mars2050/combat-core
ENGINE_VERSION          = 0.1.0          (source package version; the release prerelease is 0.1.0-o22mv.1)
ENGINE_BUILD_ID         = combat-core-r5a-20261007
REPLAY_SCHEMA_ID        = combat-replay
REPLAY_SCHEMA_VERSION   = 1.0.0
engine.revision         = combat-ecs-v9-deterministic-trig-r4   (v8_sequential: combat-ecs-v8-deterministic-trig-r4)
```

How a trusted runtime selection can be pinned (all four are stable and cheap to assert):

1. `metadata.contractVersion === '1.0.0'`, `metadata.engine.buildId === 'combat-core-r5a-20261007'`,
   `metadata.engine.revision === 'combat-ecs-v9-deterministic-trig-r4'`.
2. `metadata.replaySchema === { id: 'combat-replay', version: '1.0.0' }`.
3. `metadata.ruleset.contentHash` for a known input; the canonical R7 `massive_clash` input
   (`certify/o2-20261018/inputs/massive_clash.battle-input.json`) yields
   `dad6e39e3a4bb0b21685112e6edba7835cd7a639137429636c2977d91ff4eedc`, **identical in `o1mv.1`,
   `o2mv.1` and `o22mv.1`**.
4. Byte pins of the loaded tree: `dist/index.js` `502b750f…a54579`,
   `dist/contracts/ruleset-identity.js` `71730bddd05edf9ba6ffe7455d139f084d8a68f9ac67a7d79a23912c8a9be2b0`.

## 4. Runtime changes carried by O2 and O2.2

Everything below is internal allocation/number-plumbing only: no formula, no RNG draw, no iteration
order, no equality tie-break, no event order, no schema, no coordinate precision.

**O2 (`o1mv.1 → o2mv.1`)**

| Source | Change | Dist files |
| --- | --- | --- |
| `src/combat.action-intent.ts` | the defense-frame snapshot reuses a fresh empty array instead of `structuredClone([])`; non-empty status lists are still deep-cloned | `dist/combat.action-intent.{js,js.map,d.ts.map}` |
| `src/ecs/movement-steering.ts` | steering push direction returns a deterministic angle instead of one `{x, y}` object per overlapping neighbour; arithmetic and neighbour order unchanged | `dist/ecs/movement-steering.{js,js.map,d.ts.map}` |

**O2.2 (`o2mv.1 → o22mv.1`)**

| Source | Change | Dist files |
| --- | --- | --- |
| `src/contracts/ruleset-identity.ts` | `pureSha256` keeps eight working variables and one 64-word schedule in locals instead of rebuilding the state array on each of the 64 rounds; digest bit-identical | `dist/contracts/ruleset-identity.{js,js.map,d.ts,d.ts.map}` |

Dist deltas measured from the committed manifests: O1→O2 = 6 changed files, O2→O2.2 = 4 changed
files, O1→O2.2 = 10 changed files, 0 added, 0 removed, 912 files in each generation.

Behavioural equivalence actually demonstrated (not merely claimed): the full JSON result for both
canonical inputs is byte-identical between installed `o2mv.1` and installed `o22mv.1`; the whole
Fantasy native corpus keeps the same per-scenario digests; the R7 matrix and both MREs are unchanged;
the V8/V9 golden fixtures were not refreshed.

## 5. Comparison chain — read this before quoting numbers

```text
O1mv.1  --(O2 slice, results byte-identical)-->  O2mv.1  --(O2.2 slice, results byte-identical)-->  O22mv.1
```

* O2.2 was measured **against `o2mv.1`**, the immediately accepted predecessor. That is the only
  direct A/B performed for this slice.
* O2.2 was **not** re-measured directly against SDK52 and **not** re-measured against `o1mv.1`. The
  O1mv→O2 numbers live in `certify/o2-20261018/REPORT.md`; the O2→O2.2 numbers live in
  `certify/o22-20261020/REPORT.md`. The cumulative O1mv→O22mv effect follows from the two
  byte-identity results plus the two measurements, not from a third benchmark run.
* SDK52 is a different build with a different public surface; no O2/O2.2 number in this document is
  a measurement of SDK52 or of the current Fantasy worker path.

**Full-result equality — what may and may not be expected.**

| Pair | Full JSON result | Note |
| --- | --- | --- |
| `o22mv.1` vs `o2mv.1` | **identical** | measured: both canonical inputs, whole 159-scenario corpus, matrix, MREs |
| `o22mv.1` vs `o1mv.1` | **identical**, measured directly | 159/159 corpus digests (re-run for this handoff); O2 measured the same equality against `o1mv.1` and nothing was rewritten in between |
| `o22mv.1` vs SDK52 / R7 | **not identical, and must not be required** | CORE-HANDOFF intentionally added/corrected `move` events; the accepted deltas are listed below |

The SDK52/R7 comparison is therefore a separate, narrower contract, exactly as the Fantasy stand
already asserts it (`assertPreservedPhysics` + `assertJournalContract`): HP, physics, outcome,
`initialState`, `survivors`, seeds and all non-`move` events are identical; the only journal deltas
relative to R7 are **additions of previously unpublished moves (0 removals)** and corrected payloads
on turning-only `move` events, limited to `toX`/`toY`/`x`/`y` with `motionKind: 'turn'`. The five R7
matrix scenarios are byte-identical to R7 because they never hit the silent-write path
(`certify/core-handoff-20261018/HANDOFF.md` §2–3). O2 and O2.2 changed no journal path at all: their
`dist` deltas touch only `combat.action-intent`, `ecs/movement-steering` and `contracts/ruleset-identity`.

## 6. Performance, stated carefully

* **What the slice buys.** O2.2 removes a *fixed* per-battle cost: the one-shot ruleset identity hash
  spent 59.6 ms on the real 146 331-character canonical payload and now needs ~2.4 ms (same digest;
  `node:crypto` needs 0.26 ms for the same text). That is a **function-level micro-measurement** on
  this station: it bounds the hash saving at about 57 ms per battle and does not by itself prove an
  end-to-end battle speedup.
* **Do not quote the A/B figures as accepted numbers.** The O2.2 A/B runs placed the baseline in a
  separate tree, so baseline and candidate resolved different `zod` copies; controlled O2.3 runs show
  that this placement shifts timings in the candidate's favour. Every affected A/B point (contours A
  and B, including the installed-archive run) is therefore labelled **"effect requires re-verification
  because of environment differences"** — not a proven upper bound. See
  [`PERFORMANCE-CORRECTION.md`](PERFORMANCE-CORRECTION.md) in this bundle for the corrected numbers,
  the hash-vs-battle separation and the re-measurement protocol.
* **What the original runs reported** (kept for traceability only, not for quotation): Pure Core
  `massive_clash` paired medians 1.133×–1.233×; Mars compat 1.098×–1.130×; Fantasy native corpus
  paired medians 1.055×–1.080×; `zerg_rush` 0.999×/0.995× with paired 1.021/1.016 — the long battle
  showed **no proven O2.2 gain** and that part of the conclusion stands.
* **One controlled CI measurement now exists for Pure Core** (Linux, Node 26.11.1, run `40041860713`,
  receipt [`CI-RUN-40041860713.md`](CI-RUN-40041860713.md)): `massive_clash` 185.6 → 163.2 ms,
  **1.137×**, 5/5 pairs, null control 1.000×; `zerg_rush` 2306.6 → 2248.2 ms, **1.026×**, 3/5 pairs,
  null control 0.985× — the long battle is still **not proven**. This is one runner, two scenarios,
  core only: it does not confirm a general speedup, the published Fantasy, the old Mars Compat
  numbers, any RSS/retained-memory change, or the full Fantasy worker/UI path. A null control near 1
  shows the harness was not visibly biased in that run; it does not prove the absence of all bias.
* **Mars is not Fantasy.** Even if the Mars adapter figures are re-established, they include unchanged
  translation, validation and result-mapping work in the Mars domain; they are not a promise for
  Fantasy's own path.
* **Memory.** The peak-RSS delta of the short battle (3.5–4.4 % lower in three paired processes) came
  from the same baseline placement, so it is marked as **requiring re-verification** as well. The
  retained-heap result showed no change in the previous run; a controlled memory re-check was not
  performed.
* **Still required:** a full Fantasy UI/save acceptance run for this archive. Nothing in this handoff
  substitutes for it.

## 7. Limits of these checks

* Only the 5-scenario R7 matrix, the two supplied MREs and the 159-scenario Fantasy corpus are used
  for the equivalence claim; nothing broader is asserted.
* The corpus equality quoted here is **o22mv.1 vs o1mv.1** (full results) plus the SDK52/R7 contract
  described in §5; it is not a full-result equality against SDK52, which the accepted movement fix
  makes impossible by design.
* Not run for these bytes: Node 24, Linux-arm, Firefox/Safari, local Docker/Linux, per-frame Chromium
  MRE playback (Chromium covered the R7 matrix only).
* Linux coverage comes exclusively from hosted CI (Node 22.23.3 / 26.12.0) on the accepted SHA.
* Fantasy's own acceptance stand, worker determinism across its real worker path, replay projector
  frame-by-frame checks and save migrations are **PENDING** on the Fantasy side (§9).

## 8. Reproducing without importing core sources from a workspace

Commands below are PowerShell on this station; `NODE26` is the Fantasy stand's portable Node
(`D:\Max\fantasy-battles\.tools\node26\node.exe`, v26.11.1). Every step uses the **installed archive**,
never `packages/combat-core` as a module source.

```powershell
# 1. Verify the shipped bytes and their content (no repack; --tarball uses the committed bytes)
node packages/combat-core/certify/o22-20261020/verify-archive.mjs `
  --tarball D:/Max/o2/evidence-o22/mars2050-combat-core-0.1.0-o22mv.1.tgz `
  --expect-sha 6715905ace79dd7108bb1a688b7c554774818187c5b52a5a886306b97373d4fd
#    -> installed-vs-manifest 912/912, r7-matrix-goldens 5/5, both MREs 0 mismatches, ARCHIVE-VERIFY=PASS

# 2. Install the archive as a plain dependency (zod pinned to the verified 4.4.2)
mkdir consumer; cd consumer
node -e "require('fs').writeFileSync('package.json', JSON.stringify({name:'o22-consumer',private:true,type:'module',dependencies:{'@mars2050/combat-core':'file:D:/Max/o2/evidence-o22/mars2050-combat-core-0.1.0-o22mv.1.tgz',zod:'4.4.2'}},null,2))"
npm install --no-audit --no-fund
node -e "import('@mars2050/combat-core').then(m=>console.log(m.ENGINE_ID, m.ENGINE_BUILD_ID, Object.keys(m).length))"
#    -> @mars2050/combat-core combat-core-r5a-20261007 177

# 3. R7 matrix from the installed consumer (no workspace import)
node <mars2050>/scripts/o2-verify/cross-env/run-scenarios.mjs <consumer> `
  <mars2050>/packages/combat-core/certify/o22-20261020/matrix-fixtures.mjs report.json
node <mars2050>/scripts/o2-verify/cross-env/check-matrix.mjs report.json `
  <mars2050>/packages/combat-core/certify/o22-20261020/r7-matrix.json

# 4. Fantasy native corpus: full results vs the accepted O1mv.1 generation (read-only on Fantasy)
#    Pass the INSTALLED copies explicitly - the bundle builder must not fall back to the Mars workspace.
$NODE26 = 'D:\Max\fantasy-battles\.tools\node26\node.exe'
node <mars2050>/scripts/o2-next-verify/fantasy-bundles.mjs `
  --baseline  D:/Max/o2/baseline-install/node_modules/@mars2050/combat-core `
  --candidate D:/Max/o2/consumer-o22/node_modules/@mars2050/combat-core `
  --out-root  D:/Max/o2/fantasy-o22-vs-o1
& $NODE26 <mars2050>/scripts/o2-verify/measure-fantasy.mjs --bundle D:/Max/o2/fantasy-o22-vs-o1/baseline/native-compare.mjs  --mode hash --out o1mv-hash.json
& $NODE26 <mars2050>/scripts/o2-verify/measure-fantasy.mjs --bundle D:/Max/o2/fantasy-o22-vs-o1/candidate/native-compare.mjs --mode hash --out o22mv-hash.json
#    compare the two `digests` maps: 159 keys, 0 differences (re-run for this handoff: 159/159)

# 5. Validate the candidate descriptor with Fantasy's own validator (no files written)
& $NODE26 --input-type=module -e "import { readFileSync } from 'node:fs'; import { validateIdentity } from 'file:///D:/Max/fantasy-battles/scripts/core-acceptance/identity.mjs'; validateIdentity(JSON.parse(readFileSync('D:/Max/o2/handoff-o22/o22-identity.example.json','utf8'))); console.log('IDENTITY-VALID')"
#    -> IDENTITY-VALID
```

Steps 1–3 use only the tarball. Step 4 reads the Fantasy fixtures and the accepted archives and
writes exclusively into the Mars2050 lab directory. Step 5 imports one Fantasy helper module
(read-only) and writes nothing.

Re-run results for this handoff (recorded in `D:\Max\o2\handoff-o22\`):

| Check | Result |
| --- | --- |
| `fantasy-bundles.mjs` with explicit `--baseline` (o1mv.1 install) and `--candidate` (o22mv.1 install) | bundles `d8bcf69e…f754` / `f03f50e2…b537`, 563 inputs each, 390 core inputs |
| 159-scenario digest comparison, o22mv.1 vs o1mv.1 | **159/159 equal, 0 differences**, corpus manifest intact |
| Descriptor validation (`validateIdentity`) | `IDENTITY-VALID`; without `replayAcceptance` the validator still fails with `Coordinate bound must be confirmed by the core owner` |

## 9. Integration boundary for Fantasy (first stage)

1. The integrator copies the **original** tarball (never a repack) and re-checks SHA256
   `6715905a…d4fd` on its own copy before installing.
2. Integration happens in a **separate Fantasy branch**, through the public API only. No file,
   process or build may depend on `D:\Max\Mars2050-o2`, on its `packages/combat-core/dist` or on any
   workspace junction.
3. **SDK52 stays.** The new core is wired as a separate, pinned native candidate, not as a
   replacement of the shipped SDK.
4. Not switched automatically: arena, campaign/march, online matches and friendly-skirmish
   snapshots keep running on the current SDK until the integrator accepts the candidate explicitly.
5. Old saves, assignments and replays are **not** recomputed with the new core.
6. HP checks, geometry checks, identity checks and coordinate checks stay enabled; tolerance
   thresholds are not widened to make the candidate pass. The accepted journal coordinate bound is
   the owner's `0.005 + 1e-9` and is already recorded for CORE-HANDOFF by the stand itself
   (`run.mjs`: `coordinateTolerance: 0.005 + 1e-9, contractConfirmed: true`); the `0.105001` value in
   `candidate.example.json` is a synthetic example and is **not** used here.
7. Anything that fails is reported as a candidate defect, not patched around in Fantasy.

A ready-to-adapt candidate descriptor for `scripts/core-acceptance/` — it mirrors the accepted
`config/native-acceptance.json` shape and passes `validateIdentity` as written (see §8, step 5).
Fill `artifact` and `handoffManifest` with the integrator's own copies; keep the manifest bytes
byte-identical (LF, no reformat).

```json
{
  "package": "@mars2050/combat-core",
  "import": "@fantasy/combat-core-native",
  "packageVersion": "0.1.0-o22mv.1",
  "sourceCommit": "bd5299a0b0d43274059290f32c808b929117837b",
  "artifact": "<fantasy root>/apps/fantasy/vendor/core/mars2050-combat-core-0.1.0-o22mv.1.tgz",
  "sha256": "6715905ace79dd7108bb1a688b7c554774818187c5b52a5a886306b97373d4fd",
  "revision": "combat-ecs-v9-deterministic-trig-r4",
  "publicIdentity": {
    "engineId": "@mars2050/combat-core",
    "engineVersion": "0.1.0",
    "buildId": "combat-core-r5a-20261007",
    "contractVersion": "1.0.0",
    "replaySchemaId": "combat-replay",
    "replaySchemaVersion": "1.0.0",
    "defenseResolutionMode": "v9_snapshot"
  },
  "acceptance": "Candidate-specific results are recorded separately in docs/validation; no deployment authorization",
  "units": "fantasy-r7-native-input-v1",
  "hpProfile": "r7-signed-hp-v1",
  "replayAcceptance": {
    "coordinateTolerance": 0.005000001,
    "confirmedByCoreOwner": true,
    "contractEvidence": "Owner CORE-HANDOFF 20261018 movement publication rounding bound (|round(x) - x| <= 0.005). Re-checked on the O2.2 archive: both MREs report 0 inconsistent intermediate frames at 600 ticks, max delta 0.00499987 (case-1) / 0.00499993 (case-2), final survivor delta 0.00468 / 0.00499. Evidence: packages/combat-core/certify/o22-20261020/REPORT.md section 4 and certify/core-handoff-20261018/HANDOFF.md section 3."
  },
  "handoffManifest": "<fantasy root>/apps/fantasy/vendor/core/o22mv.1/manifest.json",
  "handoffManifestSha256": "2e7c238bc2a6b71fcb3734fdc00f3935306a293f6d913811088b4f86781c5ec4",
  "expectedMreResults": {
    "case-1": "f1ac84a57cf3adfde73b972aeb5153e76cc27cc325f4aa908808f8f00dc85d53",
    "case-2": "16c7071617c163efa53806ebc5bfbf2af54ea649d4ef2c864815f4129cf3ad5d"
  },
  "journalChanges": {
    "removedMoves": 0,
    "changedFields": ["toX", "toY", "x", "y"],
    "changedMotionKind": "turn"
  },
  "sourceCommits": {
    "r7": "177b2132119e202f0770b7bb66068518922aac90",
    "o1": "6351dd6ecbddfc216bcbb557383aac5f82bf66fe",
    "movementFix": "b457fcd7d5fa46ca4d9cbf9967678288d98ce81c",
    "o2": "dfbd9d719ee928d186c9d0dac4c651619e9b731b",
    "o22": "56f63eb",
    "o22AcceptedTip": "bd5299a0b0d43274059290f32c808b929117837b"
  }
}
```

Notes on that block, so nothing is taken on trust:

* `replayAcceptance` is the **accepted** bound, not a new proposal: `0.005000001` is the same
  `0.005 + 1e-9` the stand already records for CORE-HANDOFF (`run.mjs` writes
  `coordinateTolerance: 0.005 + 1e-9, contractConfirmed: true`). The `0.105001` value in
  `candidate.example.json` is a synthetic example and is **not** used here.
* `expectedMreResults` were recomputed today on the installed `o22mv.1` archive
  (`sha256(JSON.stringify(simulateCombat(mre/case-N.json)))`) and match the accepted CORE-HANDOFF
  values, so O2.2 did not move the MRE results.
* `journalChanges` are inherited from CORE-HANDOFF and unchanged: O2/O2.2 touch no movement or
  replay module, and the byte-identical results above prove the journal is identical too.
* `handoffManifestSha256` is the SHA256 of the committed
  `certify/o22-20261020/manifest.json` bytes (`2e7c238b…5ec4`, 102 354 bytes, LF); the Fantasy
  acceptance reads that file and asserts this hash before comparing 912 dist entries.

Consumer acceptance the integrator must run (all of it **PENDING**, none of it PASS here):

| # | Check |
| --- | --- |
| 1a | Fantasy native corpus, **full results vs the accepted O1mv.1 generation**: 159/159 scenarios, per-scenario result digests must match. Measured for this handoff: **o22mv.1 vs o1mv.1 = 159/159**. (The earlier O2.2 run measured o22mv.1 vs o2mv.1 = 159/159; both hold.) |
| 1b | **SDK52/R7 compatibility — separate check, not full equality.** Through the adapter: HP/physics/outcome/`initialState`/`survivors`/non-`move` events identical to R7, and journal deltas limited to the accepted CORE-HANDOFF ones (0 removed moves; changed `move` payloads only `toX`/`toY`/`x`/`y`, `motionKind: 'turn'`), asserted by the stand's `assertJournalContract` with the `journalChanges` block below |
| 2 | Both CORE-HANDOFF MREs on the installed candidate, with intermediate frames (journal projection vs world, 600 ticks) |
| 3 | Preview/start flow and HP display for candidate battles |
| 4 | Save/reload round-trip and runtime-identity separation (candidate result must not be replaced by SDK52 data or vice versa) |
| 5 | All four native/free flag combinations, with the runtime each one selects |
| 6 | Node and Chromium runs, Windows and Linux |
| 7 | Separate timings for the direct core path and the full Fantasy worker path — one Pure Core CI run exists for `massive_clash`/`zerg_rush` (receipt `CI-RUN-40041860713.md`); the Fantasy worker/UI path is still pending |

The four combinations follow the existing Fantasy matrix (`docs/NATIVE-SDK-FREE-DEPLOYMENT-INTEGRATION.md`
in the Fantasy repository) and must be asserted, not assumed:

| flags native/free | Runtime that must be selected | Envelope |
| --- | --- | --- |
| 0/0 | SDK52 | `fantasy.local-arena` |
| 0/1 | SDK52 | `fantasy.training-free-deployment-v1` / `training-free-v1` |
| 1/0 | pinned native SHA `6715905a…d4fd` | `fantasy.experimental-training.<sdk>.<adapter>` |
| 1/1 | pinned native SHA `6715905a…d4fd` | `.free-deployment-v1` / `fantasy-native-free-training-v1` |

There must be no fallback reads between profiles or engines; a mismatch is a failure, not a retry.

## 10. Stop conditions

This handoff stops at the accepted archive: no runtime change, no O3, no merge, no `npm publish`, no
deploy, no Fantasy modification, no dependency or Node/TypeScript upgrade. Any further optimisation
is a new task on top of `bd5299a`, and any Fantasy integration is the integrator's own branch and
acceptance record.
