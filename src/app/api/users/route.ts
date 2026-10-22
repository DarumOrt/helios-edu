import { NextResponse } from "next/server";
import { allDemoUsers } from "@/mocks/users-store";
import { backendGet } from "@/shared/lib/backend";

// GET ?group=М1217 — только участники группы
export async function GET(req: Request) {
  const group = new URL(req.url).searchParams.get("group");
  const response = await backendGet(
    group ? `/api/users/classmates?group=${encodeURIComponent(group)}` : "/api/users",
  );
  if (response) return response;
  const users = allDemoUsers();
  return NextResponse.json(group ? users.filter((u) => u.group === group) : users);
}
