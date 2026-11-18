import { users as seed } from "@/mocks/data";
import type { DirectoryUser, PendingUser, User } from "@/shared/types/domain";

// Пользователи демо-режима: исходные моки + созданные (регистрация, админка) + правки.
// Живут на globalThis, чтобы переживать HMR; сбрасываются при перезапуске сервера.
// В серверном режиме источник — C# API.
const g = globalThis as unknown as {
  __helios_users?: (User & { createdAt?: string })[];
  __helios_applications?: (PendingUser & { createdAt: string })[];
};
const store: (User & { createdAt?: string })[] =
  g.__helios_users ?? (g.__helios_users = seed.map((u) => ({ ...u, status: "active" })));
const applications = g.__helios_applications ?? (g.__helios_applications = []);

export function allDemoUsers(): User[] {
  return store;
}

export function findDemoUser(id: string): User | undefined {
  return store.find((u) => u.id === id);
}

export function findDemoUserByEmail(email: string): DirectoryUser | undefined {
  const normalized = email.trim().toLowerCase();
  return directoryDemoUsers().find((u) => u.email.toLowerCase() === normalized);
}

export function createDemoUser(input: Omit<User, "id" | "tenantId">): User {
  const user = {
    ...input,
    id: `u-demo-${crypto.randomUUID().slice(0, 8)}`,
    tenantId: "pspu",
    createdAt: new Date().toISOString(),
  };
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

export function directoryDemoUsers(): DirectoryUser[] {
  return [...store, ...applications];
}

export function registerDemoUser(input: { name: string; email: string }) {
  applications.push({
    name: input.name.trim(),
    email: input.email.trim(),
    id: `u-demo-${crypto.randomUUID().slice(0, 8)}`,
    tenantId: "pspu",
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

export function takeDemoApplication(id: string) {
  const index = applications.findIndex((user) => user.id === id);
  return index === -1 ? undefined : applications.splice(index, 1)[0];
}

export function approveDemoApplication(id: string, patch: Pick<User, "role" | "group" | "faculty">) {
  const application = takeDemoApplication(id);
  if (!application) return;
  const user = { ...application, ...patch, status: "active" as const };
  store.push(user);
  return user;
}
