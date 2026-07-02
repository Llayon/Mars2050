# Economy & Staffing Rules

## Core Loop
- **Population Upgrades:** Workers -> Technicians -> Scientists -> Directors. Requires specific happiness (80%+), active upgrade building, housing capacity, and resource costs.
- **Building Staffing:** Production buildings require workforce slots. Standard base building is 2 slots.
- **Efficiency:** `staffingEfficiency = assignedSlots / totalSlots`. Applies to BOTH `production` and `consumption`. A building running at 50% efficiency consumes 50% of its required input resources.
- **No Pathfinding:** Workers do not physically walk to buildings. Staffing is an aggregated state managed globally per colony.

## Development Rules for LLM
1. **Lazy Evaluation:** Never implement realtime interval ticks for the economy. Use `last_calc_at` and delta time math (`netRate * elapsedTime`).
2. **Deterministic Allocation:** When available workforce changes or priorities change, run a strict function that fills buildings in order of priority: High -> Normal -> Low.
3. **Poverty/Famine Penalty:** If basic needs (oxygen, water, food) hit 0, happiness drops sharply. If happiness < 20%, trigger population death/exile events.
4. **Data Models:**
   - Building config must include: `staffing?: { tier: PopulationTier, slots: number, minActiveSlots: number }`
   - Building DB state must include: `staffing_mode ('auto'|'manual')`, `work_priority ('low'|'normal'|'high')`, `paused (boolean)`.
