import { NextResponse } from "next/server";
import { listAudit } from "@/mocks/audit-store";
import { demoActorWith } from "@/mocks/management-guards";
import { backendForward } from "@/shared/lib/backend";

// GET ?from=&to=&category=&role=&q=&cursor=&limit= — журнал действий, только администратор.
// Сервер — C# (Audit/AuditEndpoints.cs), демо — журнал в памяти Next с теми же фильтрами.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const forwarded = await backendForward(req, `/api/audit${url.search}`);
  if (forwarded) return forwarded;
  const actor = await demoActorWith("system.manage");
  if (actor instanceof NextResponse) return actor;
  const p = url.searchParams;
  const number = (key: string) => (p.get(key) ? Number(p.get(key)) : null);
  return NextResponse.json(
    listAudit({
      from: p.get("from"),
      to: p.get("to"),
      category: p.get("category"),
      role: p.get("role"),
      q: p.get("q"),
      cursor: number("cursor"),
      limit: number("limit"),
    }),
  );
}
