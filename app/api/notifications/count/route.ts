import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ count: 0 });
  const count = await prisma.notification.count({
    where: { userId: session.user.id, readAt: null }
  });
  return NextResponse.json({ count });
}
