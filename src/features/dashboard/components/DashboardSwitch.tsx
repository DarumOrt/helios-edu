"use client";

import { useSession } from "@/shared/auth/session";
import { StudentDashboard } from "./StudentDashboard";
import { TeacherDashboard } from "./TeacherDashboard";
import { AdminDashboard } from "./AdminDashboard";

export function DashboardSwitch() {
  const role = useSession((s) => s.role);

  if (role === "student") return <StudentDashboard />;
  if (role === "tutor") return <TeacherDashboard />;
  return <AdminDashboard />; // admin + organizer
}
