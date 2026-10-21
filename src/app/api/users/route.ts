import { NextResponse } from "next/server";
import { users } from "@/mocks/data";
import { backendGet } from "@/shared/lib/backend";

// GET ?group=М1217 — только участники группы
export async function GET(req: Request) {
  const group = new URL(req.url).searchParams.get("group");
  const response = await backendGet(
    group ? `/api/users/classmates?group=${encodeURIComponent(group)}` : "/api/users",
  );
  if (response) return response;
  return NextResponse.json(group ? users.filter((u) => u.group === group) : users);
}
