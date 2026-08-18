import { ChatGroq } from "@langchain/groq";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LangChainReasoningModel } from "./reasoningModel";

/**
 * Groq default. The agent needs reliable tool-calling for structured output
 * plus enough judgement to fact-check its own draft, so the largest model Groq
 * offers is the right tier; the smaller ones are noticeably weaker at both.
 *
 * Was llama-3.3-70b-versatile until Groq decommissioned the Llama models —
 * requesting one now returns a 404 "model_not_found", which surfaces in the UI
 * as ANALYSIS_FAILED. Verify a replacement against
 * `GET https://api.groq.com/openai/v1/models` before setting it, and prefer a
 * model that keeps its chain-of-thought in a separate `reasoning` field: some
 * (qwen3.6) emit a <think> block inside `content`, which breaks JSON parsing.
 *
 * Override with GROQ_MODEL_ID.
 */
const DEFAULT_MODEL_ID = "openai/gpt-oss-120b";

/**
 * Runs the agent's reasoning on Groq. Added as a working alternative while the
 * Bedrock account's daily token quota is exhausted — Groq is a separate
 * provider with its own quota, so it is unaffected by that limit.
 *
 * Only GROQ_API_KEY is required. The agent graph is unchanged: this supplies
 * the same three reasoning calls as any other provider.
 */
export class GroqReasoningModel extends LangChainReasoningModel {
  readonly label: string;
  private readonly modelId: string;

  constructor() {
    super();
    this.modelId = process.env.GROQ_MODEL_ID ?? DEFAULT_MODEL_ID;
    this.label = `${this.modelId} on Groq`;
  }

  protected chatModel(): BaseChatModel {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "No Groq API key is configured. Set GROQ_API_KEY in backend/.env to use BEDROCK_PROVIDER=groq."
      );
    }

    return new ChatGroq({
      apiKey,
      model: this.modelId,
      temperature: 0,
      // Groq is fast but rate-limits per-minute on free tiers; a couple of
      // retries smooths over a burst without stalling the agent for long.
      maxRetries: 2,
    });
  }
}
