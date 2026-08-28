CREATE TABLE `play_group_invitations` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `play_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_invitations_user_idx` ON `play_group_invitations` (`user_id`);--> statement-breakpoint
ALTER TABLE `play_group_members` ADD `is_game_master` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `roll_events` ADD `character_id` text REFERENCES characters(id);