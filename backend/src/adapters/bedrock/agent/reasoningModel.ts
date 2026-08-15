import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ImpactAnalysis } from "@/domain/analysis";
import { ImpactAnalysisSchema } from "@/lib/analysisSchema";
import { SYSTEM_PROMPT, buildUserPrompt, RetrievedReference } from "../prompt";
import { ComparisonResult } from "@/domain/comparison";
import { ServerSnapshot } from "@/domain/server";
import { ReleaseInformation } from "@/domain/release";
import { ContextEnvelope } from "./contextEnvelope";
import { withRateLimitRetry } from "@/lib/rateLimit";

export const CritiqueSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()),
});

export type Critique = z.infer<typeof CritiqueSchema>;

export const EvidenceAssessmentSchema = z.object({
  sufficient: z.boolean(),
  missing: z.string(),
  searchQuery: z.string(),
});

export type EvidenceAssessment = z.infer<typeof EvidenceAssessmentSchema>;

export interface ReasoningInput {
  comparison: ComparisonResult;
  serverSnapshot: ServerSnapshot;
  release: ReleaseInformation;
  context: ContextEnvelope;
  retrievedReferences: RetrievedReference[];
}

/**
 * The single seam between the LangGraph agent and whatever actually does the
 * reasoning. The graph — its nodes, edges, state, context engineering, RAG
 * retrieval and critique loop — is identical no matter which implementation is
 * plugged in; only the three model calls differ. That is what lets the agent
 * run against Bedrock, Groq, or a deterministic local stand-in without the
 * agent itself changing.
 */
export interface ReasoningModel {
  /** Shown in the reasoning trace so the UI can never imply an LLM ran when one did not. */
  readonly label: string;
  readonly usesLlm: boolean;

  /**
   * Decides whether the evidence gathered so far is enough to analyse this
   * upgrade, and if not, composes a web-search query to close the gap. This is
   * what makes retrieval agentic rather than a fixed pipeline step: the agent
   * chooses to go looking again.
   */
  assessEvidence(input: ReasoningInput, searchesSoFar: number): Promise<EvidenceAssessment>;

  draft(input: ReasoningInput): Promise<ImpactAnalysis>;
  critique(input: ReasoningInput, draft: ImpactAnalysis): Promise<Critique>;
  revise(input: ReasoningInput, draft: ImpactAnalysis, critique: Critique): Promise<ImpactAnalysis>;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function buildCritiquePrompt(context: ContextEnvelope, draft: ImpactAnalysis): string {
  return `Given this grounding context (the only facts, missing-data flags, and risk signals available):

${JSON.stringify(context, null, 2)}

Review this draft impact analysis for claims NOT grounded in the context above (e.g. an invented CVE, an invented compatibility issue, a fabricated performance number). Retrieved references may be cited as supporting context but must not be presented as confirmed facts about this exact upgrade.

${JSON.stringify(draft, null, 2)}

Respond with a single JSON object: { "approved": boolean, "issues": string[] }. Approve unless you find a specific ungrounded claim.`;
}

/**
 * Shared implementation of the three reasoning calls for any LangChain chat
 * model. Subclasses supply only the model instance and a label, so adding a
 * provider means one small subclass rather than a copy of this logic.
 */
export abstract class LangChainReasoningModel implements ReasoningModel {
  readonly usesLlm = true;
  abstract readonly label: string;

  /** A fresh chat model per call — cheap, and avoids sharing mutable client state. */
  protected abstract chatModel(): BaseChatModel;

