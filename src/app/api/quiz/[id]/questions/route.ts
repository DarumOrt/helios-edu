import { NextResponse } from "next/server";
import { quizQuestions } from "@/mocks/data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = quizQuestions[id] ?? quizQuestions["a3"];
  return NextResponse.json(list.map(({ correct, ...q }) => q));
}
