"use client";

import { useState } from "react";
import { ReasoningTraceStep } from "@/domain/analysis";

const STATUS_STYLES: Record<string, string> = {
  ok: "border-slate-200 bg-white",
  looped: "border-amber-300 bg-amber-50",
  simulated: "border-slate-200 bg-slate-50",
  // Deliberately the loudest state in this list: it marks an analysis that was
  // published while the fact-checking pass still objected to it.
  warning: "border-red-300 bg-red-50",
};

const STATUS_DOT: Record<string, string> = {
  ok: "bg-emerald-500",
  looped: "bg-amber-500",
  simulated: "bg-slate-400",
  warning: "bg-red-500",
};

function durationMs(step: ReasoningTraceStep): number {
  return new Date(step.endedAt).getTime() - new Date(step.startedAt).getTime();
}

interface EvidenceReference {
  chunkText: string;
  sourceUrl: string | null;
  similarity: number | null;
  origin?: "knowledge_base" | "web_search";
}

/**
 * Renders the evidence a step gathered, with its provenance. Knowledge-base
 * hits carry a cosine similarity; live web results do not, because they were
 * keyword-ranked — showing a score for them would misrepresent how they were
 * found.
 */
function ReferenceList({ detail }: { detail?: Record<string, unknown> }) {
  const raw = detail?.references;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const references = raw as EvidenceReference[];

  return (
    <ul className="space-y-1.5">
      {references.map((reference, i) => (
        <li key={i} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 font-medium ${
                reference.origin === "web_search"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {reference.origin === "web_search" ? "web search" : "knowledge base"}
            </span>
            {typeof reference.similarity === "number" && (
              <span className="font-mono text-slate-400">sim {reference.similarity.toFixed(2)}</span>
            )}
            {reference.sourceUrl && (
              <a
                href={reference.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-indigo-600 hover:underline"
              >
                {reference.sourceUrl}
              </a>
            )}
          </div>
          <p className="mt-1 text-slate-600">{reference.chunkText.slice(0, 240)}</p>
        </li>
      ))}
    </ul>
  );
}

function NodeCard({ step }: { step: ReasoningTraceStep }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = step.detail && Object.keys(step.detail).length > 0;

  return (
    <div className={`w-full rounded-lg border p-3 text-left ${STATUS_STYLES[step.status] ?? STATUS_STYLES.ok}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[step.status] ?? STATUS_DOT.ok}`} />
          <p className="text-sm font-medium text-slate-900">{step.label}</p>
        </div>
        <span className="flex-shrink-0 font-mono text-xs text-slate-400">{durationMs(step)}ms</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{step.summary}</p>
      {step.status === "simulated" && (
        <span className="mt-2 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          Simulated — no LLM call
        </span>
      )}
      {step.status === "looped" && (
        <span className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          Triggered revision loop
        </span>
      )}
      {step.status === "warning" && (
        <span className="mt-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
          Published with unresolved objections
        </span>
      )}
      {hasDetail && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            {expanded ? "Hide details" : "Show details"}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <ReferenceList detail={step.detail} />
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                {JSON.stringify(step.detail, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Renders the LangGraph agent's execution trace as a left-to-right flow:
 * prepare_context -> retrieve_context -> draft_reasoning -> self_critique
 * -> (revise_reasoning looping back into self_critique, if it ran) ->
 * finalize. Node boxes are laid out in trace order rather than as a fixed
 * template, so a mock-mode single-node trace and a full multi-node agent
 * trace both render correctly without special-casing.
 */
export function ReasoningGraph({ trace }: { trace: ReasoningTraceStep[] }) {
  if (trace.length === 0) {
    return <p className="text-sm text-slate-500">No reasoning trace was recorded for this analysis.</p>;
  }

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {trace.map((step, i) => (
        <div key={`${step.node}-${i}`} className="flex items-stretch gap-3">
          <div className="w-64">
            <NodeCard step={step} />
          </div>
          {i < trace.length - 1 && (
            <div className="flex flex-shrink-0 items-center text-slate-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="M4 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
