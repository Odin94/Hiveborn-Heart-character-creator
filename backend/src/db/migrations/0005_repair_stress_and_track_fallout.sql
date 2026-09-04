-- Older local sheets used `supply` (and, in a few cases, an empty value) before
-- the resistance key was settled on `supplies`. Repair them before strict
-- character validation reads the record.
UPDATE `characters`
SET `data` = json_set(
    `data`,
    '$.lastStressResistance',
    CASE json_extract(`data`, '$.lastStressResistance')
        WHEN 'supply' THEN 'supplies'
        ELSE 'blood'
    END
)
WHERE json_valid(`data`)
  AND (
      json_extract(`data`, '$.lastStressResistance') IS NULL
      OR json_extract(`data`, '$.lastStressResistance') NOT IN ('blood', 'mind', 'echo', 'fortune', 'supplies')
  );
--> statement-breakpoint
ALTER TABLE `roll_events` ADD `fallout_assigned_at` integer;
--> statement-breakpoint
ALTER TABLE `roll_events` ADD `fallout_assignment_entry` text;
