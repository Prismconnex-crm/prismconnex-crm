import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";

/**
 * Lightweight identity endpoint for client components (dashboard greeting,
 * topbar). Never throws on DB trouble — the name/role simply degrade to the
 * session email so the UI still renders.
 */
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fallback = {
    email: session.email,
    name: null as string | null,
    role: null as string | null,
    workspace: null as string | null,
  };

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const user = await prisma.user.findUnique({
      where: { email: session.email },
      include: { memberships: { include: { workspace: true } } },
    });

    if (!user) return NextResponse.json({ user: fallback });

    const membership = user.memberships[0];
    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name ?? null,
        role: membership?.role ?? null,
        workspace: membership?.workspace?.name ?? null,
      },
    });
  } catch {
    return NextResponse.json({ user: fallback });
  }
}
