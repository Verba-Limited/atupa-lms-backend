import { randomInt } from 'crypto';

/** Unambiguous alphabet (no 0/O, 1/I/L) for codes people type or read aloud. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function randomCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
