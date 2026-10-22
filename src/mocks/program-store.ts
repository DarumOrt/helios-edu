import { programs as seed } from "@/mocks/data";
import type { Program } from "@/shared/types/domain";

// Программы обучения (наборы курсов). Пока только в моках Next — в обоих режимах.
const g = globalThis as unknown as { __helios_programs?: Program[] };
const store: Program[] = g.__helios_programs ?? (g.__helios_programs = structuredClone(seed));

export const listPrograms = () => store;
export const findProgram = (id: string) => store.find((p) => p.id === id);

export function createProgram(input: Omit<Program, "id">): Program {
  const program = { ...input, id: `p-${crypto.randomUUID().slice(0, 8)}` };
  store.push(program);
  return program;
}

export function updateProgram(id: string, patch: Partial<Omit<Program, "id">>) {
  const program = findProgram(id);
  if (program) Object.assign(program, patch);
  return program;
}
