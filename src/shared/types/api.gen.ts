// Сгенерировано scripts/api-types.mjs из docs/api/openapi.json — не править руками.
// C# не пишет null в ответы (JsonIgnoreCondition.WhenWritingNull): поле «| null» на деле просто отсутствует.

export type Activity = {
  id: string;
  type: string;
  title: string;
  durationMin?: number | null;
  completed?: boolean | null;
  due?: string;
  description?: string | null;
  maxGrade?: number | null;
  maxAttempts?: number | null;
  src?: string | null;
  pages?: number | null;
};

export type AnnouncementInfo = {
  id: string;
  courseId: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
};

export type AttemptsSummary = {
  maxAttempts: number | null;
  used: number;
  open: boolean;
  bestPercent: number | null;
};

export type AuditChange = {
  field: string;
  before: string | null;
  after: string | null;
};

export type AuditEntryInfo = {
  id: number;
  at: string;
  actorName: string;
  actorRole: string;
  action: string;
  actionText: string;
  category: string;
  targetType: string;
  targetId: string | null;
  target: string;
  changes: AuditChange[] | null;
};

export type AuditPage = {
  items: AuditEntryInfo[];
  nextCursor: number | null;
};

export type CatalogCohort = {
  id: string;
  name: string;
  year: number | null;
  level: string | null;
  directionCode: string | null;
  direction: string | null;
  profile: string | null;
};

export type CatalogCourse = {
  id: string;
  code: string;
  title: string;
  description: string;
  cover: string | null;
  coverColor: string | null;
  category: string;
  faculty: string | null;
  academicYear: string | null;
  tutor: CatalogTutor;
  cohorts: CatalogCohort[];
  sections: CatalogSection[];
  accessible: boolean;
};

export type CatalogSection = {
  title: string;
  activities: number;
};

export type CatalogTutor = {
  id: string;
  name: string;
};

export type ClassmateInfo = {
  id: string;
  name: string;
  group: string | null;
};

export type CleanupResult = {
  abandoned: number;
  trashed: number;
  restored: number;
  deleted: number;
  orphans: number;
  courses?: number;
  courseItems?: number;
};

export type CohortInfo = {
  id: string;
  name: string;
  faculty: string | null;
  memberIds: string[];
  courseIds: string[];
  year: number | null;
  level: string | null;
  directionCode: string | null;
  direction: string | null;
  profile: string | null;
};

export type CourseActivityStat = {
  activityId: string;
  title: string;
  type: string;
  started: number;
  completed: number;
  total: number;
  avgCoverage: number;
  avgTimeSec: number;
};

export type CourseActivityStats = {
  activities: CourseActivityStat[];
};

export type CourseDetail = {
  sections: Section[];
  id: string;
  code: string;
  title: string;
  description: string;
  cover: string | null;
  category: string;
  tutorId: string;
  enrolled: number;
  progress: number | null;
  status: string;
  coverColor: string | null;
  faculty: string | null;
  academicYear: string | null;
};

export type CourseImpact = {
  students: number;
  submissions: number;
  grades: number;
  attempts: number;
};

export type CourseSummary = {
  id: string;
  code: string;
  title: string;
  description: string;
  cover: string | null;
  category: string;
  tutorId: string;
  enrolled: number;
  progress: number | null;
  status: string;
  coverColor: string | null;
  faculty: string | null;
  academicYear: string | null;
};

export type DeletedCourseInfo = {
  id: string;
  code: string;
  title: string;
  tutorId: string;
  deletedAt: string;
  deletedByName: string;
  purgeAt: string;
  impact: CourseImpact;
};

export type GradeItem = {
  itemId: string;
  itemTitle: string;
  grade: number | null;
  max: number;
};

export type GradeRow = {
  userId: string;
  userName: string;
  items: GradeItem[];
  total: number;
};

export type JsonElement = unknown;

export type Leaderboard = {
  courseId: string;
  entries: LeaderboardEntry[];
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  userName: string;
  group: string;
  score: number;
  materialsCompleted: number;
  materialsTotal: number;
  avgCoverage: number;
  quizAvg: number | null;
  streak: number;
  isCurrentUser: boolean | null;
};

