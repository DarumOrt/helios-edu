// Сверка контракта Next ↔ C#: типы интерфейса (domain.ts) против типов из описания C# API (api.gen.ts).
// Проверяет `npm run typecheck`: если в C# переименовали, добавили или убрали поле, сменили его вид
// (строка/число/массив) — здесь будет ошибка компиляции с именем поля.
// Как обновить api.gen.ts — scripts/api-types.mjs (npm run api:types).
import type * as Api from "./api.gen";
import type {
  ActivityProgress,
  LeaderboardEntry,
  LessonStatRow,
  TrackingEvent,
} from "@/shared/lib/tracking/types";
import type {
  Activity,
  Announcement,
  CatalogCohort,
  CatalogCourse,
  Cohort,
  Course,
  GradeRow,
  Notification,
  Section,
  Skill,
  StudentCourseGrades,
  SubmissionFull,
  MySubmission,
  Classmate,
  UploadTicket,
  SystemSettings,
  PasswordResetResult,
  CourseImpact,
  DeletedCourse,
  CourseTrashItem,
  PairTime,
  AuditEntry,
  AuditChange,
  AuditPage,
  UploadedFile,
  AttemptsSummary,
  User,
} from "./domain";

type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];

// Вид значения без null/undefined: строковые союзы ("draft" | "published") — тоже «string».
type Kind<T> = T extends string
  ? "string"
  : T extends number
    ? "number"
    : T extends boolean
      ? "boolean"
      : T extends readonly unknown[]
        ? "array"
        : "object";

type KindMismatch<A, U> = {
  [K in keyof A & keyof U]: Kind<NonNullable<A[K]>> extends Kind<NonNullable<U[K]>> ? never : K;
}[keyof A & keyof U];

/** true — поля совпадают; иначе объект с именами расходящихся полей (он и попадёт в текст ошибки) */
type SameFields<A, U> = [Exclude<keyof A, keyof U>] extends [never]
  ? [Exclude<RequiredKeys<U>, keyof A>] extends [never]
    ? [KindMismatch<A, U>] extends [never]
      ? true
      : { fieldKindDiffers: KindMismatch<A, U> }
    : { missingInApi: Exclude<RequiredKeys<U>, keyof A> }
  : { unknownInInterface: Exclude<keyof A, keyof U> };

type Assert<T extends true> = T;

export type ApiContract = [
  Assert<SameFields<Api.CourseSummary, Course>>,
  Assert<SameFields<Api.CourseDetail, Course>>,
  Assert<SameFields<Api.Section, Section>>,
  Assert<SameFields<Api.Activity, Activity>>,
  Assert<SameFields<Api.CatalogCourse, CatalogCourse>>,
  Assert<SameFields<Api.CatalogCohort, CatalogCohort>>,
  Assert<SameFields<Api.CatalogTutor, CatalogCourse["tutor"]>>,
  Assert<SameFields<Api.CatalogSection, CatalogCourse["sections"][number]>>,
  Assert<SameFields<Api.CohortInfo, Cohort>>,
  Assert<SameFields<Api.SkillInfo, Skill>>,
  Assert<SameFields<Api.UserInfo, User>>,
  Assert<SameFields<Api.SubmissionInfo, SubmissionFull>>,
  Assert<SameFields<Api.GradeRow, GradeRow>>,
  Assert<SameFields<Api.GradeItem, GradeRow["items"][number]>>,
  Assert<SameFields<Api.StudentCourseGrades, StudentCourseGrades>>,
  Assert<SameFields<Api.SubmitResult, Pick<SubmissionFull, "id" | "status">>>,
  Assert<SameFields<Api.MySubmission, MySubmission>>,
  Assert<SameFields<Api.ClassmateInfo, Classmate>>,
  Assert<SameFields<Api.UploadTicket, UploadTicket>>,
  Assert<SameFields<Api.SettingsInfo, SystemSettings>>,
  Assert<SameFields<Api.PasswordResetResult, PasswordResetResult>>,
  Assert<SameFields<Api.CourseImpact, CourseImpact>>,
  Assert<SameFields<Api.DeletedCourseInfo, DeletedCourse>>,
  Assert<SameFields<Api.TrashItemInfo, CourseTrashItem>>,
  Assert<SameFields<Api.ProgressInfo, ActivityProgress>>,
  Assert<SameFields<Api.TrackingEventInfo, TrackingEvent>>,
  Assert<SameFields<Api.LessonStatRow, LessonStatRow>>,
  Assert<SameFields<Api.LeaderboardEntry, LeaderboardEntry>>,
  Assert<SameFields<Api.PairTimeInfo, PairTime>>,
  Assert<SameFields<Api.AuditEntryInfo, AuditEntry>>,
  Assert<SameFields<Api.AuditChange, AuditChange>>,
  Assert<SameFields<Api.AuditPage, AuditPage>>,
  Assert<SameFields<Api.StoredFileInfo, UploadedFile>>,
  Assert<SameFields<Api.AttemptsSummary, AttemptsSummary>>,
  Assert<SameFields<Api.AnnouncementInfo, Announcement>>,
  Assert<SameFields<Api.NotificationInfo, Notification>>,
];
