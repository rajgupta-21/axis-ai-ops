export interface PackageChange {
  name: string;
  version?: string;
  state?: string;
}

export interface ServiceChange {
  name: string;
  state?: string;
  enabled?: boolean;
}

export interface ConfigChange {
  module: string;
  path?: string;
  description: string;
}

export interface PortChange {
  port: number;
  protocol?: string;
  state?: string;
}

/**
 * Result of statically parsing an uploaded Ansible playbook. Nothing in
 * this pipeline ever executes the playbook — this is a read-only summary
 * of what the playbook declares it would do, used only as analysis input.
 */
export interface ParsedPlaybook {
  hosts: string[];
  packageChanges: PackageChange[];
  serviceChanges: ServiceChange[];
  configChanges: ConfigChange[];
  portChanges: PortChange[];
  opaqueTasks: string[];
  warnings: string[];
}
