import { type NextRequest, NextResponse } from "next/server";
import { userDirectory } from "@/mocks/directories";
import { demoActorWith } from "@/mocks/management-guards";
import { backendForward } from "@/shared/lib/backend";

export async function GET(request: NextRequest) {
  const forwarded = await backendForward(request, `/api/users/directory${request.nextUrl.search}`);
  if (forwarded) return forwarded;
  const actor = await demoActorWith("user.manage");
  return actor instanceof NextResponse
    ? actor
    : NextResponse.json(userDirectory(request.nextUrl.searchParams));
}
