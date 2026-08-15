import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

/**
 * Expands a leading "~" to the home directory. Required because the ssh
 * arguments are passed via execFile with no shell, so a literal "~/key.pem"
 * would be handed to ssh unexpanded and fail with "no such identity file".
 */
function expandHome(filePath: string): string {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/")) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

const TIMEOUT_MS = Number(process.env.ANSIBLE_SSH_TIMEOUT_MS ?? 30_000);
const CONNECT_TIMEOUT_S = 10;

/** Raised for any remote ansible invocation failure. Messages never include secret material. */
export class RemoteAnsibleError extends Error {}

export interface AnsibleTarget {
  host: string;
  user: string;
  port: number;
  keyPath?: string;
  inventoryPath: string;
  strictHostKeyChecking: boolean;
}

/**
 * Where Ansible lives. Ansible is installed and configured on a dedicated EC2
 * instance — this backend never runs ansible locally and holds no inventory of
 * its own. Values come from env with defaults baked in, so a deployment only
 * needs to override what differs.
 */
export function getAnsibleTarget(): AnsibleTarget {
  return {
    host: process.env.ANSIBLE_SSH_HOST ?? "",
    user: process.env.ANSIBLE_SSH_USER ?? "ec2-user",
    port: Number(process.env.ANSIBLE_SSH_PORT ?? 22),
    keyPath: process.env.ANSIBLE_SSH_KEY_PATH ? expandHome(process.env.ANSIBLE_SSH_KEY_PATH) : undefined,
    inventoryPath: process.env.ANSIBLE_INVENTORY_PATH ?? "/etc/ansible/hosts",
    // Defaults to on. Only disable for throwaway environments — turning it off
    // removes the protection against a man-in-the-middle on the SSH hop.
    strictHostKeyChecking: process.env.ANSIBLE_SSH_STRICT_HOST_KEY_CHECKING !== "false",
  };
}

export function assertAnsibleTargetConfigured(target: AnsibleTarget): void {
  if (!target.host) {
    throw new RemoteAnsibleError(
      "No Ansible host is configured. Set ANSIBLE_SSH_HOST to the EC2 instance running Ansible."
    );
  }
}

/**
 * Quotes a single argument for safe interpolation into a remote POSIX shell
 * command. `ssh host <command>` hands the command to a shell on the remote
 * side, so remote-side quoting is mandatory even though execFile avoids a
 * local shell. Single-quoting neutralises every metacharacter; an embedded
 * single quote is closed, escaped, and reopened.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Ansible group keywords that expand to more than one host. "localhost" is
 * deliberately NOT here — it resolves to exactly one host and is a legitimate
 * target when Ansible manages the control node itself.
 */
const RESERVED_HOST_PATTERNS = new Set(["all", "ungrouped"]);

/**
 * Host patterns are passed to ansible as argv[0] on the remote side. Anything
 * starting with "-" would be read as a flag, and ansible pattern syntax
 * (":", "!", "*", "&") could widen the target set beyond the intended host, so
 * only plain hostname characters are accepted. The reserved keywords are
 * rejected separately: they are hostname-shaped but would target the whole
 * fleet and return facts for the wrong machine.
 */
function assertSafeHostPattern(hostPattern: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(hostPattern)) {
    throw new RemoteAnsibleError(`Refusing to use "${hostPattern}" as an Ansible host pattern.`);
  }
  if (RESERVED_HOST_PATTERNS.has(hostPattern.toLowerCase())) {
    throw new RemoteAnsibleError(
      `Refusing to use the reserved Ansible pattern "${hostPattern}" — it would target more than one host.`
    );
  }
}

/**
 * Directory holding the SSH control sockets used for connection multiplexing.
 *
 * Deliberately NOT os.tmpdir(): on macOS that is a long /var/folders/... path,
 * and a ControlPath is a unix socket, capped at 104 bytes — ssh refuses to
 * connect at all if the path exceeds it. "/tmp" is short and POSIX-standard.
 * Kept per-user so a shared machine cannot hijack another user's session.
 */
const CONTROL_DIR = path.join(
  process.env.ANSIBLE_SSH_CONTROL_DIR ?? "/tmp",
  `ias-ssh-${os.userInfo().uid}`
);

/** ssh's %C token expands to a 40-char hash; leave headroom under the 104-byte cap. */
const MULTIPLEXING_AVAILABLE = CONTROL_DIR.length + 42 <= 100;

let controlDirReady: Promise<void> | null = null;

function ensureControlDir(): Promise<void> {
  if (!MULTIPLEXING_AVAILABLE) return Promise.resolve();
  controlDirReady ??= fs
    .mkdir(CONTROL_DIR, { recursive: true, mode: 0o700 })
    .then(() => undefined)
    .catch(() => undefined);
  return controlDirReady;
}

