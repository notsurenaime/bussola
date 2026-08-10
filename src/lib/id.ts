import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 16);

export function createId(prefix?: string): string {
  const id = generate();
  return prefix ? `${prefix}_${id}` : id;
}
