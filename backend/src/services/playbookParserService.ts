import yaml from "js-yaml";
import { AppError, ErrorCodes } from "@/lib/errors";
import {
  ConfigChange,
  PackageChange,
  ParsedPlaybook,
  PortChange,
  ServiceChange,
} from "@/domain/playbook";

const NON_MODULE_KEYS = new Set([
  "name",
  "when",
  "become",
  "become_user",
  "become_method",
  "tags",
  "register",
  "notify",
  "vars",
  "loop",
  "with_items",
  "with_dict",
  "delegate_to",
  "environment",
  "ignore_errors",
  "changed_when",
  "failed_when",
  "until",
  "retries",
  "delay",
  "no_log",
  "any_errors_fatal",
]);

const PACKAGE_MODULES = new Set(["apt", "yum", "dnf", "package", "pip", "npm", "gem", "homebrew", "zypper"]);
const SERVICE_MODULES = new Set(["service", "systemd", "sysvinit"]);
const CONFIG_MODULES = new Set(["template", "copy", "lineinfile", "blockinfile", "replace", "ini_file", "xml"]);
const FIREWALL_MODULES = new Set(["ufw", "firewalld", "iptables"]);
const OPAQUE_MODULES = new Set(["command", "shell", "script", "raw"]);

type RawTask = Record<string, unknown>;

function stripModulePrefix(moduleKey: string): string {
  const parts = moduleKey.split(".");
  return parts[parts.length - 1];
}

function toStringParams(raw: unknown): Record<string, string> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        result[key] = Array.isArray(value) ? value.join(",") : String(value);
      }
    }
    return result;
  }
  if (typeof raw === "string") {
    const result: Record<string, string> = {};
    const tokens = raw.split(/\s+(?=[\w-]+=)/);
    for (const token of tokens) {
      const eq = token.indexOf("=");
      if (eq > 0) {
        result[token.slice(0, eq)] = token.slice(eq + 1).replace(/^['"]|['"]$/g, "");
      }
    }
    return result;
  }
  return {};
}

function extractModuleKey(task: RawTask): string | null {
  const candidates = Object.keys(task).filter(
    (key) => !NON_MODULE_KEYS.has(key) && key !== "block" && key !== "rescue" && key !== "always"
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function classifyTask(task: RawTask, out: ParsedPlaybook): void {
  const moduleKey = extractModuleKey(task);
  if (!moduleKey) {
    out.warnings.push("A task with an ambiguous or unrecognized module was skipped.");
    return;
  }

  const moduleName = stripModulePrefix(moduleKey);
  const params = toStringParams(task[moduleKey]);
  const taskName = typeof task.name === "string" ? task.name : undefined;

  if (PACKAGE_MODULES.has(moduleName)) {
    const rawName = params.name ?? params.pkg;
    if (rawName) {
      let name = rawName;
      let version = params.version;
      const eqIndex = rawName.indexOf("=");
      if (!version && eqIndex > 0) {
        name = rawName.slice(0, eqIndex);
        version = rawName.slice(eqIndex + 1);
      }
      const change: PackageChange = { name, version, state: params.state };
      out.packageChanges.push(change);
    } else {
      out.warnings.push(`A "${moduleName}" task did not declare a package name and was skipped.`);
    }
    return;
  }

  if (SERVICE_MODULES.has(moduleName)) {
    if (params.name) {
      const change: ServiceChange = {
        name: params.name,
        state: params.state,
        enabled: params.enabled !== undefined ? /^(yes|true|1)$/i.test(params.enabled) : undefined,
      };
      out.serviceChanges.push(change);
    }
    return;
  }

  if (CONFIG_MODULES.has(moduleName)) {
    const path = params.dest ?? params.path;
    const change: ConfigChange = {
      module: moduleName,
      path,
      description: taskName ?? `${moduleName} task${path ? ` affecting ${path}` : ""}`,
    };
    out.configChanges.push(change);
    return;
  }

  if (FIREWALL_MODULES.has(moduleName)) {
    const portRaw = params.port ?? params.rule;
    const match = portRaw ? /(\d+)(?:\/(\w+))?/.exec(portRaw) : null;
    if (match) {
      const change: PortChange = {
        port: Number.parseInt(match[1], 10),
        protocol: match[2] ?? params.proto,
        state: params.state ?? params.rule,
      };
      out.portChanges.push(change);
    } else {
      out.warnings.push(`A "${moduleName}" task did not declare a resolvable port and was skipped.`);
    }
    return;
  }

  if (OPAQUE_MODULES.has(moduleName)) {
    const raw = typeof task[moduleKey] === "string" ? (task[moduleKey] as string) : JSON.stringify(task[moduleKey]);
    out.opaqueTasks.push(taskName ?? `${moduleName}: ${raw}`);
    return;
  }

  out.warnings.push(`Module "${moduleName}" is not recognized by static analysis and was skipped.`);
}

function walkTasks(tasks: unknown, out: ParsedPlaybook): void {
  if (!Array.isArray(tasks)) return;
  for (const entry of tasks) {
    if (!entry || typeof entry !== "object") continue;
    const task = entry as RawTask;
    if (task.block || task.rescue || task.always) {
      walkTasks(task.block, out);
      walkTasks(task.rescue, out);
      walkTasks(task.always, out);
      continue;
    }
    classifyTask(task, out);
  }
}

function extractHosts(play: RawTask): string[] {
  const hosts = play.hosts;
  if (typeof hosts === "string") return [hosts];
  if (Array.isArray(hosts)) return hosts.map(String);
  return [];
}

/**
 * Statically parses an Ansible playbook to determine what it declares it
 * would do. The playbook is never executed — this is text analysis only.
 */
export function parsePlaybook(rawYaml: string): ParsedPlaybook {
  let document: unknown;
  try {
    document = yaml.load(rawYaml);
  } catch (error) {
    throw new AppError(
      ErrorCodes.VALIDATION_FAILED,
      `The uploaded playbook is not valid YAML: ${error instanceof Error ? error.message : "unknown parse error"}`,
      400
    );
  }

  const out: ParsedPlaybook = {
    hosts: [],
    packageChanges: [],
    serviceChanges: [],
    configChanges: [],
    portChanges: [],
    opaqueTasks: [],
    warnings: [],
  };

  const plays: RawTask[] = Array.isArray(document)
    ? (document as unknown[]).filter((item): item is RawTask => !!item && typeof item === "object")
    : document && typeof document === "object"
      ? [document as RawTask]
      : [];

  if (plays.length === 0) {
    out.warnings.push("The uploaded playbook did not contain any recognizable plays or tasks.");
    return out;
  }

  for (const play of plays) {
    out.hosts.push(...extractHosts(play));

    if (Array.isArray(play.roles) && play.roles.length > 0) {
      out.warnings.push(
        "This playbook references roles, which are not expanded during static analysis — tasks defined inside roles are not reflected in this impact analysis."
      );
    }

    if (play.tasks || play.pre_tasks || play.post_tasks || play.handlers) {
      walkTasks(play.pre_tasks, out);
      walkTasks(play.tasks, out);
      walkTasks(play.post_tasks, out);
      walkTasks(play.handlers, out);
    } else if (!play.hosts && !play.roles) {
      // The document was a bare list of tasks rather than a full play.
      walkTasks([play], out);
    }
  }

  return out;
}
