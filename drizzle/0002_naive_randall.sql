CREATE TABLE `assignment_grade_settings` (
	`assignment_id` text PRIMARY KEY NOT NULL,
	`max_grade` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "max_grade_range" CHECK("assignment_grade_settings"."max_grade" BETWEEN 1 AND 100 AND "assignment_grade_settings"."max_grade" = CAST("assignment_grade_settings"."max_grade" AS INTEGER))
);
--> statement-breakpoint
CREATE TABLE `submission_grades` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`score` real NOT NULL,
	`revision` integer NOT NULL,
	`graded_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "grade_score_range" CHECK("submission_grades"."score" BETWEEN 0 AND 100),
	CONSTRAINT "grade_revision_positive" CHECK("submission_grades"."revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submission_grades_revision` ON `submission_grades` (`submission_id`,`revision`);--> statement-breakpoint
CREATE TABLE `submission_moodle_emails` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
