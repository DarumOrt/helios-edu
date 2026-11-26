import { backendForward, serverOnly } from "@/shared/lib/backend";

export async function GET(request: Request) {
  return (await backendForward(request, "/api/catalog-collections")) ?? Response.json([]);
}

export async function POST(request: Request) {
  return (await backendForward(request, "/api/catalog-collections")) ?? serverOnly();
}
