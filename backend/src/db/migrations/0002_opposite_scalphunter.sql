CREATE TABLE `play_group_character_assignments` (
	`group_id` text NOT NULL,
	`character_id` text NOT NULL,
	`assigned_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`group_id`, `character_id`),
	FOREIGN KEY (`group_id`) REFERENCES `play_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_character_assignments_character_idx` ON `play_group_character_assignments` (`character_id`);--> statement-breakpoint
INSERT INTO `play_group_character_assignments` (`group_id`, `character_id`)
SELECT `play_group_members`.`group_id`, `characters`.`id`
FROM `play_group_members`
JOIN `characters` ON `characters`.`user_id` = `play_group_members`.`user_id`
WHERE `characters`.`deleted_at` IS NULL
  AND `characters`.`user_id` IN (
      SELECT `user_id`
      FROM `characters`
      WHERE `deleted_at` IS NULL
      GROUP BY `user_id`
      HAVING COUNT(*) = 1
  );
