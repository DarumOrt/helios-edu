import { backendForward, serverOnly } from "@/shared/lib/backend";

async function forward(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    (await backendForward(request, `/api/catalog-collections/${encodeURIComponent(id)}`)) ?? serverOnly()
  );
}

export const PUT = forward;
export const DELETE = forward;
