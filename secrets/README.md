# Secrets for the containerised stack

Two files belong here. Both are bind-mounted read-only into the backend
container, and neither is ever copied into an image — `.dockerignore` excludes
`*.pem`, and `.gitignore` keeps this directory's contents out of the repository.

## `ansible-key.pem`

The private key for the SSH hop from the backend to the Ansible control node.

```bash
cp ~/path/to/ansibleInstance.pem secrets/ansible-key.pem
chmod 600 secrets/ansible-key.pem
```

A read-only mount cannot be `chmod`-ed from inside the container, and `ssh`
refuses any key that others can read, so the entrypoint copies it to a private
path and fixes the mode there. The host-side mode still matters for your own
protection.

**The file must exist before `docker compose up`.** Docker creates a *directory*
at a bind-mount path that does not exist, and the backend then logs a warning
and fails every collection with a key that cannot be read.

## `known_hosts`

The control node's SSH host key. Host-key verification stays on
(`ANSIBLE_SSH_STRICT_HOST_KEY_CHECKING=true`), and a container starts with an
empty `known_hosts`, so without this the first connection fails with
`Host key verification failed`.

Take the entry from a machine that already trusts the host:

```bash
ssh-keygen -F <control-node-hostname> >> secrets/known_hosts
```

Or read it directly, having confirmed the fingerprint out of band:

```bash
ssh-keyscan -H <control-node-hostname> >> secrets/known_hosts
```

The second form is trust-on-first-use — it records whatever answers on that
address at that moment, which is exactly the substitution host-key checking
exists to catch. `ANSIBLE_SSH_KEYSCAN=true` does the same thing automatically on
every container start; it is there for throwaway environments and should not be
used against a control node that matters.

An empty `known_hosts` is committed so the bind mount has a file to point at.
