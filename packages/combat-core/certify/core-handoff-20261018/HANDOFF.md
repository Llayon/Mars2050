# CORE-HANDOFF candidate handoff — replay journal completeness

Prepared by the Mars2050 combat-core owner. This bundle is self-contained: the archive, its
manifest, the R7 golden matrix and both MREs are committed here, and
`verify-archive.mjs` installs the archive into a scratch consumer and re-checks it (never the
workspace `dist`).

## 1. Identities

| Item | Value |
| --- | --- |
| Archive (released bytes, held outside git) | `D:\Max\combat-o1-20261017\evidence\mars2050-combat-core-0.1.0-o1mv.1.tgz` |
| Archive SHA256 | `421ad6e35821aeafa0f1bbd3a93cfd69a3fbb81523d031ab6eaa0f8bb13a67f3` |
| Archive bytes | 418792 |
| Package identity | `@mars2050/combat-core@0.1.0-o1mv.1` |
| Dist files | 912 (per-file SHA256 in `manifest.json` — this is the content pin) |
| Contents | R7 + O1 optimization + CORE-HANDOFF movement-journal fix |
| Source commits | base `41c4e5f`; R7 `177b213`; O1 `6351dd6`; movement fix `b457fcd`; bundle `9fc1575` (branch `repair/combat-core-isolation`) |
| R7 reference archive | `artifacts/certify-r7-20261013/mars2050-combat-core-0.1.0.tgz`, SHA256 `39a042822ea1a2a61e75875d6c60fd6966e3812d355a1ea059f2378b8e139fbf` |

The repository gitignores `*.tgz` and `/artifacts/`, so the archive itself is not committed. The
**content** is pinned by `manifest.json` (912 per-file SHA256 values plus the expected archive
SHA). `verify-archive.mjs` rebuilds the archive from the workspace package with the released
identity, installs it into a scratch consumer and fails unless every installed file matches the
manifest. Passing `--tarball <path> --expect-sha <sha>` verifies the exact released bytes instead
(used on Windows for this release).

The previous Fantasy-side identities still apply: the pinned vendor R7 archive
(`1e843f66a3e80b5b67f2d1a88ff0e639349a0570f6df4f162e400ea72388bb36`) is byte-identical to the R7
archive above for `dist` (908/908 files). Only the candidate identity is new.

## 2. Movement contract (what changed)

**Defect.** `batch-movement-system` committed world positions for entities whose collision
correction exceeded 0.1, but published a `move` event only when the *net* displacement exceeded
0.1. When a correction cancelled an intent, the world moved and the journal stayed silent, so the
replay projector drifted from the world (the two MREs drift by 1.0344 and 1.0429 units).

**Fix (journal only; no physics).**
1. Publish a `move` event whenever the position was committed, including corrections that cancel
   an intent (net displacement ≤ 0.1).
2. Never publish coordinates the world did not reach: turning-only intents that write nothing
   publish `to == from ==` the actual world position instead of the uncommitted candidate.
3. Turning-only events keep their previous semantics (`motionKind: 'turn'`, `to == from`).

**Contract now guaranteed.** For every unit, the sequence of published `move` events is
contiguous (`to_k == from_{k+1}`) and reproduces the live world position after every tick within
the journal rounding bound (|round(x) − x| ≤ 0.005). The final published position equals the
survivor position. Physics, HP, outcomes, RNG, balance and the order/content of non-move events
are unchanged.

## 3. Verification results (all on the installed archive)

Windows (this workstation): Node v22.20.0, v25.6.0, v26.11.1 and Chromium (Google Chrome)
155.0.8059.80 → installed archive matches its manifest (912/912) and reproduces the **R7 golden
matrix 5/5 bit-for-bit** in every environment. Browser bundle provenance: 282 inputs, 0 workspace
inputs.

Journal completeness on both MREs (per-tick comparison of journal projection vs live world):

| MRE | ticks | living | intermediate mismatches | max journal delta | final survivor delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| case-1 | 600 | 5 | **0** | 0.005 (rounding) | 0.0047 |
| case-2 | 600 | 39 | **0** | 0.005 (rounding) | 0.0050 |

