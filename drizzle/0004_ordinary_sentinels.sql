CREATE TABLE `clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`situacao` text DEFAULT 'ativo' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clientes_user_idx` ON `clientes` (`user_id`,`created_at`);