#!/usr/bin/env bash
#
# Prepares the Ansible control node for dynamic EC2 inventory.
#
# Run this ON the control node, as ec2-user. It is idempotent — re-running it is
# safe and is the intended way to pick up config changes.
#
#   scp -i ~/ansibleInstance.pem -r backend/ansible \
#       ec2-user@<control-node>:/home/ec2-user/ias-ansible
#   ssh -i ~/ansibleInstance.pem ec2-user@<control-node> \
#       'bash /home/ec2-user/ias-ansible/bootstrap-control-node.sh'
#
# It installs no agent on any managed host and modifies nothing outside the
# control node's own home directory.
set -euo pipefail

HOME_DIR="/home/ec2-user"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INVENTORY_DIR="$HOME_DIR/inventory"

echo "==> Installing prerequisites"

# boto3 must be importable by the interpreter *ansible itself* runs under, which
# on Amazon Linux 2023 is the distro python3.9 rather than anything newer that
# might also be installed. Resolve it from ansible instead of assuming `python3`.
ANSIBLE_PY="$(ansible --version | awk -F'= ' '/python version/ {print $2}' | grep -o '/[^ )]*python[0-9.]*' | head -1)"
[ -x "${ANSIBLE_PY:-}" ] || ANSIBLE_PY="$(command -v python3)"
echo "    ansible interpreter: $ANSIBLE_PY ($("$ANSIBLE_PY" -V 2>&1))"

# AL2023 ships python3 without pip, so bootstrap it before use.
if ! "$ANSIBLE_PY" -m pip --version >/dev/null 2>&1; then
  echo "    pip missing, installing python3-pip"
  sudo dnf install -y -q python3-pip
fi

# --user installs into ~/.local, which the same interpreter picks up without
# needing root or touching distro-managed site-packages.
"$ANSIBLE_PY" -m pip install --user --quiet --upgrade 'boto3>=1.28.0' 'botocore>=1.31.0'
echo "    boto3 $("$ANSIBLE_PY" -c 'import boto3; print(boto3.__version__)')"

# The aws_ec2 inventory plugin ships in the amazon.aws collection, which is not
# bundled with ansible-core. The version must be pinned to the installed core:
# amazon.aws 9.x requires core >= 2.16, so an unpinned "latest" install silently
# produces a collection this node cannot load.
CORE_VERSION="$(ansible --version | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1)"
case "$CORE_VERSION" in
  2.1[0-4]) COLLECTION='amazon.aws:>=7.0.0,<8.0.0' ;;
  2.15)     COLLECTION='amazon.aws:>=8.0.0,<9.0.0' ;;
  *)        COLLECTION='amazon.aws' ;;
esac
echo "    ansible-core $CORE_VERSION -> $COLLECTION"
ansible-galaxy collection install --upgrade "$COLLECTION"

