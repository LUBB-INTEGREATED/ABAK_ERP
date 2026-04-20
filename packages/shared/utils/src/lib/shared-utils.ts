export function formatEntityId(prefix: string, year: number, sequence: number): string {
  const seq = sequence.toString().padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}
