import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runImport } from "@/lib/importer";

export const maxDuration = 60; // Allow up to 60s for large workbooks

export async function POST(request: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Only .xlsx files are supported" },
        { status: 400 }
      );
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Workbook must be under 20 MB" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await runImport(buffer, file.name, session.user.id, session.user.name);

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed. Check the import history and server logs." },
      { status: 500 }
    );
  }
}
