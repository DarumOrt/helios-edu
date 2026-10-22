import { users as seed } from "@/mocks/data";
import type { User } from "@/shared/types/domain";

// Пользователи демо-режима: исходные моки + созданные (регистрация, админка) + правки.
// Живут на globalThis, чтобы переживать HMR; сбрасываются при перезапуске сервера.
// В серверном режиме источник — C# API.
const g = globalThis as unknown as { __helios_users?: User[] };
const store: User[] = g.__helios_users ?? (g.__helios_users = seed.map((u) => ({ ...u, status: "active" })));

export function allDemoUsers(): User[] {
  return store;
}

export function findDemoUser(id: string): User | undefined {
  return store.find((u) => u.id === id);
}

export function findDemoUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return store.find((u) => u.email.toLowerCase() === normalized);
}

export function createDemoUser(input: Omit<User, "id" | "tenantId">): User {
  const user: User = { ...input, id: `u-demo-${crypto.randomUUID().slice(0, 8)}`, tenantId: "pspu" };
  store.push(user);
  return user;
}

export function updateDemoUser(id: string, patch: Partial<Omit<User, "id" | "tenantId">>): User | undefined {
  const user = findDemoUser(id);
  if (!user) return undefined;
  Object.assign(user, patch);
  // undefined в патче означает «убрать поле» (например, группу)
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete user[k as keyof User];
  return user;
}

// Как и на сервере: самостоятельно регистрируется только студент без группы.
export function registerDemoUser(input: { name: string; email: string }): User {
  return createDemoUser({
    name: input.name.trim(),
    email: input.email.trim(),
    role: "student",
    status: "active",
  });
}
