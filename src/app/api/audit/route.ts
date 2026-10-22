import { NextResponse } from "next/server";
import { listAudit } from "@/mocks/audit-store";
import { demoActorWith } from "@/mocks/management-guards";
import { getDataSource } from "@/shared/lib/backend";

// Журнал действий — только администратору (в сервере проверяет proxy.ts)
export async function GET() {
  if ((await getDataSource()).source === "demo") {
    const actor = await demoActorWith("system.manage");
    if (actor instanceof NextResponse) return actor;
  }
  return NextResponse.json(listAudit());
}
