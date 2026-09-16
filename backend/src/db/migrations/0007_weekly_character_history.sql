CREATE TABLE `character_history` (
	`character_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`character_id`, `captured_at`),
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_history_captured_at_idx` ON `character_history` (`captured_at`);--> statement-breakpoint
CREATE TABLE `character_history_checkpoints` (
	`character_id` text PRIMARY KEY NOT NULL,
	`checked_at` integer NOT NULL,
	`data_hash` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