  /**
   * Gets a schema-valid object back from the model. Tries native structured
   * output (tool-calling) first, then falls back to parsing JSON out of a plain
   * text reply. The fallback matters for smaller/faster models, which are less
   * reliable at tool-calling but will emit JSON when asked directly.
   */
  protected async structured<T>(schema: z.ZodType<T>, messages: ChatMessage[]): Promise<T> {
    try {
      // Wrapped for rate limiting: the agent makes several calls per analysis
      // and one analysis can approach a free tier's whole per-minute token
      // budget, so being briefly throttled is normal, not a failure.
      return (await withRateLimitRetry(
        () => this.chatModel().withStructuredOutput(schema).invoke(messages),
        { label: `${this.label} structured output` }
      )) as T;
    } catch (structuredError) {
      const jsonInstruction: ChatMessage = {
        role: "user",
        content: "Respond with a single raw JSON object only — no markdown fences, no prose before or after it.",
      };
      const reply = await withRateLimitRetry(
        () => this.chatModel().invoke([...messages, jsonInstruction]),
        { label: `${this.label} text fallback` }
      );
      const text =
        typeof reply.content === "string"
          ? reply.content
          : reply.content.map((part) => ("text" in part ? part.text : "")).join("");

      try {
        return schema.parse(JSON.parse(extractJsonObject(text)));
      } catch (parseError) {
        throw new Error(
          `structured output failed (${structuredError instanceof Error ? structuredError.message : "unknown"}) ` +
            `and the text fallback did not yield valid JSON (${parseError instanceof Error ? parseError.message : "unknown"})`
        );
      }
    }
  }

  async assessEvidence(input: ReasoningInput, searchesSoFar: number): Promise<EvidenceAssessment> {
    return this.structured(EvidenceAssessmentSchema, [
      {
        role: "system",
        content:
          "You decide whether you have enough evidence to assess a software upgrade's impact, and if not, what to search the web for. " +
          "You never invent facts. Judging evidence insufficient is normal and expected when key details are missing.",
      },
      { role: "user", content: buildEvidencePrompt(input, searchesSoFar) },
    ]);
  }

  async draft(input: ReasoningInput): Promise<ImpactAnalysis> {
    return this.structured(ImpactAnalysisSchema, [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt(input.comparison, input.serverSnapshot, input.release, input.retrievedReferences),
      },
    ]);
  }

  async critique(input: ReasoningInput, draft: ImpactAnalysis): Promise<Critique> {
    return this.structured(CritiqueSchema, [
      {
        role: "system",
        content: "You are a strict fact-checking reviewer. You never introduce new claims, only flag unsupported ones.",
      },
      { role: "user", content: buildCritiquePrompt(input.context, draft) },
    ]);
  }

  async revise(input: ReasoningInput, draft: ImpactAnalysis, critique: Critique): Promise<ImpactAnalysis> {
    return this.structured(ImpactAnalysisSchema, [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt(input.comparison, input.serverSnapshot, input.release, input.retrievedReferences),
      },
      { role: "assistant", content: JSON.stringify(draft) },
      {
        role: "user",
        content: `A fact-checking reviewer flagged these issues with your previous answer: ${JSON.stringify(
          critique.issues
        )}. Return a corrected JSON object in the same shape, removing or grounding every flagged claim.`,
      },
    ]);
  }
}

/**
 * Deliberately compact: this runs before drafting and may run several times, so
 * it summarises the evidence rather than restating the whole server snapshot.
 */
function buildEvidencePrompt(input: ReasoningInput, searchesSoFar: number): string {
  const { comparison, context, retrievedReferences } = input;

  const evidence = retrievedReferences.length
    ? retrievedReferences
        .map((r, i) => `${i + 1}. [${r.origin}] ${r.sourceUrl ?? "no source"} :: ${r.chunkText.slice(0, 220)}`)
        .join("\n")
    : "(no reference material retrieved)";

  return `You are assessing an upgrade of "${comparison.component}" from ${comparison.currentVersion} to ${comparison.latestVersion}.

KNOWN FACTS:
${context.factsKnown.map((f) => `- ${f}`).join("\n") || "- (none)"}

EXPLICITLY MISSING:
${context.factsMissing.map((f) => `- ${f}`).join("\n") || "- (none)"}

REFERENCE MATERIAL GATHERED SO FAR:
${evidence}

Web searches already performed: ${searchesSoFar}.

Decide:
- "sufficient": true if you can responsibly assess security, compatibility and operational impact with what is above. False if a material gap remains — for example no changelog, no security information, or an unknown target version.
- "missing": one short sentence naming the most important gap. Empty string when sufficient.
- "searchQuery": a specific web search query that would close that gap, naming the software and version. Empty string when sufficient.

Prefer sufficient=true once you have concrete change or security information for this component; do not search for its own sake.`;
}

/** Pulls the outermost JSON object out of a reply that may carry fences or prose. */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) return fenced[1].trim();

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  return first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed;
}
