import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";

// Корзина курсов (7 дней до окончательного удаления). Сервер — C# (Courses/CourseTrash.cs); в демо корзины нет.
export async function GET(req: Request) {
  const forwarded = await backendForward(req, "/api/courses/trash");
  return forwarded ?? NextResponse.json([]);
}
