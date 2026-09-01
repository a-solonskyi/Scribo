CREATE TABLE `approved_professors` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_approved_professors_email` ON `approved_professors` (`email`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`professor_id` text NOT NULL,
	`topic` text NOT NULL,
	`instructions` text,
	`public_token` text NOT NULL,
	`deadline` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_assignments_class_id` ON `assignments` (`class_id`);--> statement-breakpoint
CREATE INDEX `idx_assignments_professor_id` ON `assignments` (`professor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_assignments_public_token` ON `assignments` (`public_token`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`professor_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_classes_professor_id` ON `classes` (`professor_id`);--> statement-breakpoint
CREATE TABLE `response_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`professor_id` text NOT NULL,
	`type` text NOT NULL,
	`start_offset` integer,
	`end_offset` integer,
	`text_quote` text,
	`comment_text` text,
	`color` text NOT NULL,
	`drawing_path_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_response_annotations_submission_id` ON `response_annotations` (`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_response_annotations_professor_id` ON `response_annotations` (`professor_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`student_name` text NOT NULL,
	`final_text` text NOT NULL,
	`title` text,
	`stats_json` text NOT NULL,
	`event_log_json` text NOT NULL,
	`paste_events_json` text NOT NULL,
	`pause_events_json` text NOT NULL,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_submissions_assignment_id` ON `submissions` (`assignment_id`);