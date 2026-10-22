// Правила регистрации — одни для формы, маршрута Next и C# API (AuthEndpoints.ValidateRegistration).
export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  consent: boolean;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationInput, string>>;

export const PASSWORD_MIN = 8;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function passwordChecks(password: string) {
  return [
    { ok: password.length >= PASSWORD_MIN, label: `не короче ${PASSWORD_MIN} символов` },
    { ok: /\p{L}/u.test(password) && /\d/.test(password), label: "буквы и хотя бы одна цифра" },
  ];
}

export function validateRegistration(input: Partial<RegistrationInput>): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";

  if (name.length < 2) errors.name = "Укажите имя и фамилию";
  else if (name.length > 100) errors.name = "Имя длиннее 100 символов — сократите";

  if (!email) errors.email = "Укажите почту";
  else if (email.length > 254 || !EMAIL.test(email))
    errors.email = "Почта выглядит неполной, например name@pstu.ru";

  if (!password) errors.password = "Придумайте пароль";
  else if (password.length > 256) errors.password = "Пароль длиннее 256 символов";
  else if (passwordChecks(password).some((c) => !c.ok))
    errors.password = `Пароль: не короче ${PASSWORD_MIN} символов, буквы и цифра`;

  if (input.consent !== true) errors.consent = "Без согласия мы не сможем создать учётную запись";
  return errors;
}
