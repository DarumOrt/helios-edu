import { backendGet } from "@/shared/lib/backend";

export async function GET() {
  const response = await backendGet("/api/branding/logo");
  if (!response) return new Response(null, { status: 404 });
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
