import { AnsibleAdapter } from "./AnsibleAdapter";
import { Server, ServerDetails, ServerSnapshot } from "@/domain/server";

/**
 * Production adapter for a real Ansible AWX/Tower deployment.
 *
 * Flow: Node.js -> AWX REST API -> Launch Job -> Ansible Playbook ->
 * Target Server -> Facts/packages/services/metrics -> AWX Job Result ->
 * Node.js normalization into the shared Server/ServerSnapshot model.
 *
 * Credentials are read only from environment variables on the backend and
 * are never exposed to the frontend. This class intentionally implements
 * the same AnsibleAdapter interface as SimulatedAnsibleAdapter so it can
 * replace it via createAnsibleAdapter() with no frontend or service changes.
 */
export class AWXApiAdapter implements AnsibleAdapter {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly jobTemplateId?: string;

  constructor() {
    this.baseUrl = process.env.AWX_BASE_URL ?? "";
    this.token = process.env.AWX_TOKEN;
    this.username = process.env.AWX_USERNAME;
    this.password = process.env.AWX_PASSWORD;
    this.jobTemplateId = process.env.AWX_JOB_TEMPLATE_ID;
  }

  private assertConfigured(): void {
    if (!this.baseUrl) {
      throw new Error(
        "AWX_BASE_URL is not configured. Set ANSIBLE_PROVIDER=simulated or configure AWX environment variables."
      );
    }
  }

  private authHeaders(): Record<string, string> {
    if (this.token) {
      return { Authorization: `Bearer ${this.token}` };
    }
    if (this.username && this.password) {
      const basic = Buffer.from(`${this.username}:${this.password}`).toString("base64");
      return { Authorization: `Basic ${basic}` };
    }
    return {};
  }

  async getServers(): Promise<Server[]> {
    this.assertConfigured();
    // TODO: GET {baseUrl}/api/v2/inventories/{id}/hosts/ and map hosts to Server[]
    throw new Error("AWXApiAdapter.getServers is not yet connected to a live AWX instance.");
  }

  async getServerDetails(serverId: string): Promise<ServerDetails> {
    this.assertConfigured();
    // TODO: GET {baseUrl}/api/v2/hosts/{serverId}/ plus latest fact cache
    void serverId;
    throw new Error("AWXApiAdapter.getServerDetails is not yet connected to a live AWX instance.");
  }

  async collectServerData(serverId: string): Promise<ServerSnapshot> {
    this.assertConfigured();
    // TODO: POST {baseUrl}/api/v2/job_templates/{this.jobTemplateId}/launch/
    // then poll the job, fetch job events/facts, and normalize into ServerSnapshot.
    void serverId;
    void this.jobTemplateId;
    void this.authHeaders();
    throw new Error("AWXApiAdapter.collectServerData is not yet connected to a live AWX instance.");
  }
}
