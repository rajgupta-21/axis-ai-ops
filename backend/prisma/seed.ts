import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createAnsibleAdapter } from "../src/adapters/ansible";
import { upsertServer, updateLastCollected, updateServerStatus } from "../src/repositories/serverRepository";
import { createSnapshot } from "../src/repositories/snapshotRepository";
import { analyzeServerSoftware } from "../src/services/impactAnalysisService";

async function main() {
  const ansibleAdapter = createAnsibleAdapter();
  const servers = await ansibleAdapter.getServers();

  console.log(`Seeding ${servers.length} servers...`);

  for (const server of servers) {
    await upsertServer(server);
    const snapshot = await ansibleAdapter.collectServerData(server.id);
    await createSnapshot(snapshot);
    await updateLastCollected(server.id, new Date(snapshot.collectedAt));
    await updateServerStatus(server.id, server.status);
    console.log(`  - ${server.hostname} (${snapshot.software.map((s) => s.name).join(", ")})`);
  }

  console.log("Running a sample impact analysis for app-server-01 / nginx...");
  const sample = await analyzeServerSoftware("srv-001", "nginx");
  console.log(`  - Created analysis ${sample.id} (${sample.impactLevel})`);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
