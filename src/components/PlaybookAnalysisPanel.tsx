"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/apiClient";
import { ServerSummary } from "@/domain/server";
import { DocumentIcon } from "./icons";

const PLACEHOLDER = `- hosts: all
  tasks:
    - name: Install nginx
      apt:
        name: nginx
        version: 1.26.2
        state: present
    - name: Restart nginx
      service:
        name: nginx
        state: restarted`;

/**
 * Lets a user paste an Ansible playbook and analyze its impact against a
 * selected server. The playbook is never executed — it is parsed
 * statically and used only as input to the same impact-analysis pipeline
 * used for release-based re-analysis.
 */
export function PlaybookAnalysisPanel({ servers }: { servers: ServerSummary[] }) {
  const router = useRouter();
  const [serverId, setServerId] = useState(servers[0]?.id ?? "");
  const [playbookYaml, setPlaybookYaml] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!serverId || !playbookYaml.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/servers/${serverId}/analyze-playbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbookYaml }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        setError(body?.error?.message ?? "The playbook could not be analyzed.");
        setSubmitting(false);
        return;
      }

      router.push(`/analyses/${body.data.id}`);
      router.refresh();
    } catch {
      setError("The playbook could not be analyzed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <DocumentIcon className="h-4 w-4 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">Analyze an Ansible Playbook</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Paste a playbook to see its impact on a server if it were applied. The playbook is never
        executed — it is only parsed to determine what it declares it would do.
      </p>

      <div className="mt-3 space-y-3">
        <select
          value={serverId}
          onChange={(e) => setServerId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
        >
          {servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.hostname}
            </option>
          ))}
        </select>

        <textarea
          value={playbookYaml}
          onChange={(e) => setPlaybookYaml(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={8}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
        />

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !serverId || !playbookYaml.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Analyzing..." : "Analyze Playbook"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
