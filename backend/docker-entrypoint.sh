#!/bin/sh
#
# Prepares SSH before starting the API.
#
# Database migrations are deliberately NOT run here — they are a separate
# one-shot `migrate` service in docker-compose.yml, which is built from the
# build stage because the Prisma CLI is a devDependency and is not present in
# this runtime image. Running them per-container would also mean every replica
# racing to migrate the same database on startup.
set -e

SSH_DIR="$HOME/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# --- Private key -------------------------------------------------------------
#
# The key is mounted read-only from the host, which means it arrives with the
# host's ownership and mode. ssh refuses any key that is group- or
# world-readable ("UNPROTECTED PRIVATE KEY FILE"), and a read-only mount cannot
# be chmod'ed in place, so it is copied to a private path and ANSIBLE_SSH_KEY_PATH
# is repointed at the copy.
if [ -n "${ANSIBLE_SSH_KEY_PATH:-}" ] && [ -f "$ANSIBLE_SSH_KEY_PATH" ]; then
  cp "$ANSIBLE_SSH_KEY_PATH" "$SSH_DIR/ansible_key"
  chmod 600 "$SSH_DIR/ansible_key"
  export ANSIBLE_SSH_KEY_PATH="$SSH_DIR/ansible_key"
  echo "[entrypoint] SSH key prepared at $ANSIBLE_SSH_KEY_PATH"
elif [ -n "${ANSIBLE_SSH_KEY_PATH:-}" ]; then
  echo "[entrypoint] WARNING: ANSIBLE_SSH_KEY_PATH=$ANSIBLE_SSH_KEY_PATH does not exist in this container."
  echo "[entrypoint]          Check the volume mount in docker-compose.yml. Collections will fail."
fi

# --- Host key ----------------------------------------------------------------
#
# Host-key verification is on by default (ANSIBLE_SSH_STRICT_HOST_KEY_CHECKING),
# and a fresh container has an empty known_hosts, so the very first connection
# fails with "Host key verification failed" unless the key is present.
#
# Two supported ways to provide it, in order of preference:
#
#   1. Mount a known_hosts file (see docker-compose.yml). Verification is real:
#      the key was established out of band and is being checked.
#   2. Set ANSIBLE_SSH_KEYSCAN=true to fetch it on startup. This is
#      trust-on-first-use — it accepts whatever answers on that address right
#      now, so it cannot detect the man-in-the-middle that host-key checking
#      exists to catch. Convenient for a throwaway environment; not for one
#      reaching a production control node.
# ssh reads ~/.ssh/known_hosts by default, and the mount is elsewhere and
# read-only, so the entries are copied in rather than referenced in place —
# ssh-keyscan below needs somewhere writable to append to.
KNOWN_HOSTS_MOUNT="${SSH_KNOWN_HOSTS_PATH:-/run/secrets/known_hosts}"
touch "$SSH_DIR/known_hosts"
chmod 600 "$SSH_DIR/known_hosts"

if [ -f "$KNOWN_HOSTS_MOUNT" ] && [ -s "$KNOWN_HOSTS_MOUNT" ]; then
  cat "$KNOWN_HOSTS_MOUNT" >> "$SSH_DIR/known_hosts"
  echo "[entrypoint] loaded $(grep -c . "$KNOWN_HOSTS_MOUNT") known host key(s)"
elif [ "${ANSIBLE_SSH_KEYSCAN:-false}" != "true" ]; then
  echo "[entrypoint] WARNING: no host keys provided at $KNOWN_HOSTS_MOUNT and ANSIBLE_SSH_KEYSCAN is not"
  echo "[entrypoint]          enabled, so host-key verification will reject the control node."
  echo "[entrypoint]          See secrets/README.md."
fi

if [ "${ANSIBLE_SSH_KEYSCAN:-false}" = "true" ] && [ -n "${ANSIBLE_SSH_HOST:-}" ]; then
  echo "[entrypoint] WARNING: trusting $ANSIBLE_SSH_HOST on first use (ANSIBLE_SSH_KEYSCAN=true)."
  ssh-keyscan -T 5 -p "${ANSIBLE_SSH_PORT:-22}" -H "$ANSIBLE_SSH_HOST" >> "$SSH_DIR/known_hosts" 2>/dev/null \
    && echo "[entrypoint] host key recorded" \
    || echo "[entrypoint] WARNING: could not reach $ANSIBLE_SSH_HOST to read its host key"
fi

exec "$@"
