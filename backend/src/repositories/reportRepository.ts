import { prisma } from "@/lib/db";

export async function nextReportNumber(): Promise<string> {
  const count = await prisma.report.count();
  return `ANA-${String(count + 1).padStart(6, "0")}`;
}

export async function createReport(
  analysisId: string,
  reportNumber: string,
  filePath: string
): Promise<void> {
  await prisma.report.upsert({
    where: { analysisId },
    create: { analysisId, reportNumber, filePath },
    update: { filePath },
  });
}

export async function getReportByAnalysisId(analysisId: string) {
  return prisma.report.findUnique({ where: { analysisId } });
}
