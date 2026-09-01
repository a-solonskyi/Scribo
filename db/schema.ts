import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const approvedProfessors = sqliteTable(
  "approved_professors",
  {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_approved_professors_email").on(table.email)],
);

export const classes = sqliteTable(
  "classes",
  {
    id: text("id").primaryKey(),
    professorId: text("professor_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_classes_professor_id").on(table.professorId)],
);

export const assignments = sqliteTable(
  "assignments",
  {
    id: text("id").primaryKey(),
    classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    professorId: text("professor_id").notNull(),
    topic: text("topic").notNull(),
    instructions: text("instructions"),
    publicToken: text("public_token").notNull(),
    deadline: text("deadline"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_assignments_class_id").on(table.classId),
    index("idx_assignments_professor_id").on(table.professorId),
    uniqueIndex("idx_assignments_public_token").on(table.publicToken),
  ],
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
    studentName: text("student_name").notNull(),
    finalText: text("final_text").notNull(),
    title: text("title"),
    statsJson: text("stats_json").notNull(),
    eventLogJson: text("event_log_json").notNull(),
    pasteEventsJson: text("paste_events_json").notNull(),
    pauseEventsJson: text("pause_events_json").notNull(),
    submittedAt: text("submitted_at").notNull(),
  },
  (table) => [index("idx_submissions_assignment_id").on(table.assignmentId)],
);

export const responseAnnotations = sqliteTable(
  "response_annotations",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
    professorId: text("professor_id").notNull(),
    type: text("type").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    textQuote: text("text_quote"),
    commentText: text("comment_text"),
    color: text("color").notNull(),
    drawingPathJson: text("drawing_path_json"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_response_annotations_submission_id").on(table.submissionId),
    index("idx_response_annotations_professor_id").on(table.professorId),
  ],
);
