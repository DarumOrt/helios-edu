import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!process.env.BACKEND_API_URL) redirect("/dashboard");
  return <LoginForm />;
}