function sshArgs(target: AnsibleTarget, remoteCommand: string): string[] {
  const args = [
    "-o", "BatchMode=yes",
    "-o", `ConnectTimeout=${CONNECT_TIMEOUT_S}`,
    "-o", `StrictHostKeyChecking=${target.strictHostKeyChecking ? "yes" : "no"}`,
  ];

  // Multiplex over one shared connection per target. Collecting facts takes
  // several commands and the UI issues several requests per page, so without
  // this each one pays a full TCP + auth handshake and bursts can trip sshd's
  // MaxStartups limit — which surfaces as intermittent 502s. Skipped rather
  // than risked when the socket path would exceed the 104-byte unix limit,
  // since ssh treats an over-long ControlPath as a hard connection failure.
  if (MULTIPLEXING_AVAILABLE) {
    args.push(
      "-o", "ControlMaster=auto",
      "-o", `ControlPath=${path.join(CONTROL_DIR, "%C")}`,
      "-o", "ControlPersist=60"
    );
  }
  if (!target.strictHostKeyChecking) {
    args.push("-o", "UserKnownHostsFile=/dev/null");
  }
  if (target.keyPath) {
    args.push("-i", target.keyPath, "-o", "IdentitiesOnly=yes");
  }
  args.push("-p", String(target.port), `${target.user}@${target.host}`, remoteCommand);
  return args;
}

/** Runs one command on the Ansible EC2 host over SSH. */
async function runOverSsh(
  target: AnsibleTarget,
  remoteCommand: string,
  label: string
): Promise<{ stdout: string; stderr: string }> {
  assertAnsibleTargetConfigured(target);
  await ensureControlDir();

  try {
    const { stdout, stderr } = await execFileAsync("ssh", sshArgs(target, remoteCommand), { timeout: TIMEOUT_MS });
    return { stdout, stderr };
  } catch (error) {
    throw new RemoteAnsibleError(describeSshError(error, label, target));
  }
}

/**
 * Ansible writes its UNREACHABLE/FAILED payload — including the underlying SSH
 * reason, e.g. "Permission denied (publickey)" — to stdout, not stderr. Without
 * this, a host that cannot be reached surfaces only as "Exit code 4", which says
 * that something failed but not what, and is the single most common failure this
 * system produces.
 */
function summariseAnsibleStdout(stdout: string): string {
  const marker = stdout.match(/"msg":\s*"((?:[^"\\]|\\.)*)"/);
  if (marker) {
    const msg = marker[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
    if (msg) return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
  }
  const line = stdout
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.includes("UNREACHABLE!") || l.includes("FAILED!"));
  if (!line) return "";
  return line.length > 300 ? `${line.slice(0, 300)}…` : line;
}

export interface InventoryListResult {
  groups: string[];
  hostvars: Record<string, Record<string, unknown>>;
}

/** Read-only inventory introspection, run on the Ansible host. Contacts no managed host. */
export async function listRemoteInventory(target = getAnsibleTarget()): Promise<InventoryListResult> {
  const command = `ansible-inventory -i ${shellQuote(target.inventoryPath)} --list`;
  const { stdout, stderr } = await runOverSsh(target, command, "ansible-inventory");

  // ansible-inventory exits 0 even when the inventory file is missing or
  // unparseable — it just warns and reports an implicit localhost. Without this
  // check a wrong ANSIBLE_INVENTORY_PATH looks like "you have no servers"
  // instead of a misconfiguration.
  if (/no inventory was parsed/i.test(stderr)) {
    throw new RemoteAnsibleError(
      `Ansible found no inventory at "${target.inventoryPath}" on ${target.host}. ` +
        `Create the inventory there, or point ANSIBLE_INVENTORY_PATH at the correct file.`
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new RemoteAnsibleError("ansible-inventory returned output that could not be parsed as JSON.");
  }

  const meta = parsed["_meta"] as { hostvars?: Record<string, Record<string, unknown>> } | undefined;
  const hostvars = meta?.hostvars ?? {};
  const groups = Object.keys(parsed).filter((key) => key !== "_meta" && key !== "all" && key !== "ungrouped");

  return { groups, hostvars };
}

/**
 * Runs a single official, read-only fact-gathering module against one host,
 * from the Ansible EC2 host. Only `setup` | `package_facts` | `service_facts`
 * are permitted — no shell/command content is ever run, so nothing this does
 * can modify a managed host.
 */
export async function runRemoteFactsModule(
  hostPattern: string,
  module: "setup" | "package_facts" | "service_facts",
  target = getAnsibleTarget()
): Promise<Record<string, unknown>> {
  assertSafeHostPattern(hostPattern);

  const command = [
    "ansible",
    shellQuote(hostPattern),
    "-i",
    shellQuote(target.inventoryPath),
    "-m",
    module,
    "-o",
  ].join(" ");

  const { stdout } = await runOverSsh(target, command, "ansible");
  return parseOneLineFacts(stdout, hostPattern, module);
}

/**
 * Parses a one-line ansible result into the module's full return value.
 *
 * Kept separate from parseOneLineFacts because most modules return their payload
 * at the top level while still including an `ansible_facts` key holding only the
 * discovered interpreter. Unwrapping to `ansible_facts` unconditionally would
 * silently discard that payload — which is exactly what happened to `find`'s
 * "files" array.
 */
function parseOneLineResult(stdout: string, hostPattern: string, module: string): Record<string, unknown> {
  const line = stdout.split("\n").find((l) => l.includes("=>"));
  if (!line) {
    throw new RemoteAnsibleError(`No result was returned for ${module} against "${hostPattern}".`);
  }
  if (line.includes("UNREACHABLE!") || line.includes("FAILED!")) {
    throw new RemoteAnsibleError(
      `"${hostPattern}" was unreachable from the Ansible host, or the ${module} module failed.`
    );
  }

  const jsonText = line.slice(line.indexOf("=>") + 2).trim();
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    throw new RemoteAnsibleError(`Could not parse ${module} output for "${hostPattern}".`);
  }
}

