#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const readline = require("readline/promises");
const { stdin, stdout } = require("process");
const { PrismaClient } = require("@prisma/client");
const argon2 = require("@node-rs/argon2");

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const email = (await rl.question("Email admin : ")).trim().toLowerCase();
  const name = (await rl.question("Nom complet : ")).trim();
  const password = (await rl.question("Mot de passe (min 12 caractères) : ")).trim();
  rl.close();

  if (!email.includes("@")) throw new Error("Email invalide");
  if (!name) throw new Error("Nom requis");
  if (password.length < 12) throw new Error("Mot de passe trop court (12 caractères minimum)");

  const prisma = new PrismaClient();
  const passwordHash = await argon2.hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "ADMIN" },
    update: { name, passwordHash, role: "ADMIN" }
  });

  console.log(`OK admin créé/mis à jour : ${user.email} (${user.id})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
