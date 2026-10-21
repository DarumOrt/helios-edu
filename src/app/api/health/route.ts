import { NextResponse } from "next/server";

// Liveness-проба для Docker HEALTHCHECK и CI smoke-теста
export function GET() {
  return NextResponse.json({ status: "ok" });
}
