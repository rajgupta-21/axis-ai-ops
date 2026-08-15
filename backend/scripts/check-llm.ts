import "dotenv/config";
import { createReasoningModel } from "../src/adapters/bedrock/agent/createReasoningModel";

/**
 * Verifies that the configured reasoning provider can actually be reached,
 * using the exact same construction the agent uses.
 *
 *   npm run check:llm
 *
 * Reports which provider is active, then makes one real structured call so a
 * failure surfaces here rather than mid-analysis.
 */
async function main(): Promise<void> {
  const provider = process.env.BEDROCK_PROVIDER ?? "(unset — auto-detected)";
  const model = createReasoningModel();

  console.log(`provider : ${provider}`);
  console.log(`engine   : ${model.label}`);
  console.log(`uses LLM : ${model.usesLlm}`);

  if (!model.usesLlm) {
    console.log("\nRESULT: OK — deterministic local reasoning, no network call needed.");
    return;
  }

  // Minimal but real: exercises the structured-output path the agent depends on.
  const critique = await model
    .critique(
      {
        comparison: {
          component: "nginx",
          currentVersion: "1.0.0",
          latestVersion: "1.0.1",
          versionGap: { major: 0, minor: 0, patch: 1, description: "1 patch release behind" },
          securityChanges: false,
          configurationChanges: false,
          serverDependencies: [],
          riskFactors: [],
        },
        serverSnapshot: {} as never,
        release: {} as never,
        context: { mode: "release", factsKnown: ["nginx 1.0.0 is installed."], factsMissing: [], riskSignals: [] },
        retrievedReferences: [],
      },
      {
        impactLevel: "LOW",
        confidence: "HIGH",
        executiveSummary: "Patch upgrade.",
        reasoning: ["One patch release behind."],
        risks: [],
        securityImpact: ["CVE-9999-0001 is fixed by this release."],
        compatibilityImpact: [],
        operationalRisk: [],
        performanceImpact: [],
        recommendedActions: [],
        preUpgradeChecks: [],
        rollbackConsiderations: [],
      }
    )
    .catch((error: unknown) => {
      throw error instanceof Error ? error : new Error(String(error));
    });

  console.log(`\nRESULT: OK — provider responded.`);
  console.log(`  approved: ${critique.approved}`);
  console.log(`  issues  : ${critique.issues.length ? critique.issues.join(" | ") : "(none)"}`);
  console.log(
    critique.approved
      ? "  note    : it approved a planted fabricated CVE — expected on weaker models; the agent's\n            revision loop is the safety net, not this single call."
      : "  note    : it correctly flagged the planted fabricated CVE."
  );
}

main().catch((error: Error) => {
  console.log(`\nRESULT: FAILED — ${error.message}`);
  const m = error.message.toLowerCase();

  if (/no groq api key/.test(m)) {
    console.log("→ Set GROQ_API_KEY in backend/.env.");
  } else if (/401|unauthorized|invalid api key|authentication/.test(m)) {
    console.log("→ The API key was rejected. Check it is current and pasted whole.");
  } else if (/429|rate limit|too many/.test(m)) {
    console.log("→ Rate limited or out of quota. Wait, or lower the request rate.");
  } else if (/operation not allowed/.test(m)) {
    console.log("→ Bedrock: almost certainly an exhausted daily token quota (it reports this the");
    console.log("  same way as an explicit 429). Try BEDROCK_PROVIDER=groq or =local meanwhile.");
  } else if (/model|not found|does not exist|decommission/.test(m)) {
    console.log("→ The model id is wrong or retired for this provider. Check GROQ_MODEL_ID /");
    console.log("  BEDROCK_MODEL_ID against the provider's current model list.");
  } else if (/enotfound|econnrefused|etimedout|fetch failed/.test(m)) {
    console.log("→ Network problem reaching the provider.");
  }
  process.exitCode = 1;
});
