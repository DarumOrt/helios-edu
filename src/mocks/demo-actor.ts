import "server-only";
import { cookies } from "next/headers";
import { DEMO_USER_COOKIE } from "@/shared/lib/data-source";
import { findDemoUser } from "@/mocks/users-store";
import type { User } from "@/shared/types/domain";

// Кто действует в демо-режиме. По умолчанию — демо-студент, как в session-store.
export async function getDemoActor(): Promise<User> {
  const id = (await cookies()).get(DEMO_USER_COOKIE)?.value;
  return (id && findDemoUser(decodeURIComponent(id))) || findDemoUser("u-stud-2")!;
}