/** As above, but unwrapped to the gathered facts — for the fact-gathering modules. */
function parseOneLineFacts(stdout: string, hostPattern: string, module: string): Record<string, unknown> {
  const parsed = parseOneLineResult(stdout, hostPattern, module) as {
    ansible_facts?: Record<string, unknown>;
  } & Record<string, unknown>;
  return parsed.ansible_facts ?? parsed;
}

/**
 * Filesystem prefixes searched for locally-installed software, and the only
 * prefixes a discovered binary may be executed from.
 *
 * These are the conventional destinations for software built from source or
 * unpacked from a vendor tarball — `make install` defaults to /usr/local, and
 * /opt is the LSB location for self-contained third-party packages. The
 * distribution's own binaries live in /usr/bin and /usr/sbin and are already
 * reported by the RPM database, so searching there would only duplicate rows.
 *
 * This doubles as the execution allowlist. A binary discovered anywhere else is
 * never probed, so a writable directory elsewhere on the host cannot be used to
 * get something executed through this path.
 */
const SOURCE_INSTALL_PREFIXES = ["/usr/local/bin", "/usr/local/sbin", "/opt"] as const;

/** Bounds the search so a deeply nested /opt tree cannot return thousands of files. */
const FIND_MAX_DEPTH = 4;

export interface RemoteFile {
  path: string;
  /** Octal mode string as ansible reports it, e.g. "0755". */
  mode: string;
}

/**
 * Lists regular files under the source-install prefixes. Read-only: the `find`
 * module only stats the filesystem and cannot modify a managed host.
 *
 * Missing prefixes are not an error — most hosts have no /usr/local/sbin — so
 * the module is asked for each prefix at once and absent ones simply contribute
 * nothing.
 */
export async function findRemoteLocalBinaries(
  hostPattern: string,
  target = getAnsibleTarget()
): Promise<RemoteFile[]> {
  assertSafeHostPattern(hostPattern);

  const args = [
    `paths=${SOURCE_INSTALL_PREFIXES.join(",")}`,
    "file_type=file",
    "recurse=yes",
    `depth=${FIND_MAX_DEPTH}`,
  ].join(" ");

  const command = [
    "ansible",
    shellQuote(hostPattern),
    "-i",
    shellQuote(target.inventoryPath),
    "-m",
    "find",
    "-a",
    shellQuote(args),
    "-o",
  ].join(" ");

  const { stdout } = await runOverSsh(target, command, "ansible find");
  const parsed = parseOneLineResult(stdout, hostPattern, "find");
  const files = Array.isArray(parsed["files"]) ? (parsed["files"] as Record<string, unknown>[]) : [];

  return files
    .map((f) => ({ path: asString(f["path"]) ?? "", mode: asString(f["mode"]) ?? "" }))
    .filter((f) => f.path !== "" && isExecutableMode(f.mode));
}

/** True when any of the owner/group/other execute bits are set. */
function isExecutableMode(mode: string): boolean {
  const octal = mode.slice(-3);
  if (!/^[0-7]{3}$/.test(octal)) return false;
  return octal.split("").some((digit) => (Number(digit) & 1) === 1);
}

/**
 * Version flags tried against a discovered binary, in order. Fixed set, never
 * derived from input: the probe can only ever ask a program to print its own
 * version, which is the least invasive thing a binary can be asked to do.
 */
