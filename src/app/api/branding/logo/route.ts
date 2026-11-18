import { backendGet } from "@/shared/lib/backend";

export async function GET(request: Request) {
  const dark = new URL(request.url).searchParams.get("theme") === "dark";
  const response = await backendGet(dark ? "/api/branding/logo?theme=dark" : "/api/branding/logo");
  if (!response) return new Response(null, { status: 404 });
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
