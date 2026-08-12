import { getApiBaseUrl } from "@/lib/apiClient";
import { DownloadIcon } from "./icons";

export function DownloadReportButton({ analysisId }: { analysisId: string }) {
  return (
    <a
      href={`${getApiBaseUrl()}/api/analyses/${analysisId}/report`}
      className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
    >
      <DownloadIcon className="h-4 w-4" />
      Download Report
    </a>
  );
}
