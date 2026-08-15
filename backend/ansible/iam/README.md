# IAM for the Ansible control node

## Why the control node currently sees nothing

The control node (`i-0feef80f170038aa3`) already has an instance role attached,
named `ssm`. That role carries the SSM *managed node* permissions — almost
certainly `AmazonSSMManagedInstanceCore`. Those let the SSM **agent on this
instance** register itself so the instance can be *managed by* Systems Manager.

They do not let this instance *query* AWS. Discovery and Run Command are
caller-side actions, and the role grants neither:

```
aws ec2  describe-instances            -> UnauthorizedOperation (ec2:DescribeInstances)
aws ssm  describe-instance-information -> AccessDeniedException (ssm:DescribeInstanceInformation)
```

This is the single reason dynamic inventory returns nothing. It is not a
configuration problem in Ansible, the inventory plugin, or the backend — every
one of those is already in place and working. `AmazonSSMManagedInstanceCore`
makes an instance a *managed node*; it does not make it a *control plane*.

## What to attach

Attach `control-node-policy.json` to the `ssm` role. Keep the existing
`AmazonSSMManagedInstanceCore` — this policy adds to it rather than replacing it.

```bash
# Run with credentials that can modify IAM — NOT from the control node itself,
# which deliberately has no IAM write access.
aws iam put-role-policy \
  --role-name ssm \
  --policy-name AnsibleControlNode \
  --policy-document file://control-node-policy.json
```

Then, on the control node, confirm and enable discovery:

```bash
aws sts get-caller-identity                       # unchanged
aws ec2 describe-instances --region eu-north-1     # must now succeed
bash ~/ias-ansible/bootstrap-control-node.sh       # enables 10-aws_ec2.yml
```

The bootstrap script enables the dynamic source only once
`aws sts get-caller-identity` and discovery both work, so re-running it is the
switch.

## Scope notes

`Resource: "*"` on the `ec2:Describe*` and `ssm:Describe*` actions is not
laxness — those actions do not support resource-level permissions, so AWS
requires `*`. They are read-only.

`SsmRunCommandAndSessions` is the one block worth narrowing before production. As
written, this role may run commands on **any** instance in the account. Scope it
to the fleet you intend to manage with a condition on the instance tag:

```json
"Condition": {
  "StringEquals": { "ssm:resourceTag/Ansible": "true" }
}
```

`SsmFileTransferBucket` is needed **only** if you switch Ansible's connection
transport from SSH to `aws_ssm`. That connection plugin stages file transfers
through S3, so it needs a bucket in the same region. Replace
`CHANGE-ME-ansible-ssm-transfer` with the real bucket name, or delete the
statement entirely if you stay on SSH.

## Tagging the fleet

Dynamic inventory filters on `Ansible=true`, so each instance you want managed
needs that tag:

```bash
aws ec2 create-tags --region eu-north-1 \
  --resources i-0feef80f170038aa3 i-<the-nginx-instance> \
  --tags Key=Ansible,Value=true
```

After that, a new instance joins the fleet by being launched with
`Ansible=true` — no inventory file, and no backend change.
