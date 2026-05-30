"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User } from "@/shared/types/domain";

const usersByRole: Record<Role, User> = {
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
    email: "kazarinova@pspu.ru",
    role: "tutor",
    tenantId: "pspu",
    faculty: "ИНЭК",
  },
  student: {
    id: "u-stud-2",
    name: "Иван Вагулин",
    email: "vagulin@student.pspu.ru",
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
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: "student",
      user: usersByRole.student,
      setRole: (role) => set({ role, user: usersByRole[role] }),
    }),
    { name: "helios-session" }
  )
);
