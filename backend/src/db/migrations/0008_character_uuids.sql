-- Keep legacy primary keys and all group/history references intact. Give every
-- existing sheet, including deleted sheets, a durable UUID in its JSON data.
UPDATE characters SET data = json_set(data, '$.uuid',
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))))
WHERE json_extract(data, '$.uuid') IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX characters_uuid_unique ON characters (json_extract(data, '$.uuid'));
