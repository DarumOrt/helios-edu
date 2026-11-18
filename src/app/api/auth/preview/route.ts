import { backendForward, serverOnly } from "@/shared/lib/backend";

async function changePreview(request: Request) {
  return (await backendForward(request, "/api/auth/preview")) ?? serverOnly();
}

export { changePreview as POST, changePreview as DELETE };
