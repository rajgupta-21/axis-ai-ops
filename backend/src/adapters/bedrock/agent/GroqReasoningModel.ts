import { ChatGroq } from "@langchain/groq";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LangChainReasoningModel } from "./reasoningModel";

/**
 * Groq default. A 70B-class instruct model is the right tier here: the agent
 * needs reliable tool-calling for structured output plus enough judgement to
 * fact-check its own draft, and the smaller instant models are noticeably
 * weaker at both. Override with GROQ_MODEL_ID.
 */
const DEFAULT_MODEL_ID = "llama-3.3-70b-versatile";

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
