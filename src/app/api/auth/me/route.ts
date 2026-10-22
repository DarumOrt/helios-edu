import { backendGet } from "@/shared/lib/backend";

export async function GET() {
  return (await backendGet("/api/auth/me")) ?? Response.json({ mode: "demo" });
}
