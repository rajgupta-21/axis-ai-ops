import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { AnalysisRecord } from "@/domain/analysis";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { AnalysisWorkflow } from "@/components/AnalysisWorkflow";
import { DownloadReportButton } from "@/components/DownloadReportButton";
import { formatDateTime } from "@/lib/format";
import {
  ChecklistIcon,
  ClockIcon,
  ConfigIcon,
  FlagIcon,
  GaugeIcon,
  PuzzleIcon,
  RollbackIcon,
  ShieldIcon,
  SummaryIcon,
  VersionIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

type IconComponent = (props: { className?: string }) => React.ReactElement;

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const { analysisId } = await params;

  let record: AnalysisRecord;
  try {
    record = await apiFetch<AnalysisRecord>(`/api/analyses/${analysisId}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "ANALYSIS_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const { analysis, comparison, release } = record;
  const upToDate = comparison.currentVersion === comparison.latestVersion;

  return (
    <div className="space-y-8">
      <AnalysisSummary record={record} />

      <Section number={1} icon={SummaryIcon} title="Executive Summary">
        <p className="text-sm leading-relaxed text-slate-700">{analysis.executiveSummary}</p>
      </Section>

      <Section number={2} icon={VersionIcon} title="Version Comparison">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1.5 font-mono text-sm text-slate-700">
            {comparison.currentVersion}
          </span>
          <VersionIcon className="h-4 w-4 text-slate-400" />
          <span
            className={`rounded-md px-3 py-1.5 font-mono text-sm ${
              upToDate ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {comparison.latestVersion}
          </span>
          <span className="text-sm text-slate-500">{comparison.versionGap.description}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Release Date" value={release.releaseDate} />
          <Field label="Security Changes" value={comparison.securityChanges ? "Yes" : "No"} />
          <Field label="Configuration Changes" value={comparison.configurationChanges ? "Yes" : "No"} />
          <Field label="Release Source" value={release.source} />
        </dl>
      </Section>

      <Section number={3} icon={ConfigIcon} title="Server Configuration Impact">
        <BulletBlock title="Server Dependencies" items={comparison.serverDependencies} empty="None detected" />
        <BulletBlock title="Risk Factors" items={comparison.riskFactors} empty="No elevated risk factors identified" tone="amber" />
      </Section>

      <Section number={4} icon={ShieldIcon} title="Security Impact" tone={comparison.securityChanges ? "red" : "neutral"}>
        <BulletBlock items={analysis.securityImpact} tone={comparison.securityChanges ? "red" : "neutral"} />
      </Section>

      <Section number={5} icon={PuzzleIcon} title="Compatibility Impact">
        <BulletBlock items={analysis.compatibilityImpact} />
      </Section>

      <Section number={6} icon={ClockIcon} title="Operational Risk">
        <BulletBlock items={analysis.operationalRisk} tone="amber" />
      </Section>

      <Section number={7} icon={GaugeIcon} title="Performance Impact">
        <BulletBlock items={analysis.performanceImpact} />
      </Section>

      <Section number={8} icon={FlagIcon} title="Recommended Actions">
        <BulletBlock items={analysis.recommendedActions} tone="indigo" />
      </Section>

      <Section number={9} icon={ChecklistIcon} title="Pre-Upgrade Checklist">
        <BulletBlock items={analysis.preUpgradeChecks} tone="indigo" />
      </Section>

      <Section number={10} icon={RollbackIcon} title="Rollback Considerations">
        <BulletBlock items={analysis.rollbackConsiderations} />
      </Section>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-400">
        <ClockIcon className="h-3.5 w-3.5" />
        Server data collected: {formatDateTime(record.createdAt)} · Analysis generated:{" "}
        {formatDateTime(record.createdAt)}
      </div>

      <div className="flex items-center gap-3">
        <AnalysisWorkflow serverId={record.serverId} component={record.component} label="Re-analyze" />
        <DownloadReportButton analysisId={record.id} />
      </div>
    </div>
  );
}

const TONE_ACCENTS: Record<string, string> = {
  neutral: "border-l-slate-300",
  red: "border-l-red-400",
  amber: "border-l-amber-400",
  indigo: "border-l-indigo-400",
};

function Section({
  number,
  icon: Icon,
  title,
  tone = "neutral",
  children,
}: {
  number: number;
  icon: IconComponent;
  title: string;
  tone?: "neutral" | "red" | "amber" | "indigo";
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 border-l-4 bg-white p-6 ${TONE_ACCENTS[tone]}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">
          {number}. {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4 pl-9">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  );
}

const BULLET_TONES: Record<string, string> = {
  neutral: "bg-slate-400",
  red: "bg-red-500",
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
};

function BulletBlock({
  title,
  items,
  empty = "Insufficient data",
  tone = "neutral",
}: {
  title?: string;
  items: string[];
  empty?: string;
  tone?: "neutral" | "red" | "amber" | "indigo";
}) {
  const list = items.length > 0 ? items : [empty];
  return (
    <div>
      {title && <p className="text-sm font-medium text-slate-700">{title}</p>}
      <ul className={`space-y-1.5 ${title ? "mt-2" : ""}`}>
        {list.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${BULLET_TONES[tone]}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
