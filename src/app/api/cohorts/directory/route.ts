import { type NextRequest, NextResponse } from "next/server";
import { cohortDirectory } from "@/mocks/directories";
import { demoActorWith } from "@/mocks/management-guards";
import { backendForward } from "@/shared/lib/backend";

export async function GET(request: NextRequest) {
  const forwarded = await backendForward(request, `/api/cohorts/directory${request.nextUrl.search}`);
  if (forwarded) return forwarded;
  const actor = await demoActorWith("cohort.manage");
  return actor instanceof NextResponse
    ? actor
    : NextResponse.json(cohortDirectory(request.nextUrl.searchParams));
}
