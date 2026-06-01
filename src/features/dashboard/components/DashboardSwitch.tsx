"use client";

import { useSessionStore } from "@/stores/session-store";
import { StudentDashboard } from "./StudentDashboard";
import { TeacherDashboard } from "./TeacherDashboard";
import { AdminDashboard } from "./AdminDashboard";

export function DashboardSwitch() {
  const role = useSessionStore((s) => s.role);

  if (role === "student") return <StudentDashboard />;
  if (role === "tutor") return <TeacherDashboard />;
  return <AdminDashboard />; // admin + organizer
}
