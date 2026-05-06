"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = {
  error: string;
  email?: string;
  attempt?: number;
} | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get("email") ?? "").toString();
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: "/dashboard"
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Identifiants invalides", email, attempt: Date.now() };
    }
    throw error;
  }
}
