# Economy & Staffing Rules

## Core Loop
- **Population Upgrades:** Workers -> Technicians -> Scientists -> Directors. Requires specific happiness (80%+), active upgrade building, housing capacity, and resource costs.
- **First Upgrade Contract:** Workers -> Technicians must not require resources produced only by technicians or higher tiers. In V1 it uses minerals, community_hall, technician housing, and Workers happiness >= 80%.
- **Building Staffing:** Production buildings require workforce slots. Standard base building is 2 slots.
- **Efficiency:** `staffingEfficiency = assignedSlots / totalSlots`. Applies to BOTH `production` and `consumption`. A building running at 50% efficiency consumes 50% of its required input resources.
- **Staffing UI:** Colony-wide staffing management lives in Intelligence HQ -> Staffing. It shows tier capacity, reserved work-order slots, assigned/free slots, building efficiency, pause, auto/manual, priority, and manual slot controls.
- **Input Scarcity:** Building input shortages throttle both building output and building input consumption through `applyInputScarcity`. No-input producers are not throttled.
- **No Pathfinding:** Workers do not physically walk to buildings. Staffing is an aggregated state managed globally per colony.
- **Needs & Happiness:** Basic needs (`water`, `oxygen`, `food`) are survival-critical: satisfaction grants up to +30 happiness, shortage applies up to -50 happiness. Comfort/luxury needs are bonus-only for now.
- **Storage Caps:** Every resource row has `capacity`. Lazy production and direct rewards must clamp amount to `0..capacity`. `storage_depot` expands capacity; existing over-cap legacy stocks are preserved by using `max(dynamicCapacity, currentAmount)` during recalculation.

## Development Rules for LLM
1. **Lazy Evaluation:** Never implement realtime interval ticks for the economy. Use `last_calc_at` and delta time math (`netRate * elapsedTime`).
2. **Deterministic Allocation:** When available workforce changes or priorities change, run a strict function that fills buildings in order of priority: High -> Normal -> Low.
3. **Poverty/Famine Penalty:** If basic needs (oxygen, water, food) hit 0, happiness drops sharply through `calculateTierHappiness`. Worker growth uses this happiness and can become decline.
4. **Data Models:**
   - Building config must include: `staffing?: { tier: PopulationTier, slots: number, minActiveSlots: number }`
   - Building DB state must include: `staffing_mode ('auto'|'manual')`, `work_priority ('low'|'normal'|'high')`, `paused (boolean)`.
5. **Progression Tests:** Keep a config contract that prevents first-tier upgrade costs from using non-starting resources, and keep `POPULATION_TIERS[*].staffingFor` aligned with `BUILDING_TYPES[*].staffing.tier`.
6. **Atomic Population Upgrades:** Population upgrades must use `upgrade_population_transaction`; do not deduct resources and update population in separate service calls.
7. **Work Orders:** Timed work orders live in `domains/work-order`. Start/claim must use `start_work_order_transaction` and `claim_work_order_transaction`; active orders reserve population slots before building staffing allocation. UI access goes through `useWorkOrders` and `WorkOrdersPanel`, not direct component fetches.
8. **Economy Debug:** Use `GET /api/resources/debug?colonyId=...` for balance QA. It must report production, consumption, net rates, building throttles, scarcity factors, work-order slot reservations, population consumption, population needs/happiness, army upkeep, and ranked crisis recommendations.
9. **Reward Caps:** Any resource addition path (events, work orders, exploration, PvP/trade, combat refunds) must respect capacity. Do not add `amount + reward` without a cap.
