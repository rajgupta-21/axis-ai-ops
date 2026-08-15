import { ChatBedrockConverse } from "@langchain/aws";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { LangChainReasoningModel } from "./reasoningModel";

const DEFAULT_MODEL_ID = "eu.amazon.nova-lite-v1:0";

/**
 * Runs the agent's reasoning on Amazon Bedrock. Works with any
 * Converse-capable Bedrock model — Anthropic Claude and Amazon Nova are both
 * supported, selected by BEDROCK_MODEL_ID.
 *
 * Authentication resolves in this order:
 *   1. BEDROCK_API_KEY / AWS_BEARER_TOKEN_BEDROCK  (Bedrock API key, bearer auth)
 *   2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY   (SigV4)
 *   3. the AWS SDK default credential chain        (shared config, SSO, IMDS)
 */
export class BedrockReasoningModel extends LangChainReasoningModel {
  readonly label: string;
  private readonly modelId: string;

  constructor() {
    super();
    this.modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID;
    this.label = `${this.modelId} on Amazon Bedrock`;
  }

  protected chatModel(): BaseChatModel {
    const bearer = process.env.BEDROCK_API_KEY ?? process.env.AWS_BEARER_TOKEN_BEDROCK;

    return new ChatBedrockConverse({
      region: process.env.AWS_REGION ?? "us-east-1",
      model: this.modelId,
      temperature: 0,
      ...(bearer
        ? { bedrockBearerToken: bearer }
        : process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN,
              },
            }
          : {}),
    });
  }
}
