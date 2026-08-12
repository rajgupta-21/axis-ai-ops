import { apiFetch, getApiBaseUrl } from "@/lib/apiClient";
import { SystemInfo } from "@/domain/system";
import { PageContainer } from "@/components/PageContainer";
import { SettingsIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="font-mono text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export default async function SettingsPage() {
  let info: SystemInfo | null = null;
  let error: string | null = null;
  try {
    info = await apiFetch<SystemInfo>("/api/system/info");
  } catch {
    error = "Unable to reach the backend API.";
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
            <SettingsIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Read-only view of the active integration providers. No credentials are shown here or ever
              sent to the browser.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        )}

        {info && (
          <>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Integration Providers</p>
              <div className="mt-1 divide-y divide-slate-100">
                <Row label="Ansible / AWX Provider" value={info.ansibleProvider} />
                <Row label="Release Provider" value={info.releaseProvider} />
                <Row label="Bedrock Provider" value={info.bedrockProvider} />
                {info.bedrockModelId && <Row label="Bedrock Model ID" value={info.bedrockModelId} />}
                {info.awsRegion && <Row label="AWS Region" value={info.awsRegion} />}
                <Row label="Environment" value={info.environment} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Frontend Configuration</p>
              <div className="mt-1 divide-y divide-slate-100">
                <Row label="Backend API Base URL" value={getApiBaseUrl()} />
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Providers are switched using environment variables (ANSIBLE_PROVIDER, RELEASE_PROVIDER,
              BEDROCK_PROVIDER) in <code className="rounded bg-slate-100 px-1 py-0.5">backend/.env</code> —
              no code changes are required.
            </p>
          </>
        )}
      </div>
    </PageContainer>
  );
}
