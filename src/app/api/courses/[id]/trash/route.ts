import { NextResponse } from "next/server";
import { backendForward } from "@/shared/lib/backend";

// Корзина курса: удалённые модули и материалы. Сервер — C#; в демо материалы удаляются сразу.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forwarded = await backendForward(req, `/api/courses/${encodeURIComponent(id)}/trash`);
  return forwarded ?? NextResponse.json([]);
}
