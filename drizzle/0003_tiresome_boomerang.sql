CREATE INDEX `session_expiresAt_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `user_deletedAt_idx` ON `user` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `verification_expiresAt_idx` ON `verification` (`expires_at`);