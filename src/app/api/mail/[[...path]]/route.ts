import { backendForward, serverOnly } from "@/shared/lib/backend";

async function forward(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  return (
    (await backendForward(request, `/api/mail/${path.map(encodeURIComponent).join("/")}`)) ?? serverOnly()
  );
}
export { forward as GET, forward as POST, forward as PUT };