echo "==> Installing inventory into $INVENTORY_DIR"
# A directory, not a single file: ansible merges every source inside it, which is
# how the static control-node entry and the dynamic EC2 source coexist. Point
# ANSIBLE_INVENTORY_PATH at this directory.
mkdir -p "$INVENTORY_DIR"
cp "$SRC_DIR"/inventory/*.ini "$INVENTORY_DIR/"

# The dynamic EC2 source is installed only when AWS credentials actually work.
# This is not caution for its own sake: ansible treats a directory inventory as
# unparsed if ANY source inside it fails, so an aws_ec2.yml that cannot reach AWS
# takes the static hosts down with it and the dashboard loses every server —
# "No inventory was parsed" rather than a partial fleet. Staging it as .disabled
# keeps the file on the box, ready to enable the moment an IAM role is attached.
#
# The gate is `ec2:DescribeInstances` succeeding, not merely having credentials.
# An instance role carrying only AmazonSSMManagedInstanceCore authenticates fine
# and then fails every describe call, so testing for credentials alone enables a
# source that cannot work.
AWS_REGION_FOR_DISCOVERY="${AWS_REGION:-eu-north-1}"
if aws ec2 describe-instances --region "$AWS_REGION_FOR_DISCOVERY" --max-items 1 >/dev/null 2>&1; then
  cp "$SRC_DIR/inventory/10-aws_ec2.yml" "$INVENTORY_DIR/10-aws_ec2.yml"
  rm -f "$INVENTORY_DIR/10-aws_ec2.yml.disabled"
  DYNAMIC_ENABLED=yes
else
  cp "$SRC_DIR/inventory/10-aws_ec2.yml" "$INVENTORY_DIR/10-aws_ec2.yml.disabled"
  rm -f "$INVENTORY_DIR/10-aws_ec2.yml"
  DYNAMIC_ENABLED=no
fi
echo "    dynamic EC2 discovery enabled: $DYNAMIC_ENABLED"

echo "==> Installing ~/.ansible.cfg"
cp "$SRC_DIR/ansible.cfg" "$HOME_DIR/.ansible.cfg"

echo "==> Fixing key permissions"
# ansible and ssh both refuse a private key that is group- or world-readable.
shopt -s nullglob
for key in "$HOME_DIR"/*.pem; do
  chmod 400 "$key"
  echo "    $(basename "$key") -> 400"
done
shopt -u nullglob

mkdir -p "$HOME_DIR/.ssh" "$HOME_DIR/.ansible/tmp"
chmod 700 "$HOME_DIR/.ssh"
touch "$HOME_DIR/.ssh/known_hosts"
chmod 600 "$HOME_DIR/.ssh/known_hosts"

echo "==> Verifying AWS credentials"
# An IAM instance role is the right source here; access keys on disk are not
# needed and are worth avoiding on a host that already holds fleet SSH keys.
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  cat >&2 <<'EOF'
    WARNING: no working AWS credentials on this instance.
    Attach an IAM role and re-run. The dynamic inventory returns nothing until then.
EOF
else
  echo "    identity: $(aws sts get-caller-identity --query Arn --output text)"

  # Credentials alone are not enough, and the difference matters: the role may be
  # able to authenticate while being denied every action discovery needs. Report
  # each permission separately so the missing one is named.
  for probe in \
    "ec2:DescribeInstances|aws ec2 describe-instances --region $AWS_REGION_FOR_DISCOVERY --max-items 1" \
    "ssm:DescribeInstanceInformation|aws ssm describe-instance-information --region $AWS_REGION_FOR_DISCOVERY --max-items 1"
  do
    action="${probe%%|*}"
    command="${probe#*|}"
    if eval "$command" >/dev/null 2>&1; then
      echo "    $action: allowed"
    else
      echo "    $action: DENIED — attach ansible/iam/control-node-policy.json to this role"
    fi
  done
fi

echo "==> Discovering instances and trusting their host keys"
# Host-key verification stays on, so every newly discovered host needs its key
# in known_hosts before a non-interactive ansible run can reach it.
# `|| true` is load-bearing: with `set -o pipefail`, a failing inventory source
# (no IAM role, wrong region) makes ansible-inventory exit non-zero and would
# abort this script before it prints the diagnostics that explain why.
DISCOVERED=$( (ansible-inventory -i "$INVENTORY_DIR" --list 2>/dev/null || true) \
  | "$ANSIBLE_PY" -c '
import json, sys
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)
for host, hv in data.get("_meta", {}).get("hostvars", {}).items():
    ip = hv.get("ansible_host", "")
    # The control node is reached locally; it has no host key to trust.
    if ip and hv.get("ansible_connection") != "local":
        print(ip)
' | sort -u)

if [ -z "$DISCOVERED" ]; then
  echo "    none found (check AWS credentials, region, and instance state)"
else
  for ip in $DISCOVERED; do
    # Replace any stale entry — a stopped/started instance can reuse a private
    # IP with a different host key, which otherwise fails verification forever.
    ssh-keygen -R "$ip" -f "$HOME_DIR/.ssh/known_hosts" >/dev/null 2>&1 || true
    if ssh-keyscan -T 5 -H "$ip" >> "$HOME_DIR/.ssh/known_hosts" 2>/dev/null; then
      echo "    trusted $ip"
    else
      echo "    WARNING: could not reach $ip on port 22 — check its security group"
    fi
  done
fi

echo
echo "==> Result"
ansible-inventory -i "$INVENTORY_DIR" --graph || true
echo
echo "Connectivity check:"
ansible all -i "$INVENTORY_DIR" -m ping || true

cat <<EOF

Next: point the backend at this directory and restart it.

  ANSIBLE_INVENTORY_PATH=$INVENTORY_DIR
EOF

if [ "$DYNAMIC_ENABLED" = "yes" ]; then
  cat <<EOF

Dynamic discovery is active. Adding an instance needs no file edits — launch it
with a Name tag, the control node's security group, and a keypair whose .pem sits
in $HOME_DIR, then re-run this script to trust its host key.
EOF
else
  cat <<EOF

Dynamic discovery is OFF (no AWS credentials), so only the hosts in
01-servers.ini are visible. To turn it on:

  1. Attach an IAM role to this instance allowing ec2:DescribeInstances,
     ec2:DescribeRegions, ec2:DescribeTags.
  2. Re-run this script. It enables 10-aws_ec2.yml automatically once
     'aws sts get-caller-identity' succeeds.

Until then, add hosts by editing $INVENTORY_DIR/01-servers.ini.
EOF
fi
