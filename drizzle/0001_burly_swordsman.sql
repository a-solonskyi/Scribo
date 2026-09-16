CREATE TABLE `student_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`draft_json` text NOT NULL,
	`revision` text NOT NULL,
	`updated_at` text NOT NULL,
	`submitted_at` text,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_student_drafts_assignment_user` ON `student_drafts` (`assignment_id`,`user_id`);