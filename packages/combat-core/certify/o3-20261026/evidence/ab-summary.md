# Combat-core performance comparison (manual, informational)

- Node v26.11.1 on win32-x64
- O2 (baseline): `bd5299a0b0d43274059290f32c808b929117837b` — `D:/Max/Mars2050-o2/.tmp/base-o22`
- O2.2 (candidate): `candidate-local` — `D:/Max/Mars2050-o2/packages/combat-core`
- Pairs: 9 measured (+3 null-control), 5 runs/process, warmup 2, cooldown 1500 ms
- Dependency resolution: both variants resolve the same zod (`D:/Max/Mars2050-o2/node_modules/zod/index.cjs`)
- Direction: every ratio is **baseline / candidate**; > 1 means the candidate is faster

| preset | null-control ratio (bias) | O2 median | O2.2 median | paired median | ratio of medians | per-pair | spread O2 / O2.2 |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| massive_clash | 0.965× | 240.6 ms | 235.7 ms | 1.043× | 1.021× | 0.947, 1.099, 1.043, 1.066, 1.000, 1.100, 0.793, 1.379, 0.985 | 204–400 / 196–330 ms |
| zerg_rush | 0.926× | 4540.3 ms | 4510.8 ms | 1.011× | 1.007× | 0.760, 1.040, 1.011, 0.889, 0.996, 1.024, 0.993, 1.081, 1.299 | 3460–6892 / 4109–5949 ms |

**Timings are informational.** This workflow has no timing threshold and never fails on a slow or noisy measurement; the numbers are for the owner to judge, not a release gate.

**What does fail the run:** a result hash mismatch between the variants (exit 2); nondeterminism — any repeat, including the null control, producing a different result (exit 3); a content/manifest mismatch; a missing module; a worker failure; different `zod` copies; an unexpected Node version (exit 3).

One expected result hash per preset, verified across every repeat of both variants:
- massive_clash: `e319e672616911ef5d85fc37e735124c49f7b65c711b91260341b237510e1c7a`
- zerg_rush: `89fea02569679c9cfb6d1435d52cb43b466f2480bdf6cdc60cc55340a2b19854`
