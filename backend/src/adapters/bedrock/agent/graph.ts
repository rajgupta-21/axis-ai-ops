import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ComparisonResult } from "@/domain/comparison";
import { ServerSnapshot } from "@/domain/server";
import { ReleaseInformation } from "@/domain/release";
import { ImpactAnalysis, ReasoningTraceStep } from "@/domain/analysis";
import { ImpactAnalysisSchema } from "@/lib/analysisSchema";
import { createEmbeddingAdapter } from "@/adapters/embedding";
import { searchKnowledgeChunks } from "@/repositories/knowledgeRepository";
import { RetrievedReference } from "../prompt";
import { ContextEnvelope, buildContextEnvelope } from "./contextEnvelope";
import { Critique, EvidenceAssessment, ReasoningInput, ReasoningModel } from "./reasoningModel";
import { createReasoningModel } from "./createReasoningModel";
import { searchWeb } from "./webSearchTool";
import { ingestWebFindings } from "@/services/knowledgeIngestionService";

const MAX_REVISIONS = 1;
const RETRIEVAL_LIMIT = 8;
/** Bounds the agentic search loop so a dissatisfied agent cannot spin. */
const MAX_WEB_SEARCHES = Number(process.env.AGENT_MAX_WEB_SEARCHES ?? 2);

const embeddingAdapter = createEmbeddingAdapter();
const reasoningModel: ReasoningModel = createReasoningModel();

const StateAnnotation = Annotation.Root({
  comparison: Annotation<ComparisonResult>(),
  serverSnapshot: Annotation<ServerSnapshot>(),
  release: Annotation<ReleaseInformation>(),
  context: Annotation<ContextEnvelope | null>({ default: () => null, reducer: (_p, n) => n }),
  retrievedReferences: Annotation<RetrievedReference[]>({ default: () => [], reducer: (_p, n) => n }),
  assessment: Annotation<EvidenceAssessment | null>({ default: () => null, reducer: (_p, n) => n }),
  searchCount: Annotation<number>({ default: () => 0, reducer: (_p, n) => n }),
  searchedQueries: Annotation<string[]>({ default: () => [], reducer: (prev, next) => prev.concat(next) }),
  draft: Annotation<ImpactAnalysis | null>({ default: () => null, reducer: (_p, n) => n }),
  critique: Annotation<Critique | null>({ default: () => null, reducer: (_p, n) => n }),
  revisionCount: Annotation<number>({ default: () => 0, reducer: (_p, n) => n }),
  trace: Annotation<ReasoningTraceStep[]>({ default: () => [], reducer: (prev, next) => prev.concat(next) }),
});

type AgentState = typeof StateAnnotation.State;

function traceStep(
  node: string,
  label: string,
  status: ReasoningTraceStep["status"],
  startedAt: string,
  summary: string,
  detail?: Record<string, unknown>
): ReasoningTraceStep {
  return { node, label, status, startedAt, endedAt: new Date().toISOString(), summary, detail };
}

/** Marks LLM-backed nodes as simulated when no real model is configured, so the UI never overstates what ran. */
function llmStatus(): ReasoningTraceStep["status"] {
  return reasoningModel.usesLlm ? "ok" : "simulated";
}

function reasoningInput(state: AgentState): ReasoningInput {
  return {
    comparison: state.comparison,
    serverSnapshot: state.serverSnapshot,
    release: state.release,
    context: state.context!,
    retrievedReferences: state.retrievedReferences,
  };
}

async function prepareContextNode(state: AgentState): Promise<Partial<AgentState>> {
  const startedAt = new Date().toISOString();
  const context = buildContextEnvelope(state.comparison, state.serverSnapshot, state.release);
  return {
    context,
    trace: [
      traceStep(
        "prepare_context",
        "Prepare context (context engineering)",
        "ok",
        startedAt,
        `Curated ${context.factsKnown.length} known facts, ${context.factsMissing.length} missing-data flags, and ${context.riskSignals.length} risk signals from the deterministic comparison.`,
        { ...context }
      ),
    ],
  };
}