const VERSION_FLAGS = ["--version", "-v", "-V", "-version"] as const;

/**
 * Runs `<binary> <version-flag>` on a managed host and returns its output.
 *
 * This is the one place the system executes something of its own choosing on a
 * managed host, so it is fenced in three ways: the binary must sit under
 * SOURCE_INSTALL_PREFIXES, the argument comes from VERSION_FLAGS rather than
 * from any caller, and the ansible `command` module is used rather than `shell`
 * so there is no shell to interpret metacharacters. Nothing here can write to
 * the host.
 */
export async function probeRemoteBinaryVersion(
  hostPattern: string,
  binaryPath: string,
  target = getAnsibleTarget()
): Promise<string | null> {
  assertSafeHostPattern(hostPattern);
  assertAllowedBinaryPath(binaryPath);

  for (const flag of VERSION_FLAGS) {
    const command = [
      "ansible",
      shellQuote(hostPattern),
      "-i",
      shellQuote(target.inventoryPath),
      "-m",
      "command",
      "-a",
      shellQuote(`${binaryPath} ${flag}`),
      "-o",
    ].join(" ");

    let stdout: string;
    try {
      ({ stdout } = await runOverSsh(target, command, "ansible command"));
    } catch {
      // A binary that rejects this flag exits non-zero, which ansible reports as
      // a failed task and runOverSsh turns into a throw. That is an expected
      // outcome per flag, not a host problem — try the next one.
      continue;
    }

    const output = readCommandOutput(stdout);
    if (output) return output;
  }

  return null;
}

/**
 * Rejects any path outside the source-install prefixes, and any path containing
 * traversal or shell-significant characters. Belt and braces: the path comes
 * from our own `find` results, but this is the guard that makes executing it
 * defensible even if that ever changes.
 */
function assertAllowedBinaryPath(binaryPath: string): void {
  if (!/^[A-Za-z0-9/._-]+$/.test(binaryPath) || binaryPath.includes("..")) {
    throw new RemoteAnsibleError(`Refusing to probe the path "${binaryPath}".`);
  }
  const allowed = SOURCE_INSTALL_PREFIXES.some((prefix) => binaryPath.startsWith(`${prefix}/`));
  if (!allowed) {
    throw new RemoteAnsibleError(
      `Refusing to probe "${binaryPath}" — only binaries under ${SOURCE_INSTALL_PREFIXES.join(", ")} may be executed.`
    );
  }
}

/**
 * Pulls stdout (or stderr) out of a one-line `command` result. Version output
 * legitimately arrives on either stream — nginx and many autotools programs
 * print theirs to stderr.
 */
function readCommandOutput(stdout: string): string | null {
  const line = stdout.split("\n").find((l) => l.includes("=>"));
  if (!line) return null;

  try {
    const parsed = JSON.parse(line.slice(line.indexOf("=>") + 2).trim()) as Record<string, unknown>;
    const out = (asString(parsed["stdout"]) ?? "").trim();
    const err = (asString(parsed["stderr"]) ?? "").trim();
    return out || err || null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Turns an exec failure into something actionable. SSH exit code 255 is its own
 * transport failure rather than a non-zero exit from the remote command, and
 * 127 means the remote shell could not find the binary — both are common
 * first-run misconfigurations, so they get specific guidance.
 */
function describeSshError(error: unknown, label: string, target: AnsibleTarget): string {
  const err = error as {
    code?: string | number;
    killed?: boolean;
    signal?: string;
    stderr?: string;
    stdout?: string;
  };
  const where = `${target.user}@${target.host}:${target.port}`;

  if (err?.code === "ENOENT") {
    return `The "ssh" client was not found on this server, so the Ansible host cannot be reached.`;
  }
  if (err?.killed || err?.signal) {
    return `${label} timed out after ${TIMEOUT_MS}ms against ${where}.`;
  }

  const stderr = (err?.stderr ?? "").toString().trim();
  if (err?.code === 255) {
    return `SSH could not connect to ${where}. ${summariseStderr(stderr) || "Check the host, port, security group, and key."}`;
  }
  if (err?.code === 127) {
    return `"${label}" is not installed on the Ansible host ${target.host}, or is not on its PATH.`;
  }

  const detail =
    summariseStderr(stderr) ||
    summariseAnsibleStdout((err?.stdout ?? "").toString()) ||
    `Exit code ${String(err?.code ?? "unknown")}.`;
  return `${label} failed on ${where}. ${detail}`;
}

/** First meaningful stderr line, truncated. Never echoes key material. */
function summariseStderr(stderr: string): string {
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !/^warning: permanently added/i.test(l));
  if (!line) return "";
  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}
