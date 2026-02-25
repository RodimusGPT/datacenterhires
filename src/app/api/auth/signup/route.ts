import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, name, role, companyName } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: role || "job_seeker",
    },
  });

  if (role === "employer" && companyName) {
    await prisma.employerProfile.create({
      data: { userId: user.id, companyName },
    });
  } else {
    await prisma.jobSeekerProfile.create({
      data: { userId: user.id },
    });
  }

  await createSession(user.id);

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
    redirect: role === "employer" ? "/employer" : "/dashboard",
  });
}