async function retrieveContextNode(state: AgentState): Promise<Partial<AgentState>> {
  const startedAt = new Date().toISOString();
  const query = `${state.comparison.component} ${state.release.latestVersion} security changes breaking changes configuration changes`;

  let references: RetrievedReference[] = [];
  let note = "";
  try {
    const queryEmbedding = await embeddingAdapter.embed(query, "query");
    const matches = await searchKnowledgeChunks(
      state.comparison.component.toLowerCase(),
      queryEmbedding,
      RETRIEVAL_LIMIT
    );
    references = matches.map((m) => ({
      chunkText: m.chunkText,
      sourceUrl: m.sourceUrl,
      similarity: 1 - m.distance,
      origin: "knowledge_base" as const,
    }));
  } catch (error) {
    note = ` Retrieval failed (${error instanceof Error ? error.message : "unknown error"}); proceeding ungrounded.`;
  }

  return {
    retrievedReferences: references,
    trace: [
      traceStep(
        "retrieve_context",
        "Retrieve up-to-date references (RAG)",
        "ok",
        startedAt,
        (references.length > 0
          ? `Retrieved ${references.length} previously ingested release-note chunk(s) for ${state.comparison.component} by pgvector similarity.`
          : `No previously ingested knowledge found for ${state.comparison.component}; proceeding without retrieved references.`) + note,
        { references }
      ),
    ],
  };
}

/**
 * The agent judges its own evidence. If a material gap remains it composes a
 * web-search query, which routeAfterAssessment sends to the search node — so
 * retrieval is driven by the agent's dissatisfaction rather than being a fixed
 * one-shot step.
 */
async function assessEvidenceNode(state: AgentState): Promise<Partial<AgentState>> {
  const startedAt = new Date().toISOString();
  const assessment = await reasoningModel.assessEvidence(reasoningInput(state), state.searchCount);

  const isRepeat =
    Boolean(assessment.searchQuery) && state.searchedQueries.includes(queryKey(assessment.searchQuery));
  const willSearch =
    !assessment.sufficient &&
    Boolean(assessment.searchQuery) &&
    state.searchCount < MAX_WEB_SEARCHES &&
    !isRepeat;
  const atLimit = !assessment.sufficient && (state.searchCount >= MAX_WEB_SEARCHES || isRepeat);

  return {
    assessment,
    trace: [
      traceStep(
        "assess_evidence",
        `Assess evidence sufficiency — ${reasoningModel.label}`,
        willSearch ? "looped" : llmStatus(),
        startedAt,
        assessment.sufficient
          ? `Evidence judged sufficient after ${state.searchCount} web search(es); proceeding to draft.`
          : atLimit
            ? isRepeat
              ? `Gap remains (${assessment.missing}) but this search was already tried and returned nothing new; drafting with what is available and reporting the gap.`
              : `Gap remains (${assessment.missing}) but the ${MAX_WEB_SEARCHES}-search limit is reached; drafting with what is available and reporting the gap.`
            : `Gap identified: ${assessment.missing} — searching the web.`,
        { ...assessment, searchesSoFar: state.searchCount, searchLimit: MAX_WEB_SEARCHES }
      ),
    ],
  };
}

/**
 * Executes the query the agent asked for, adds the findings to its working
 * evidence, and persists them to the knowledge base so later analyses of the
 * same component start better informed.
 */
async function webSearchNode(state: AgentState): Promise<Partial<AgentState>> {
  const startedAt = new Date().toISOString();
  const query = state.assessment?.searchQuery ?? state.comparison.component;

  const result = await searchWeb(query);

  if (result.references.length > 0) {
    try {
      await ingestWebFindings(state.comparison.component, result.references);
    } catch {
      // Best-effort persistence; the current analysis already has the findings.
    }
  }

  // Deduplicated against what is already held. Previous runs ingested these
  // same findings into the knowledge base, so without this the model routinely
  // saw one passage twice — once retrieved by pgvector, once fresh from the web
  // — and identical text repeated reads as corroboration when it is a single
  // source counted twice.
  const merged = dedupeReferences([...state.retrievedReferences, ...result.references]);
  const added = merged.length - state.retrievedReferences.length;
  const duplicates = result.references.length - added;

  return {
    retrievedReferences: merged,
    searchCount: state.searchCount + 1,
    searchedQueries: [queryKey(query)],
    trace: [
      traceStep(
        "web_search",
        "Web search (Tavily) — agent-issued query",
        "ok",
        startedAt,
        result.error
          ? `Search for "${query}" failed: ${result.error} Proceeding on existing evidence.`
          : `Agent searched "${query}" and retrieved ${result.references.length} source(s)` +
            (duplicates > 0 ? `, ${duplicates} already held and discarded as duplicates.` : "."),
        { query, error: result.error ?? null, references: result.references, duplicatesDropped: duplicates }
      ),
    ],
  };
}

