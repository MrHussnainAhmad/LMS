import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  unique,
  date,
  time,
  jsonb,
  real
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- ENUMS ---
export const roleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'EMPLOYEE', 'INSTITUTION', 'STAFF', 'STUDENT']);
export const instTypeEnum = pgEnum('institution_type', ['SCHOOL', 'COLLEGE', 'UNIVERSITY']);
export const instStatusEnum = pgEnum('institution_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const attendanceStatusEnum = pgEnum('attendance_status', ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
export const testTypeEnum = pgEnum('test_type', ['DAILY', 'WEEKLY', 'QUIZ', 'MONTHLY', 'MID', 'FINAL']);
export const testCreatorRoleEnum = pgEnum('test_creator_role', ['INSTITUTION', 'STAFF']);
export const onlineTestModeEnum = pgEnum('online_test_mode', ['MCQ', 'MIX']);
export const onlineQuestionTypeEnum = pgEnum('online_question_type', ['MCQ', 'SHORT']);
export const onlineSubmissionStatusEnum = pgEnum('online_submission_status', ['IN_PROGRESS', 'SUBMITTED', 'AUTO_GRADED', 'PENDING_REVIEW', 'GRADED', 'FAILED', 'ABANDONED']);
export const announcementTargetEnum = pgEnum('announcement_target', ['ALL', 'CAMPUS', 'CLASS', 'SECTION', 'USER']);
export const profileRequestStatusEnum = pgEnum('profile_request_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const notificationTypeEnum = pgEnum('notification_type', ['ANNOUNCEMENT', 'EXAM_TIMETABLE', 'ASSIGNMENT', 'TEST', 'MARKS', 'ATTENDANCE', 'GENERAL']);

// --- SUPER ADMIN ---
export const superAdmins = pgTable('super_admins', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  securityQuestion: text('security_question').notNull(),
  securityAnswerHash: text('security_answer_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- EMPLOYEES ---
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: boolean('must_change_password').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// --- INSTITUTIONS ---
export const institutions = pgTable('institutions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: instTypeEnum('type').notNull(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  logoKey: varchar('logo_key', { length: 255 }).notNull(),
  country: varchar('country', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  address: text('address').notNull(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 50 }).notNull(),
  registrationNumber: varchar('registration_number', { length: 100 }).notNull(),
  proofDocumentKey: varchar('proof_document_key', { length: 255 }).notNull(),
  status: instStatusEnum('status').default('PENDING').notNull(),
  rejectionReason: text('rejection_reason'),
  adminPasswordHash: text('admin_password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// --- ACADEMIC SESSIONS ---
export const academicSessions = pgTable('academic_sessions', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(), // e.g. "2025-2026"
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isCurrent: boolean('is_current').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- INSTITUTION HOLIDAYS ---
export const institutionHolidays = pgTable('institution_holidays', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  institutionHolidayUnique: unique('institution_holiday_unique').on(t.institutionId, t.date),
}));

// --- CAMPUSES ---
export const campuses = pgTable('campuses', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// --- STAFF ---
export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  campusId: integer('campus_id').references(() => campuses.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(), // generated slug email
  phone: varchar('phone', { length: 50 }),
  profilePictureUrl: varchar('profile_picture_url', { length: 255 }),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  mustChangePassword: boolean('must_change_password').default(true).notNull(),
  expoPushToken: varchar('expo_push_token', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// --- SUBJECTS ---
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// --- STAFF TEACHABLE SUBJECTS ---
export const staffTeachableSubjects = pgTable('staff_teachable_subjects', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
});

// --- CLASSES ---
export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  level: integer('level').default(0).notNull(), // for sorting
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// --- SECTIONS ---
export const sections = pgTable('sections', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  classTeacherId: integer('class_teacher_id').references(() => staff.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// --- STUDENTS ---
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  campusId: integer('campus_id').references(() => campuses.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  fatherName: varchar('father_name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  gender: varchar('gender', { length: 10 }).default('MALE').notNull(),
  profilePictureUrl: varchar('profile_picture_url', { length: 255 }),
  loginRollNumber: varchar('login_roll_number', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  sectionId: integer('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  yearOfJoining: integer('year_of_joining').notNull(),
  classRollNumber: varchar('class_roll_number', { length: 100 }).notNull(),
  age: integer('age'),
  isActive: boolean('is_active').default(true).notNull(),
  mustChangePassword: boolean('must_change_password').default(true).notNull(),
  expoPushToken: varchar('expo_push_token', { length: 255 }),
  emergencyContact: varchar('emergency_contact', { length: 50 }),
  parentalWhatsapp: varchar('parental_whatsapp', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (t) => ({
  instClassRollUnique: unique('inst_class_roll_unique').on(t.institutionId, t.classId, t.classRollNumber),
}));

// --- STUDENT PROFILE CHANGE REQUESTS ---
export const studentProfileChangeRequests = pgTable('student_profile_change_requests', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  requestedFields: jsonb('requested_fields').notNull(),
  reason: text('reason').notNull(),
  status: profileRequestStatusEnum('status').default('PENDING').notNull(),
  reviewedBy: integer('reviewed_by').references(() => institutions.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  adminNote: text('admin_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- STAFF PROFILE CHANGE REQUESTS ---
export const staffProfileChangeRequests = pgTable('staff_profile_change_requests', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  requestedFields: jsonb('requested_fields').notNull(),
  reason: text('reason').notNull(),
  status: profileRequestStatusEnum('status').default('PENDING').notNull(),
  reviewedBy: integer('reviewed_by').references(() => institutions.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  adminNote: text('admin_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- STAFF ASSIGNMENTS (TIMETABLE) ---
export const staffAssignments = pgTable('staff_assignments', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').references(() => staff.id, { onDelete: 'cascade' }),
  sectionId: integer('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
  isBreak: boolean('is_break').default(false).notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 1 = Monday, etc.
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
}, (t) => ({
  staffTimeSlotUnique: unique('staff_time_slot_unique').on(t.institutionId, t.staffId, t.dayOfWeek, t.startTime),
  sectionTimeSlotUnique: unique('section_time_slot_unique').on(t.institutionId, t.sectionId, t.dayOfWeek, t.startTime),
}));

// --- ASSIGNMENTS ---
export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  sectionId: integer('section_id').references(() => sections.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  dueAt: timestamp('due_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- ATTENDANCES ---
export const attendances = pgTable('attendances', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  sectionId: integer('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  status: attendanceStatusEnum('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  studentDateUnique: unique('student_date_unique').on(t.studentId, t.date),
}));

// --- TESTS ---
export const tests = pgTable('tests', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  sectionId: integer('section_id').references(() => sections.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').references(() => staff.id, { onDelete: 'set null' }),
  createdByRole: testCreatorRoleEnum('created_by_role').notNull(),
  type: testTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  maxMarks: real('max_marks').notNull(),
  date: date('date').notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- MARKS ---
export const marks = pgTable('marks', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  testId: integer('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  marksObtained: real('marks_obtained').notNull(),
  totalMarks: real('total_marks').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  studentTestUnique: unique('student_test_unique').on(t.testId, t.studentId),
}));

// --- ONLINE TESTS ---
export const onlineTests = pgTable('online_tests', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  testId: integer('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }).unique(),
  mode: onlineTestModeEnum('mode').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const onlineTestQuestions = pgTable('online_test_questions', {
  id: serial('id').primaryKey(),
  onlineTestId: integer('online_test_id').notNull().references(() => onlineTests.id, { onDelete: 'cascade' }),
  questionType: onlineQuestionTypeEnum('question_type').notNull(),
  prompt: text('prompt').notNull(),
  options: jsonb('options'),
  correctOptionIndex: integer('correct_option_index'),
  marks: real('marks').notNull(),
  orderIndex: integer('order_index').notNull(),
});

export const onlineTestSubmissions = pgTable('online_test_submissions', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  onlineTestId: integer('online_test_id').notNull().references(() => onlineTests.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  status: onlineSubmissionStatusEnum('status').notNull(),
  answers: jsonb('answers').notNull(),
  mcqScore: real('mcq_score').default(0).notNull(),
  shortScore: real('short_score'),
  totalScore: real('total_score').default(0).notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastHeartbeatAt: timestamp('last_heartbeat_at'),
  violationReason: varchar('violation_reason', { length: 50 }),
  submittedAt: timestamp('submitted_at'),
  gradedAt: timestamp('graded_at'),
  gradedBy: integer('graded_by').references(() => staff.id, { onDelete: 'set null' }),
}, (t) => ({
  studentOnlineTestUnique: unique('student_online_test_unique').on(t.onlineTestId, t.studentId),
}));

// --- ANNOUNCEMENTS ---
export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  senderRole: roleEnum('sender_role').notNull(),
  senderId: integer('sender_id').notNull(), // maps to ID of sender in their role table
  targetType: announcementTargetEnum('target_type').notNull(),
  targetCampusId: integer('target_campus_id').references(() => campuses.id, { onDelete: 'cascade' }),
  targetClassId: integer('target_class_id').references(() => classes.id, { onDelete: 'cascade' }),
  targetSectionId: integer('target_section_id').references(() => sections.id, { onDelete: 'cascade' }),
  targetUserRole: roleEnum('target_user_role'),
  targetUserId: integer('target_user_id'),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- ANNOUNCEMENT READS ---
export const announcementReads = pgTable('announcement_reads', {
  id: serial('id').primaryKey(),
  announcementId: integer('announcement_id').notNull().references(() => announcements.id, { onDelete: 'cascade' }),
  userRole: roleEnum('user_role').notNull(),
  userId: integer('user_id').notNull(),
  readAt: timestamp('read_at').defaultNow().notNull(),
}, (t) => ({
  userAnnouncementUnique: unique('user_announcement_unique').on(t.announcementId, t.userRole, t.userId),
}));

// --- NOTIFICATIONS ---
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  userRole: roleEnum('user_role').notNull(),
  userId: integer('user_id').notNull(),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  referenceId: integer('reference_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- SUBMISSIONS ---
export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  fileKey: varchar('file_key', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  studentAssignmentUnique: unique('student_assignment_unique').on(t.assignmentId, t.studentId),
}));

// --- AUDIT LOGS ---
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id'), // null for super admin actions outside institution
  actorId: integer('actor_id').notNull(),
  actorRole: roleEnum('actor_role').notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  target: varchar('target', { length: 255 }).notNull(),
  ip: varchar('ip', { length: 50 }),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// --- REFRESH TOKENS ---
export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userRole: roleEnum('user_role').notNull(),
  userId: integer('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  replacedByHash: text('replaced_by_hash'),
  reuseDetectedAt: timestamp('reuse_detected_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- ACCOUNT LOCKOUTS ---
export const accountLockouts = pgTable('account_lockouts', {
  id: serial('id').primaryKey(),
  userRole: roleEnum('user_role').notNull(),
  userId: integer('user_id').notNull(),
  failedCount: integer('failed_count').default(0).notNull(),
  windowStartedAt: timestamp('window_started_at').defaultNow().notNull(),
  lockedUntil: timestamp('locked_until'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  accountLockoutUserUnique: unique('account_lockout_user_unique').on(t.userRole, t.userId),
}));

// --- PASSWORD RESETS ---
export const passwordResets = pgTable('password_resets', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').references(() => institutions.id, { onDelete: 'cascade' }),
  userRole: roleEnum('user_role').notNull(), // Usually INSTITUTION admin for email reset
  userId: integer('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- PLATFORM REVIEWS ---
export const platformReviews = pgTable('platform_reviews', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }).unique(),
  rating: integer('rating').notNull(), // 1 to 5
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- PLATFORM PAGES (FOOTER) ---
export const platformPages = pgTable('platform_pages', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(), // e.g. 'about-us'
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  lastEditedAt: timestamp('last_edited_at').defaultNow().notNull(),
  lastEditedBy: integer('last_edited_by'), // Generic user ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- FEATURED INSTITUTIONS (HOMEPAGE LOGOS) ---
export const featuredInstitutions = pgTable('featured_institutions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  logoKey: varchar('logo_key', { length: 255 }), // Cloudinary public_id or URL (optional)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
