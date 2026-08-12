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

export interface ReportListItem {
  id: string;
  reportNumber: string;
  analysisId: string;
  serverId: string;
  hostname: string;
  component: string;
  impactLevel: string;
  createdAt: string;
}

export async function listReports(limit = 200): Promise<ReportListItem[]> {
  const rows = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      analysis: {
        include: { server: true, comparison: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    reportNumber: row.reportNumber,
    analysisId: row.analysisId,
    serverId: row.analysis.serverId,
    hostname: row.analysis.server.hostname,
    component: row.analysis.comparison.component,
    impactLevel: row.analysis.impactLevel,
    createdAt: row.createdAt.toISOString(),
  }));
}
