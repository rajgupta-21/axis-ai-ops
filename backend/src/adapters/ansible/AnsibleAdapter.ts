import { Server, ServerDetails, ServerSnapshot } from "@/domain/server";

export interface AnsibleAdapter {
  getServers(): Promise<Server[]>;
  getServerDetails(serverId: string): Promise<ServerDetails>;
  collectServerData(serverId: string): Promise<ServerSnapshot>;
}
