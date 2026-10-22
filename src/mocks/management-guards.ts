import "server-only";
import { NextResponse } from "next/server";
import { getDemoActor } from "@/mocks/demo-actor";
import { can, type Action } from "@/shared/auth/permissions";
import type { User } from "@/shared/types/domain";

// Общие ответы моковых маршрутов управления — в формате C# API: { error, fields? }.
export const fail = (status: number, error: string, fields?: Record<string, string>) =>
  NextResponse.json(fields ? { error, fields } : { error }, { status });

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/** Демо-актор с нужным правом или ответ 403 */
export async function demoActorWith(action: Action): Promise<User | NextResponse> {
  const actor = await getDemoActor();
  return can(actor.role, action) ? actor : fail(403, "Недостаточно прав");
}

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
