// Факультеты ПГГПУ (pspu.ru/about_the_university/departments). code — короткое название,
// как в группах и курсах («ИНЭК»); в C# тот же список — Management/Faculties.cs.
export interface Faculty {
  code: string;
  name: string;
}

export const FACULTIES: Faculty[] = [
  { code: "ИНЭК", name: "Факультет информатики и экономики" },
  { code: "МФ", name: "Математический факультет" },
  { code: "ФизФ", name: "Физический факультет" },
  { code: "ЕНФ", name: "Естественнонаучный факультет" },
  { code: "ФФ", name: "Филологический факультет" },
  { code: "ИстФ", name: "Исторический факультет" },
  { code: "ИнЯз", name: "Факультет иностранных языков" },
  { code: "ПсФ", name: "Факультет психологии" },
  { code: "ПиСПО", name: "Факультет правового и социально-педагогического образования" },
  { code: "ПиМНО", name: "Факультет педагогики и методики начального образования" },
  { code: "ППД", name: "Факультет педагогики и психологии детства" },
  { code: "МузФ", name: "Факультет музыки" },
  { code: "ФФК", name: "Факультет физической культуры" },
];

export const FACULTY_CODES = FACULTIES.map((f) => f.code);

export function facultyName(code: string | undefined): string {
  return FACULTIES.find((f) => f.code === code)?.name ?? code ?? "";
}

/** Учебный год идёт с 1 сентября: в октябре 2026 — «2026/2027». */
export function currentAcademicYear(now = new Date()): string {
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${start + 1}`;
}

export const ACADEMIC_YEAR = /^(\d{4})\/(\d{4})$/;

export function isAcademicYear(value: string): boolean {
  const m = ACADEMIC_YEAR.exec(value);
  return Boolean(m && Number(m[2]) === Number(m[1]) + 1);
}
