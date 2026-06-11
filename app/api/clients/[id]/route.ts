import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgency, requireClientInAgency, toResponse } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    const client = await requireClientInAgency(id, ctx.agencyId, {
      googleProperties: true,
      keywords: { orderBy: { keyword: "asc" } },
    });
    return NextResponse.json(client);
  } catch (e) {
    return toResponse(e);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    // Verify ownership before any write (throws 404 if not in this agency).
    await requireClientInAgency(id, ctx.agencyId);

    const body = await request.json();
    const { name, domain, contactEmail, ccEmails, reportSendDay, reportSendHour, sendDayCustom, status, notes,
            reportLanguage, autoSend, brandNameHe, brandNameEn, excludeFromReports } = body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name           !== undefined && { name }),
        ...(domain         !== undefined && { domain }),
        ...(contactEmail   !== undefined && { contactEmail }),
        ...(ccEmails       !== undefined && { ccEmails }),
        // When reportSendDay is explicitly set, mark as custom unless caller says otherwise
        ...(reportSendDay  !== undefined && { reportSendDay }),
        ...(reportSendHour !== undefined && { reportSendHour: Math.min(23, Math.max(0, parseInt(String(reportSendHour)) || 0)) }),
        ...((reportSendDay !== undefined || reportSendHour !== undefined) && sendDayCustom === undefined && { sendDayCustom: true }),
        ...(sendDayCustom  !== undefined && { sendDayCustom }),
        ...(status         !== undefined && { status }),
        ...(notes          !== undefined && { notes }),
        ...(reportLanguage !== undefined && { reportLanguage }),
        ...(autoSend       !== undefined && { autoSend }),
        ...(brandNameHe         !== undefined && { brandNameHe: brandNameHe || null }),
        ...(brandNameEn         !== undefined && { brandNameEn: brandNameEn || null }),
        ...(excludeFromReports  !== undefined && { excludeFromReports }),
      },
    });

    // Sync auto brand keywords whenever brand names are updated
    if (brandNameHe !== undefined || brandNameEn !== undefined) {
      const updatedClient = await prisma.client.findUnique({
        where: { id },
        select: { brandNameHe: true, brandNameEn: true },
      });

      const autoTerms = [updatedClient?.brandNameHe, updatedClient?.brandNameEn]
        .filter((t): t is string => !!t && t.trim().length > 0)
        .map(t => t.trim());

      await prisma.$transaction(async (tx) => {
        // Remove previously auto-generated brand keywords
        await tx.clientKeyword.deleteMany({
          where: { clientId: id, isBrand: true, groupName: "auto-brand" },
        });
        if (autoTerms.length > 0) {
          await tx.clientKeyword.createMany({
            data: autoTerms.map(kw => ({
              clientId:  id,
              keyword:   kw,
              isBrand:   true,
              isActive:  true,
              groupName: "auto-brand",
            })),
            skipDuplicates: true,
          });
        }
      });
    }

    return NextResponse.json(client);
  } catch (e) {
    return toResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireAgency();
    const { id } = await params;
    await requireClientInAgency(id, ctx.agencyId);
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return toResponse(e);
  }
}
