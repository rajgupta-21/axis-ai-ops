import { Router } from "express";
import { ok } from "@/lib/apiResponse";
import { describeAnsibleTarget } from "@/adapters/ansible/Ec2AnsibleAdapter";
import { hasBedrockCredentials } from "@/adapters/bedrock";
import { createEmbeddingAdapter } from "@/adapters/embedding";
import { describeCache } from "@/lib/cache";

export const systemRouter = Router();

/**
 * Read-only, non-secret configuration summary — which adapter providers are
 * active and, for the EC2 Ansible provider, where it points. Never returns
 * credentials, tokens, key material, or connection strings.
 */
systemRouter.get("/info", (_req, res) => {
  const ansibleProvider = process.env.ANSIBLE_PROVIDER ?? "simulated";
  const releaseProvider = process.env.RELEASE_PROVIDER ?? "simulated";
  const bedrockProvider = process.env.BEDROCK_PROVIDER ?? (hasBedrockCredentials() ? "bedrock" : "local");

  const ansible = describeAnsibleTarget();

  const cache = describeCache();

  ok(res, {
    environment: process.env.NODE_ENV ?? "development",
    cacheEnabled: cache.enabled,
    cacheConnected: cache.connected,
    ansibleProvider,
    // Populated only for the ec2 provider — the host, user, port and inventory
    // path are configuration, not secrets. The SSH key is never surfaced.
    ansibleHost: ansibleProvider === "ec2" ? ansible.host || null : null,
    ansibleUser: ansibleProvider === "ec2" ? ansible.user : null,
    ansiblePort: ansibleProvider === "ec2" ? ansible.port : null,
    ansibleInventoryPath: ansibleProvider === "ec2" ? ansible.inventoryPath : null,
    releaseProvider,
    embeddingProvider: process.env.EMBEDDING_PROVIDER ?? "auto",
    embeddingModel: describeEmbedding(),
    webSearchEnabled: Boolean(process.env.TAVILY_API_KEY),
    bedrockProvider,
    bedrockModelId: bedrockProvider === "bedrock" ? process.env.BEDROCK_MODEL_ID ?? null : null,
    awsRegion: bedrockProvider === "bedrock" ? process.env.AWS_REGION ?? null : null,
  });
});

/** Non-secret description of the active embedding model. */
function describeEmbedding(): string {
  try {
    const adapter = createEmbeddingAdapter();
    return `${adapter.label} (${adapter.dimensions} dims)`;
  } catch (error) {
    return error instanceof Error ? `unavailable: ${error.message}` : "unavailable";
  }
}