export type LessonStatRow = {
  userId: string;
  userName: string;
  group: string | null;
  coverage: number;
  activeTimeSec: number;
  completed: boolean;
  seeks: number | null;
  pagesViewed: number | null;
  totalPages: number | null;
  lastAt: number | null;
  status: string;
};

export type LessonStats = {
  rows: LessonStatRow[];
  events: TrackingEventInfo[] | null;
};

export type LoginRequest = {
  email: string | null;
  password: string | null;
};

export type MySubmission = {
  submission: SubmissionInfo | null;
};

export type NotificationInfo = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link: string | null;
};

export type PairTimeInfo = {
  n: number;
  start: string;
  end: string;
};

export type PasswordChangeRequest = {
  currentPassword: string | null;
  newPassword: string | null;
};

export type PasswordResetResult = {
  user: UserInfo;
  temporaryPassword: string;
};

export type ProgressInfo = {
  sessionId: string;
  userId: string;
  activityId: string;
  activityType: string;
  coverage: number;
  activeTimeSec: number;
  completed: boolean;
  seeks: number | null;
  pauses: number | null;
  maxRate: number | null;
  pagesViewed: number | null;
  totalPages: number | null;
  durationSec: number | null;
  position: number | null;
  ts: number;
  userName: string;
  group: string | null;
  firstAt: number;
  lastAt: number;
  sessions: number;
};

export type RegisterRequest = {
  name: string | null;
  email: string | null;
  password: string | null;
  consent: boolean | null;
};

export type ScheduleCourse = {
  id: string;
  code: string;
  title: string;
  coverColor: string | null;
};

export type ScheduleInfo = {
  group: string;
  pairs: PairTimeInfo[];
  slots: ScheduleSlotInfo[];
};

export type ScheduleSlotInfo = {
  id: string;
  courseId: string;
  weekday: number;
  pair: number;
  kind: string;
  room: string;
  course: ScheduleCourse | null;
};

export type Section = {
  id: string;
  title: string;
  order?: number;
  activities?: Activity[];
};

export type SettingsInfo = {
  allowRegistration: boolean;
  announcementsEnabled: boolean;
};

export type SkillInfo = {
  id: string;
  courseId: string;
  sectionId: string | null;
  code: string | null;
  title: string;
  description: string | null;
  order: number;
  isAuto: boolean;
  pInit: number;
  pLearn: number;
  pSlip: number;
  pGuess: number;
  prerequisiteIds: string[];
  activityIds: string[];
};

export type StoredFileInfo = {
  id: string;
  kind: string;
  courseId: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
};

export type StudentCourseGrades = {
  courseId: string;
  courseTitle: string;
  courseCode: string;
  items: GradeItem[];
  total: number;
};

export type StudentGrades = {
  courses: StudentCourseGrades[];
};

export type SubmissionInfo = {
  id: string;
  assignmentId: string;
  courseId: string;
  userId: string;
  text: string;
  fileName: string | null;
  fileId: string | null;
  status: string;
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
  userName: string;
  group: string | null;
  assignmentTitle: string;
  courseTitle: string;
  maxGrade: number;
};

export type SubmissionList = {
  items: SubmissionInfo[];
};

export type SubmitResult = {
  id: string;
  status: string;
};

export type TrackingAccepted = {
  ok: boolean;
  accepted: number;
};

export type TrackingEventInfo = {
  id: string;
  sessionId: string;
  userId: string;
  activityId: string;
  activityType: string;
  verb: string;
  position: number | null;
  payload: JsonElement | null;
  ts: number;
};

export type TrashItemInfo = {
  id: string;
  kind: string;
  title: string;
  type: string | null;
  sectionTitle: string | null;
  deletedAt: string;
  deletedByName: string;
  purgeAt: string;
};

export type UploadTicket = {
  id: string;
  uploadUrl: string;
  contentType: string;
  expiresAt: string;
};

export type UserInfo = {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  faculty: string | null;
  group: string | null;
  status: string;
  mustChangePassword: boolean | null;
};
