import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { previewImport } from "@/lib/importer/run-import";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Only .xlsx files are supported" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Workbook must be under 20 MB" }, { status: 413 });
    const preview = await previewImport(Buffer.from(await file.arrayBuffer()), file.name);
    return NextResponse.json({ preview });
  } catch {
    return NextResponse.json({ error: "Could not preview this workbook. Check that it is a valid .xlsx file." }, { status: 400 });
  }
}
