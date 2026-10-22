import { NextResponse } from "next/server";
import { backendRequest, isSameOrigin } from "@/shared/lib/backend";
import { validateRegistration, type RegistrationInput } from "@/shared/lib/registration";
import { findDemoUserByEmail, registerDemoUser } from "@/mocks/users-store";

// POST { name, email, password, consent } — самостоятельная регистрация студента.
// Сервер: создаёт аккаунт и сессию в C# API. Демо: пользователь в памяти, вход выполняет клиент.
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Недопустимый источник запроса" }, { status: 403 });

  let body: Partial<RegistrationInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const input = {
    name: typeof body.name === "string" ? body.name : "",
    email: typeof body.email === "string" ? body.email : "",
    password: typeof body.password === "string" ? body.password : "",
    consent: body.consent === true,
  };

  const backend = await backendRequest("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (backend) return backend;

  const errors = validateRegistration(input);
  if (Object.keys(errors).length)
    return NextResponse.json({ error: "Проверьте поля формы", fields: errors }, { status: 400 });
  if (findDemoUserByEmail(input.email))
    return NextResponse.json(
      { error: "Эта почта уже зарегистрирована", fields: { email: "Эта почта уже зарегистрирована" } },
      { status: 409 },
    );
  return NextResponse.json(registerDemoUser(input), { status: 201 });
}
