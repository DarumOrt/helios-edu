import { NextResponse } from "next/server";
import { demoCatalog } from "@/mocks/catalog";
import { backendForward } from "@/shared/lib/backend";

// GET — поиск курсов: опубликованные курсы вуза для всех ролей (фильтрует интерфейс).
export async function GET(req: Request) {
  const forwarded = await backendForward(req, "/api/catalog");
  if (forwarded) return forwarded;
  return NextResponse.json(await demoCatalog());
}
