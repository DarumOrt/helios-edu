import { backendForward, serverOnly } from "@/shared/lib/backend";

export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  return (
    (await backendForward(
      request,
      `/api/users/import${path.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`,
    )) ?? serverOnly()
  );
}
