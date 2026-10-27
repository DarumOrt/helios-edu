// Сгенерировано scripts/api-types.mjs из docs/api/openapi.json — не править руками.
// C# не пишет null в ответы (JsonIgnoreCondition.WhenWritingNull): поле «| null» на деле просто отсутствует.

export type Activity = {
  id: string;
  type: string;
  title: string;
  durationMin?: number | null;
  completed?: boolean | null;
  due?: string | null;
  description?: string | null;
  maxGrade?: number | null;
  src?: string | null;
  pages?: number | null;
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

export type LoginRequest = {
  email: string | null;
  password: string | null;
};

export type RegisterRequest = {
  name: string | null;
  email: string | null;
  password: string | null;
  consent: boolean | null;
};

export type Section = {
  id: string;
  title: string;
  order?: number;
  activities?: Activity[];
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

export type UserInfo = {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  faculty: string | null;
  group: string | null;
  status: string;
};
