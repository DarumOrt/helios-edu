import { backendForward, serverOnly } from "@/shared/lib/backend";

export async function POST(request: Request) {
  return (await backendForward(request, "/api/auth/activate")) ?? serverOnly();
}
