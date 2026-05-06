import { hash, verify } from "@node-rs/argon2";

const argonOpts = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, argonOpts);
}

export async function verifyPassword(hashStr: string, password: string): Promise<boolean> {
  try {
    return await verify(hashStr, password, argonOpts);
  } catch {
    return false;
  }
}