async function draftReasoningNode(state: AgentState): Promise<Partial<AgentState>> {
  const startedAt = new Date().toISOString();
  const draft = await reasoningModel.draft(reasoningInput(state));

  return {
    draft,
    trace: [
      traceStep(
        "draft_reasoning",
        `Draft chain-of-thought reasoning — ${reasoningModel.label}`,
        llmStatus(),
        startedAt,
        `Drafted impact level ${draft.impactLevel} (confidence ${draft.confidence}) from ${draft.reasoning.length} reasoning step(s).`,
        { impactLevel: draft.impactLevel, confidence: draft.confidence, reasoning: draft.reasoning }
      ),
    ],
  };
}

async function selfCritiqueNode(state: AgentState): Promise<Partial<AgentState>> {
  const startedAt = new Date().toISOString();
  const critique = await reasoningModel.critique(reasoningInput(state), state.draft!);

  return {
    critique,
    trace: [
      traceStep(
        "self_critique",
        `Self-critique against grounding context — ${reasoningModel.label}`,
        critique.approved ? llmStatus() : "looped",
        startedAt,
        critique.approved
          ? "No ungrounded claims found; draft approved."
          : `Found ${critique.issues.length} potentially ungrounded claim(s); routing to revision.`,
        { issues: critique.issues }
      ),
    ],
  };
}

async function reviseReasoningNode(state: AgentState): Promise<Partial<AgentState>> {
  const startedAt = new Date().toISOString();
  const revised = await reasoningModel.revise(reasoningInput(state), state.draft!, state.critique!);

  return {
    draft: revised,
    revisionCount: state.revisionCount + 1,
    trace: [
      traceStep(
        "revise_reasoning",
        `Revise reasoning after critique — ${reasoningModel.label}`,
        llmStatus(),
        startedAt,
        `Revised draft to address ${state.critique!.issues.length} flagged issue(s).`,
        { impactLevel: revised.impactLevel, addressed: state.critique!.issues }
      ),
    ],
  };
}

/**
 * Validates the draft and applies the two deterministic post-conditions that
 * the model is not trusted to enforce on itself: confidence must be justified
 * by the evidence, and an unresolved objection must never leave the graph
 * silently.
 *
 * The second case is the one that mattered. With the revision budget spent, the
 * router sends the draft here regardless of what the final critique said, so a
 * result could be persisted — and rendered, and put in a PDF — still carrying
 * claims the reviewer had just rejected, with the disagreement visible only to
 * someone who expanded the trace. For a tool whose only product is a judgement
 * a human will act on, that is the worst available outcome, so the objection is
 * promoted into the analysis body itself.
 */
function finalizeNode(state: AgentState): Partial<AgentState> {
  const startedAt = new Date().toISOString();
  const validated = ImpactAnalysisSchema.parse(state.draft);

  const criticApproved = state.critique?.approved !== false;
  const unresolved = criticApproved ? [] : state.critique?.issues ?? [];

  const { confidence, reason } = clampConfidence(validated.confidence, state.context!, criticApproved);

  const finalAnalysis: ImpactAnalysis = {
    ...validated,
    confidence,
    // Surfaced in risks specifically because that list reaches every output —
    // the analysis page, the PDF report — whereas the trace reaches only the
    // reader who goes looking for it.
    risks: unresolved.length
      ? [
          ...validated.risks,
          `Unverified content: a fact-checking pass rejected ${unresolved.length} claim(s) in this analysis and the revision budget was exhausted before they were resolved. Treat the following as unconfirmed — ${unresolved.join("; ")}`,
        ]
      : validated.risks,
    reasoning:
      reason !== null
        ? [...validated.reasoning, `Confidence was reduced to ${confidence} because ${reason}.`]
        : validated.reasoning,
  };

  const summary = unresolved.length
    ? `Finalized with ${unresolved.length} unresolved reviewer objection(s) after ${state.revisionCount} revision(s); confidence forced to ${confidence} and the objections recorded as risks.`
    : reason !== null
      ? `Draft passed schema validation after ${state.revisionCount} revision(s); confidence lowered from ${validated.confidence} to ${confidence} because ${reason}.`
      : `Draft passed schema validation after ${state.revisionCount} revision(s) and is ready to persist.`;

  return {
    draft: finalAnalysis,
    trace: [
      traceStep(
        "finalize",
        "Finalize validated result",
        unresolved.length ? "warning" : "ok",
        startedAt,
        summary,
        {
          revisions: state.revisionCount,
          declaredConfidence: validated.confidence,
          finalConfidence: confidence,
          confidenceReason: reason,
          unresolvedIssues: unresolved,
          tokenUsage: reasoningModel.usage?.snapshot() ?? null,
        }
      ),
    ],
  };
}

/** Normalized so trivial rewording still counts as the same query. */
function queryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Collapses references whose text is effectively identical, keeping the first
 * occurrence — which is the knowledge-base copy when one exists, since those
 * are prepended. Compared on normalized text rather than URL: the same release
 * note is routinely served from several addresses, and the duplication that
 * misleads the model is textual.
 */