Negative control: the same check on the **installed R7 archive** reports 34 and 223 inconsistent
intermediate frames with max delta 1.0344 / 1.0429 — exactly the drifts recorded in
`CORE-HANDOFF.md`.

Physics / HP / outcome / non-move equivalence, installed R7 archive vs installed candidate:

| Scenario set | physics + HP + outcome | non-move events | move events |
| --- | --- | --- | --- |
| 5 R7 matrix scenarios | identical | identical | **no change at all** (byte-identical journals) |
| MRE case-1 | identical | identical | 2927 → 2959 (32 new, 1 coordinate-corrected, 0 removed, 2 units) |
| MRE case-2 | identical | identical | 25866 → 26002 (136 new, 20 coordinate-corrected, 0 removed, 16 units) |
| 13 Mars presets × {v9_snapshot, v8_sequential} | identical | identical | only additions + coordinate corrections, **0 removals** |

"New" = moves that were previously missing from the journal (the completeness fix).
"Coordinate-corrected" = turning-only events that used to publish the uncommitted candidate
position and now publish the real one.

**Superseded identities — do not reuse.** The R7 MRE result hashes
`5178a477…` (case-1) and `3d7c8795…` (case-2) no longer apply. New candidate result hashes:

| MRE | input SHA256 | R7 result SHA256 (superseded) | candidate result SHA256 |
| --- | --- | --- | --- |
| case-1 | `73f0f2a98420a7dcaf57ccabf3c905f53daf0576f3c24e5a414d74472fb950ce` | `5178a47701c83bac00f568707cfdef57d2502bdbda48e300c021a70d258f74d6` | `f1ac84a57cf3adfde73b972aeb5153e76cc27cc325f4aa908808f8f00dc85d53` |
| case-2 | `18cdb48cb202ce0ea4d524d64bb4dd7d754ebd46e411c02016352a63c0e8c04b` | `3d7c8795fa360b059bff2c18e6e362cd73b862c5a192dea2c570474a895098ea` | `16c7071617c163efa53806ebc5bfbf2af54ea649d4ef2c864815f4129cf3ad5d` |

Both MREs still end in `draw` after 600 ticks with 5 and 39 survivors.

**Tensor changes beyond the two MREs:** the five R7 matrix scenarios are byte-identical to R7
because they never hit the silent-write path. Mars simulator presets only gained moves or had
turning events corrected; the repo's journal golden fixtures
(`src/__tests__/fixtures/combat-ecs-v8-golden.json`, `-v9-golden.json`) were refreshed for
exactly those deltas (v8: projectile_barrier, qa_primitive_events, ranged_duel, transform_modes,
zerg_rush; v9: projectile_barrier, qa_primitive_events, ranged_duel, zerg_rush). No HP, outcome,
balance or physics change is implied by those fixtures.

## 4. How to consume

1. Install `@mars2050/combat-core@0.1.0-o1mv.1` from this bundle's tarball (drop-in for the
   pinned R7 SDK: `simulateCombat`, `battleInputSchema` and the rest of the pinned public surface
   are unchanged; `mapCombatEventToBattleAction` is additionally exported from the root and the
   `./replay` subpath).
2. The projector contract is unchanged: no tolerance increase, no HP-gate relaxation. The journal
   is now complete, so a projector that follows `move` events reproduces the world at every tick
   and reaches the survivors exactly at the end.
3. Expect `result` SHA changes only where the journal gained/corrected move events; update the
   pinned MRE expectations to the candidate hashes above, not to the R7 ones.

## 5. Not run / open items

- Local Docker/Linux on the workstation: **NOT_RUN** (docker daemon unavailable). Linux is covered
  by the `core archive verify (Linux)` GitHub Actions job (`ubuntu-latest`, Node 22 and 26), which
  runs this bundle's `verify-archive.mjs` against the installed rebuilt archive.
- Only the two supplied MREs are used for the correctness claim; global minimality of the fix is
  not claimed beyond what the 5 matrix scenarios, 13 Mars presets and 159 Fantasy scenarios show.
- Per instructions: no Fantasy stand, dependency, or build output was modified; no merge into
  `main`, no npm publish and no deploy was performed.
