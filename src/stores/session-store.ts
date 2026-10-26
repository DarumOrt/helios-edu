"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User } from "@/shared/types/domain";
import { DEMO_USER_COOKIE } from "@/shared/lib/data-source";

// Сообщаем моковым маршрутам, кто сейчас действует в демо (см. mocks/demo-actor.ts)
function syncDemoCookie(user: User) {
  if (typeof document === "undefined") return;
  document.cookie = `${DEMO_USER_COOKIE}=${encodeURIComponent(user.id)}; path=/; samesite=lax; max-age=2592000`;
}

export const usersByRole: Record<Role, User> = {
  admin: {
    id: "u-admin",
    name: "Иван Морозов",
    email: "admin@pspu.ru",
    role: "admin",
    tenantId: "pspu",
    faculty: "ИНЭК",
  },
  organizer: {
    id: "u-org",
    name: "Анна Лебедева",
    email: "organizer@pspu.ru",
    role: "organizer",
    tenantId: "pspu",
    faculty: "ИНЭК",
  },
  tutor: {
    id: "u-tutor-1",
    name: "Наталья Казаринова",
    email: "tutor@pspu.ru",
    role: "tutor",
    tenantId: "pspu",
    faculty: "ИНЭК",
  },
  student: {
    id: "u-stud-2",
    name: "Иван Вагулин",
    email: "student@student.pspu.ru",
    role: "student",
    tenantId: "pspu",
    faculty: "ИНЭК",
    group: "М1217",
  },
};

interface SessionState {
  role: Role;
  user: User;
  setRole: (role: Role) => void;
  /** демо-регистрация: войти под только что созданным пользователем */
  setUser: (user: User) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: "student",
      user: usersByRole.student,
      setRole: (role) => {
        syncDemoCookie(usersByRole[role]);
        set({ role, user: usersByRole[role] });
      },
      setUser: (user) => {
        syncDemoCookie(user);
        set({ role: user.role, user });
      },
    }),
    {
      name: "helios-session",
      // после чтения из localStorage cookie должна совпадать с восстановленным пользователем
      onRehydrateStorage: () => (state) => {
        if (state) syncDemoCookie(state.user);
      },
    },
  ),
);