function dedupeReferences(references: RetrievedReference[]): RetrievedReference[] {
  const seen = new Set<string>();
  const unique: RetrievedReference[] = [];

  for (const reference of references) {
    const key = reference.chunkText.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 300);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    unique.push(reference);
  }

  return unique;
}

/**
 * Confidence the analysis is allowed to claim, given what is provably absent.
 *
 * The model previously chose this freely, which let it report HIGH confidence
 * while the context envelope stated in the same breath that the target version
 * was unknown. factsMissing is computed deterministically by
 * buildContextEnvelope, so it is a fact about the evidence rather than an
 * opinion, and it can bound the claim in code.
 *
 * Only ever lowers. A model that is already unsure about well-evidenced input
 * knows something this rule does not.
 */
function clampConfidence(
  declared: ImpactAnalysis["confidence"],
  context: ContextEnvelope,
  criticApproved: boolean
): { confidence: ImpactAnalysis["confidence"]; reason: string | null } {
  const order: ImpactAnalysis["confidence"][] = ["LOW", "MEDIUM", "HIGH"];
  const rank = (value: ImpactAnalysis["confidence"]) => order.indexOf(value);

  let ceiling: ImpactAnalysis["confidence"] = "HIGH";
  let reason: string | null = null;

  if (context.factsMissing.length >= 3) {
    ceiling = "LOW";
    reason = `${context.factsMissing.length} material facts were unavailable`;
  } else if (context.factsMissing.length > 0) {
    ceiling = "MEDIUM";
    reason = `${context.factsMissing.length} material fact(s) were unavailable`;
  }

  // An unresolved critique outranks the count: claims the reviewer rejected are
  // still present in the text being published.
  if (!criticApproved) {
    ceiling = "LOW";
    reason = "the fact-checking reviewer's objections were not resolved";
  }

  if (rank(declared) <= rank(ceiling)) return { confidence: declared, reason: null };
  return { confidence: ceiling, reason };
}

function routeAfterAssessment(state: AgentState): "web_search" | "draft_reasoning" {
  const query = state.assessment?.searchQuery ?? "";
  if (state.assessment?.sufficient || !query) return "draft_reasoning";
  if (state.searchCount >= MAX_WEB_SEARCHES) return "draft_reasoning";

  // Re-running a query that already came back unhelpful cannot produce new
  // evidence — it just burns a search and stalls the loop. Treat a repeat as
  // the search avenue being exhausted and proceed to draft.
  if (state.searchedQueries.some((previous) => previous === queryKey(query))) {
    return "draft_reasoning";
  }

  return "web_search";
}

function routeAfterCritique(state: AgentState): "revise_reasoning" | "finalize" {
  if (!state.critique?.approved && state.revisionCount < MAX_REVISIONS) {
    return "revise_reasoning";
  }
  return "finalize";
}

const compiledGraph = new StateGraph(StateAnnotation)
  .addNode("prepare_context", prepareContextNode)
  .addNode("retrieve_context", retrieveContextNode)
  .addNode("assess_evidence", assessEvidenceNode)
  .addNode("web_search", webSearchNode)
  .addNode("draft_reasoning", draftReasoningNode)
  .addNode("self_critique", selfCritiqueNode)
  .addNode("revise_reasoning", reviseReasoningNode)
  .addNode("finalize", finalizeNode)
  .addEdge(START, "prepare_context")
  .addEdge("prepare_context", "retrieve_context")
  .addEdge("retrieve_context", "assess_evidence")
  // The agentic retrieval loop: assess -> search -> re-assess, bounded by
  // MAX_WEB_SEARCHES, then draft.
  .addConditionalEdges("assess_evidence", routeAfterAssessment, ["web_search", "draft_reasoning"])
  .addEdge("web_search", "assess_evidence")
  .addEdge("draft_reasoning", "self_critique")
  .addConditionalEdges("self_critique", routeAfterCritique, ["revise_reasoning", "finalize"])
  .addEdge("revise_reasoning", "self_critique")
  .addEdge("finalize", END)
  .compile();

export async function runImpactAnalysisAgent(
  comparison: ComparisonResult,
  serverSnapshot: ServerSnapshot,
  release: ReleaseInformation
): Promise<{ analysis: ImpactAnalysis; trace: ReasoningTraceStep[] }> {
  const result = await compiledGraph.invoke({ comparison, serverSnapshot, release });
  return { analysis: result.draft as ImpactAnalysis, trace: result.trace };
}
