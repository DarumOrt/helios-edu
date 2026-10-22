import { users } from "@/mocks/data";
import type { User } from "@/shared/types/domain";

// Пользователи, зарегистрированные в демо-режиме. Живут на globalThis, чтобы переживать HMR;
// сбрасываются при перезапуске сервера. В серверном режиме регистрация идёт в C# API.
const g = globalThis as unknown as { __helios_registered?: User[] };
const registered: User[] = g.__helios_registered ?? (g.__helios_registered = []);

export function allDemoUsers(): User[] {
  return [...users, ...registered];
}

export function findDemoUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return allDemoUsers().find((u) => u.email.toLowerCase() === normalized);
}

// Как и на сервере: роль всегда «студент», группу назначает организатор.
export function registerDemoUser(input: { name: string; email: string }): User {
  const user: User = {
    id: `u-demo-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name,
    email: input.email.trim(),
    role: "student",
    tenantId: "pspu",
  };
  registered.push(user);
  return user;
}
