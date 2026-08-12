import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { BedrockAdapter } from "./BedrockAdapter";
import { ComparisonResult } from "@/domain/comparison";
import { ServerSnapshot } from "@/domain/server";
import { ReleaseInformation } from "@/domain/release";
import { ImpactAnalysis } from "@/domain/analysis";
import { parseAndValidateImpactAnalysis } from "@/lib/analysisSchema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

const DEFAULT_MODEL_ID = "anthropic.claude-sonnet-5-20260101-v1:0";

/**
 * Calls Claude Sonnet 5 through Amazon Bedrock. AWS credentials are read
 * only from process.env on the server and are never exposed to the
 * frontend. This adapter performs no shell execution, no SSH, and no
 * server mutation — it only returns structured impact analysis JSON.
 */
export class ClaudeBedrockAdapter implements BedrockAdapter {
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              sessionToken: process.env.AWS_SESSION_TOKEN,
            }
          : undefined,
    });
    this.modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL_ID;
  }

  async analyzeImpact(
    comparison: ComparisonResult,
    serverSnapshot: ServerSnapshot,
    release: ReleaseInformation
  ): Promise<ImpactAnalysis> {
    const userPrompt = buildUserPrompt(comparison, serverSnapshot, release);

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: userPrompt }],
        },
      ],
    });

    let responseText: string;
    try {
      const response = await this.client.send(
        new InvokeModelCommand({
          modelId: this.modelId,
          contentType: "application/json",
          accept: "application/json",
          body,
        })
      );
      const decoded = JSON.parse(new TextDecoder().decode(response.body));
      responseText = decoded?.content?.[0]?.text ?? "";
    } catch (error) {
      throw new Error(
        `Impact analysis could not be completed: Bedrock invocation failed (${
          error instanceof Error ? error.message : "unknown error"
        }).`
      );
    }

    try {
      return parseAndValidateImpactAnalysis(responseText);
    } catch (error) {
      throw new Error(
        `Impact analysis could not be completed: model response failed validation (${
          error instanceof Error ? error.message : "unknown error"
        }).`
      );
    }
  }
}
