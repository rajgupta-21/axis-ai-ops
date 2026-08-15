import "dotenv/config";
import { ChatBedrockConverse } from "@langchain/aws";

/**
 * Verifies that BEDROCK_API_KEY can actually invoke BEDROCK_MODEL_ID in
 * AWS_REGION, using the exact same client construction the agent uses.
 *
 *   npm run check:bedrock
 *
 * Distinguishes the three failure modes that look alike from the app:
 *   - not authorized        → IAM is missing bedrock:InvokeModel
 *   - quota exhausted       → key is fine, daily token allowance is spent
 *   - model not available   → wrong model id or wrong region for that model
 */
async function main(): Promise<void> {
  const region = process.env.AWS_REGION;
  const model = process.env.BEDROCK_MODEL_ID;
  const key = process.env.BEDROCK_API_KEY ?? process.env.AWS_BEARER_TOKEN_BEDROCK;

  console.log(`region : ${region ?? "(unset)"}`);
  console.log(`model  : ${model ?? "(unset)"}`);
  console.log(`key    : ${key ? `${key.slice(0, 4)}… (${key.length} chars)` : "(none)"}`);

  if (!key) {
    console.log("\nRESULT: no Bedrock credential found — set BEDROCK_API_KEY in backend/.env");
    process.exitCode = 1;
    return;
  }
  if (!model) {
    console.log("\nRESULT: BEDROCK_MODEL_ID is unset");
    process.exitCode = 1;
    return;
  }

  const chat = new ChatBedrockConverse({
    region: region ?? "us-east-1",
    model,
    temperature: 0,
    bedrockBearerToken: key,
  });

  try {
    const reply = await chat.invoke("Reply with exactly: OK");
    const text = typeof reply.content === "string" ? reply.content : JSON.stringify(reply.content);
    console.log(`\nRESULT: OK — model replied ${text.trim().slice(0, 80)}`);
    console.log("Set BEDROCK_PROVIDER=bedrock in backend/.env to run the agent against it.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\nRESULT: FAILED — ${message}`);

    if (/too many tokens|throttl|rate/i.test(message) || /operation not allowed/i.test(message)) {
      console.log("→ Almost certainly QUOTA, not permission. Bedrock reports an exhausted daily token");
      console.log("  allowance two ways for the same condition: an explicit 429 'Too many tokens per");
      console.log("  day' in some regions and a generic 400 'Operation not allowed' in others (both were");
      console.log("  observed from this key, same model, same minute). The quota is account-wide, so");
      console.log("  switching region will not help. Wait for the reset or raise the Bedrock");
      console.log("  tokens-per-day quota in Service Quotas.");
      console.log("  If it persists well past a reset, then check model access for this region instead.");
    } else if (/not authorized|accessdenied|forbidden/i.test(message)) {
      console.log("→ IAM: attach bedrock:InvokeModel to the principal behind this key.");
    } else if (/invalid.*model|model.*identifier/i.test(message)) {
      console.log("→ Wrong model id for this region. List valid ids with:");
      console.log(`  curl -s https://bedrock.${region}.amazonaws.com/foundation-models -H "Authorization: Bearer $BEDROCK_API_KEY"`);
    }
    process.exitCode = 1;
  }
}

void main();
