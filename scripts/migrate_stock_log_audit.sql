BEGIN;

ALTER TABLE stock_log ADD COLUMN IF NOT EXISTS source_planning_id integer;
ALTER TABLE stock_log ADD COLUMN IF NOT EXISTS planned_by_username varchar;
ALTER TABLE stock_log ADD COLUMN IF NOT EXISTS planned_at timestamp;
ALTER TABLE stock_log ADD COLUMN IF NOT EXISTS executed_by_username varchar;
ALTER TABLE stock_log ADD COLUMN IF NOT EXISTS executed_at timestamp;

-- Preserve the executor as a snapshot instead of depending on a mutable user row.
UPDATE stock_log log
SET executed_by_username = COALESCE(log.executed_by_username, usr.username, 'system'),
    executed_at = COALESCE(log.executed_at, log.created_at)
FROM "user" usr
WHERE usr.id = log."userId"
  AND (log.executed_by_username IS NULL OR log.executed_at IS NULL);

UPDATE stock_log
SET executed_by_username = COALESCE(executed_by_username, 'system'),
    executed_at = COALESCE(executed_at, created_at)
WHERE executed_by_username IS NULL OR executed_at IS NULL;

-- Backfill inbound planning lineage by PO/reference.
UPDATE stock_log log
SET source_planning_id = plan.id,
    planned_by_username = COALESCE(plan.created_by_username, 'system'),
    planned_at = plan.created_at,
    executed_by_username = COALESCE(plan.executed_by_username, log.executed_by_username),
    executed_at = COALESCE(plan.published_at, log.executed_at)
FROM inbound_planning plan
WHERE log.type = 'INBOUND'
  AND log.no_po IS NOT NULL
  AND plan.no_po = log.no_po;

-- Backfill outbound planning lineage by reference number.
UPDATE stock_log log
SET source_planning_id = plan.id,
    planned_by_username = COALESCE(plan.created_by_username, 'system'),
    planned_at = plan.created_at,
    executed_by_username = COALESCE(plan.executed_by_username, log.executed_by_username),
    executed_at = COALESCE(plan.published_at, log.executed_at)
FROM planning_outbound plan
WHERE log.type = 'OUTBOUND'
  AND log.no_ref IS NOT NULL
  AND plan.no_ref = log.no_ref;

CREATE INDEX IF NOT EXISTS "IDX_stock_log_source_planning"
  ON stock_log(source_planning_id);

COMMIT;
