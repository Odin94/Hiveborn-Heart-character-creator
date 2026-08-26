DROP INDEX IF EXISTS `users_nickname_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_nickname_unique` ON `users` (`nickname` COLLATE NOCASE);
