# Дизайн-документ Экономики Mars2050

## Северная звезда (Видение)
Экономика игры строится на слиянии трех концепций:
1. **Anno-style цепочки производства:** ресурсы добываются, перерабатываются и потребляются населением разных тиров. Потребности растут с каждым тиром.
2. **Building Staffing (Against the Storm):** агрегированное распределение рабочих слотов ("бригад") по зданиям с возможностью ручного вмешательства для решения кризисов.
3. **Timed Work Orders (dotAGE):** активные задания на глобальной карте или территории колонии (расчистка завалов, ремонт, экспедиции) с жесткими таймерами завершения.

## Тиры населения (Tiers)
Город растет снизу вверх. Высшие тиры создаются только через апгрейд низлежащих при соблюдении строгого контракта (Счастье > 80%, наличие здания-апгрейдера, свободного жилья и ресурсов).
- **Workers (Рабочие):** базовое выживание (вода, кислород, еда). Обслуживают шахты, теплицы, генераторы.
- **Technicians (Техники):** индустрия (consumer goods, parts). Обслуживают workshop, advanced mine.
- **Scientists (Ученые):** high-tech (research, biotech). Обслуживают лаборатории.
- **Directors (Элита):** стратегический слой (торговля, армия). Обслуживают космопорт, штаб.

### Needs, Happiness, Growth
- Basic needs (`water`, `oxygen`, `food`) являются survival-critical.
- Полное удовлетворение basic needs дает до `+30` happiness.
- Дефицит basic needs дает до `-50` happiness, поэтому голод/нет воды/нет кислорода быстро переводят Workers в decline.
- Comfort/luxury needs пока дают бонусы, но не накладывают survival-штраф.
- Естественный рост применяется только к Workers; остальные тиры растут через upgrade contract.

### Контракт прогрессии
- Первый переход `Workers -> Technicians` не может требовать ресурс, который производится только техник- или более высоким тиром.
- В V1 этот переход требует `community_hall`, жилье под техников, счастье Workers >= 80% и стартовый ресурс `minerals`.
- `consumer_goods` начинается как потребность/комфорт для Technicians, а не как входной билет в первый апгрейд.

## Building Staffing (Управление персоналом)
Чтобы избежать микроменеджмента ("назначь 100 человечков по одному"), применяется система слотов:
- Один `worker slot` = одна "смена" или "бригада", а не один человек.
- Базовое производственное здание имеет 2 слота.
- Здание работает пропорционально заполненности слотов (1/2 = 50% эффективности, 2/2 = 100%).
- Пропорционально падает не только производство, но и потребление (Consumption). Здание на 50% мощности потребляет на 50% меньше энергии и воды.
- **Автораспределение:** Игрок задает зданиям приоритеты (High, Normal, Low). Сервер детерминированно распределяет доступный пул населения по этим зданиям.
- **Пауза:** Здание можно остановить, чтобы оно не потребляло ни рабочих, ни ресурсы.
- **Colony-wide UI:** В Intelligence HQ есть вкладка Staffing: по тирам видно population, reserved slots от Work Orders, assigned/free slots; по зданиям доступны pause, auto/manual, priority и ручное число смен.

## Серверная архитектура (Lazy Evaluation)
Никакого realtime ticking для каждого рабочего.
Все ресурсы и производство высчитываются формулой: `amount += netRate * elapsedTime`.
Пересчет распределения кадров (allocateBuildingStaffing) происходит только при:
- Изменении числа населения (рост, смерть, апгрейд).
- Изменении настроек здания игроком (пауза, приоритет).
- Завершении Work Order.

## Input Scarcity / Throttling
Производственные здания не должны выпускать output "из воздуха", если не хватает входных ресурсов.
- Сначала считается потенциальный output/input каждого здания после staffing, happiness, terrain и adjacency.
- Затем `applyInputScarcity` агрегирует спрос зданий по каждому input resource и сравнивает его с доступным запасом + производством этого input за расчетное окно.
- Здание получает `inputThrottle = min(inputFactors)` по своим входам.
- Output и input здания масштабируются одним и тем же `inputThrottle`.
- Здания без входных ресурсов (например solar_panels) не throttled.
- Population needs и army upkeep пока не throttled: они продолжают давить на ресурс и дальше обрабатываются happiness/growth логикой.

Для QA доступен backend breakdown: `GET /api/resources/debug?colonyId=...`.
Он возвращает production, consumption, net, building-level throttle, scarcity factors, reserved work-order slots, population consumption, population needs/happiness, army upkeep и ranked crisis recommendations.
Рекомендации ранжируются по опасности: survival needs, low happiness, overcrowding, input throttling, быстрый time-to-empty по ресурсам и pressure от army upkeep.

## Storage / Caps V1
Ресурсы имеют складской лимит `capacity`, чтобы цепочки нельзя было бесконечно буферизовать без инфраструктуры.
- Базовые лимиты: basic resources по `1000`, `research_points` `500`, advanced resources `300`, `nanomaterials` `150`.
- `storage_depot` расширяет capacity всех ресурсов и потребляет немного энергии.
- Lazy tick применяет `amount = min(capacity, max(0, amount + netRate * elapsedTime))`.
- Прямые награды от событий, exploration, PvE/PvP, trade, refunds и Work Orders тоже зажимаются по `capacity`.
- Старые колонии не должны резко терять накопленные запасы: серверный пересчет выставляет runtime capacity как `max(dynamicCapacity, currentAmount)`, пока излишек не будет естественно потрачен.
- Economy debug показывает заполнение складов и добавляет crisis recommendation, когда ресурс растет и близок к лимиту.

## Транзакционность
- Апгрейд населения выполняется через `upgrade_population_transaction`.
- Внутри одной Postgres RPC-транзакции блокируется строка population, проверяются happiness, upgrade-building, жилье и ресурсы, затем списываются ресурсы и переводится население.
- Клиентский/API слой не должен отдельно списывать ресурсы перед изменением population.

## Work Orders V1
Активные задания используют те же агрегированные worker slots, что и здания, но резервируют их на время таймера.
- `clear_rubble`: Workers, награда minerals.
- `repair_grid`: Technicians, награда energy.
- `survey_anomaly`: Scientists, награда research_points/databanks.
- `trade_manifest`: Directors, награда consumer_goods/rare_metals.

Контракт:
- Запуск выполняется через `start_work_order_transaction`.
- Claim награды выполняется через `claim_work_order_transaction`.
- Активные work orders уменьшают доступный пул staffing перед распределением работников по зданиям.
- Завершение lazy: истекшие `active` задания переводятся в `completed` при экономическом recalculation или запросе списка work orders.
- Клиентский слой: `useWorkOrders` + `WorkOrdersPanel`; панель доступна в TWA Operations и desktop Intelligence HQ.
- Realtime sync: общий канал подписок слушает `work_orders`, а start/claim дополнительно обновляют локальный state оптимистичным upsert.
