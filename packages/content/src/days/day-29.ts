import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 29,
  week: 5,
  pillar: 'DEVOPS',
  title: 'CI/CD & Cloud — Actions, GitLab CI, Jenkins, AWS/GCP/Azure',
  summary: 'Turn a green test run into a deployed, rollback-able release on real cloud infrastructure.',
  estimatedMinutes: 330,
  objectives: [
    'Describe the build → test → scan → package → deploy pipeline and what each stage guarantees',
    'Write a GitHub Actions workflow with matrix builds, caching, secrets and OIDC cloud auth',
    'Translate the same pipeline into .gitlab-ci.yml and a declarative Jenkinsfile',
    'Choose between blue-green, canary, rolling and feature-flag rollouts and justify the choice',
    'Map the core cloud primitives — compute, storage, managed DB, networking, IAM — across AWS, GCP and Azure',
    'Provision infrastructure reproducibly with Terraform and least-privilege IAM',
  ],
  technologies: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'AWS', 'Google Cloud', 'Azure'],
  lessons: [
    {
      slug: 'the-cicd-pipeline-model',
      title: 'The CI/CD Pipeline Model & Deployment Strategies',
      estimatedMinutes: 70,
      body: `# The CI/CD Pipeline Model & Deployment Strategies

A pipeline is not "the thing that runs the tests". It is the **only** path code takes from a developer's laptop to production, and every guarantee your team makes about quality is enforced there or nowhere.

## Continuous Integration vs Delivery vs Deployment

- **Continuous Integration** — every push is merged into the trunk and verified automatically. The unit of work is small, the branch is short-lived, and \`main\` is always green.
- **Continuous Delivery** — every green commit produces a *deployable artifact* and can be released with a button press.
- **Continuous Deployment** — that button is pressed automatically.

Most teams should aim for continuous *delivery* first. The gap between "we can deploy in one click" and "we deploy automatically" is a business decision; the gap between "we can't deploy without a 40-step wiki page" and either of those is an engineering emergency.

## The five stages

\`\`\`
build → test → scan → package → deploy
\`\`\`

| Stage | Question it answers | Typical time budget |
| --- | --- | --- |
| **build** | Does it compile / bundle at all? | < 2 min |
| **test** | Does it still behave? (unit → integration → e2e) | < 10 min |
| **scan** | Is it safe? (SAST, dependency CVEs, secrets, licences, image CVEs) | < 3 min, parallel |
| **package** | Produce *one* immutable artifact — a container image, a tarball, a wheel | < 3 min |
| **deploy** | Move that artifact through environments | minutes |

Two rules make this model work.

**Rule 1 — build once, deploy many.** The artifact that runs in production is byte-identical to the one that passed the tests in staging. If your pipeline rebuilds the image per environment, you have not tested what you shipped. Environment differences belong in *configuration* (env vars, mounted secrets), never in the build.

**Rule 2 — fail fast, cheapest first.** Lint and unit tests before the 12-minute e2e suite. A pipeline that reports a typo after 20 minutes trains people to stop reading it.

## Artifacts, caches and their crucial difference

- A **cache** is a performance optimisation. It may be cold, stale or absent; the pipeline must still be correct without it. Cache dependency downloads (\`~/.npm\`, \`~/.m2\`, Go module cache), *not* build outputs.
- An **artifact** is a deliverable that later stages or humans consume: the \`dist/\` folder, a coverage report, a JUnit XML, a signed binary.

> Caching \`node_modules\` directly instead of the package manager's cache directory is a classic footgun: a cache key that misses a lockfile change resurrects the wrong dependency tree and produces a build that no one can reproduce locally.

## Environments and promotion

An **environment** is a named deployment target with its own configuration, its own secrets, and — importantly — its own approval rules.

\`\`\`
PR preview  →  staging (auto)  →  production (approval)
\`\`\`

Every serious CI system models this: GitHub Actions has *environments* with required reviewers and wait timers, GitLab has \`environment:\` with protected variables, Jenkins has input steps and folder-scoped credentials. Use them instead of a hand-rolled "only deploy if branch == main" \`if\` — the platform can enforce that a human approved *this specific artifact*.

## Versioning the artifact

Tag images with something immutable and traceable. The git SHA is the minimum:

\`\`\`
ghcr.io/acme/api:sha-9f3c1ab      # immutable, always
ghcr.io/acme/api:1.7.0            # semantic, for humans
ghcr.io/acme/api:latest           # convenience only, never referenced by a deploy
\`\`\`

Deploying \`:latest\` means you cannot say what is running, and cannot roll back to a known-good digest. Reference images by tag-with-SHA or by digest (\`@sha256:...\`) in your deployment manifests.

## Deployment strategies

| Strategy | How it works | Rollback | Cost | Use when |
| --- | --- | --- | --- | --- |
| **Recreate** | Stop v1, start v2 | Redeploy v1 | Cheapest | Downtime is acceptable; batch jobs |
| **Rolling** | Replace instances N at a time | Roll forward/back, slow | None extra | Stateless services, the Kubernetes default |
| **Blue-green** | Two full environments; flip the load balancer | Flip back, seconds | 2× infra briefly | You need an instant, total rollback |
| **Canary** | Send 1% → 5% → 25% → 100% of traffic to v2, watching metrics | Route 0% to v2 | Small | High-traffic services where you can measure |
| **Feature flag** | Ship the code dark, enable per-user/percentage at runtime | Toggle off, instant | Flag infra + debt | Risky features, gradual exposure, A/B tests |

Two things people get wrong:

**Canary without an SLI is theatre.** A canary is only useful if a machine is watching the canary's error rate and latency against the baseline and can roll back without a human. "Deploy to 5% then check Slack" is not a canary; it is a slower outage.

**Blue-green does not solve database migrations.** During the flip, both versions may be live against the same schema. That forces the **expand/contract** pattern: deploy a backwards-compatible schema change (add a nullable column), deploy code that writes both old and new, backfill, deploy code that reads new, and only then drop the old column — in a *later* release.

## Pipeline hygiene that pays for itself

- **Pin your actions and images** by major tag at minimum (\`actions/checkout@v4\`), by SHA for anything that touches secrets.
- **Least privilege by default**: read-only tokens unless a job specifically needs to write.
- **Cancel superseded runs** on the same branch — no one needs results for a commit that has already been replaced.
- **Make the pipeline runnable locally.** If \`npm run ci\` does what CI does, people fix problems before pushing.
- **Track two numbers**: pipeline duration (p50 and p95) and flake rate. Both are features. A 5% flaky suite trains engineers to hit "re-run" without reading, which is exactly how a real failure ships.`,
    },
    {
      slug: 'github-actions-in-depth',
      title: 'GitHub Actions in Depth',
      estimatedMinutes: 80,
      body: `# GitHub Actions in Depth

Actions is a YAML-defined, event-driven job runner attached to your repository. The mental model is four nouns:

**Workflow** (a file in \`.github/workflows/\`) → contains **jobs** → each job runs on one **runner** → and executes **steps** in order. Jobs run in parallel by default and on *separate machines*; steps in a job share a filesystem and a working directory.

## A complete CI workflow

\`\`\`yaml
# .github/workflows/ci.yml
name: ci

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

# Cancel an in-flight run when the same branch gets a newer commit.
concurrency:
  group: ci-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

# Least privilege: the default GITHUB_TOKEN can only read.
permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-node\${{ matrix.node }}
          path: coverage/
          retention-days: 7
\`\`\`

\`\${{ ... }}\` is the **expression syntax**. It is evaluated by the runner before the shell sees it, with contexts like \`github\`, \`env\`, \`matrix\`, \`secrets\`, \`needs\`, \`runner\` and \`job\` in scope.

## Triggers worth knowing

| Event | Fires when | Gotcha |
| --- | --- | --- |
| \`push\` | commits land on a branch/tag | filter with \`branches:\`, \`tags:\`, \`paths:\` |
| \`pull_request\` | PR opened/synchronised | forks get a **read-only** token and no secrets |
| \`pull_request_target\` | same, but runs in the *base* repo context | has secrets — never check out untrusted PR code here |
| \`schedule\` | cron (UTC) | disabled after 60 days of repo inactivity |
| \`workflow_dispatch\` | manual, with typed \`inputs\` | your "run it now" button |
| \`workflow_call\` | another workflow calls it | the basis of reusable workflows |

## Matrix builds

A matrix multiplies out into one job per combination:

\`\`\`yaml
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, windows-latest]
    node: [20, 22]
    include:
      - os: ubuntu-latest
        node: 22
        coverage: true          # extra property on one combination
    exclude:
      - os: windows-latest
        node: 20
\`\`\`

That yields 3 jobs. \`fail-fast: false\` stops one red cell from cancelling its siblings — you almost always want the full picture.

## Caching

\`setup-node\`'s \`cache: npm\` covers the common case. For anything else use the cache action explicitly:

\`\`\`yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      .next/cache
    key: \${{ runner.os }}-build-\${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      \${{ runner.os }}-build-
\`\`\`

\`key\` is an exact match. If it misses, \`restore-keys\` are tried as **prefixes**, newest first — a partial hit that still saves most of the download. Caches are immutable once written and are scoped: a branch can read caches from its base branch, but not from a sibling branch.

## Secrets and OIDC

Never put long-lived cloud keys in repository secrets. Instead, let the runner mint a short-lived **OIDC token** and exchange it for cloud credentials:

\`\`\`yaml
  deploy:
    needs: [test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production        # approvals + environment secrets
    permissions:
      id-token: write              # required to request the OIDC token
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/gha-deploy
          aws-region: ap-southeast-2

      - run: aws s3 sync ./dist s3://acme-web-prod --delete
\`\`\`

The IAM role's trust policy pins the token issuer *and* the exact repository and branch, so no other repo can assume it:

\`\`\`json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:acme/web:ref:refs/heads/main" }
  }
}
\`\`\`

GCP (Workload Identity Federation via \`google-github-actions/auth\`) and Azure (\`azure/login\` with a federated credential) work the same way. **Zero static credentials is now the baseline, not an advanced setting.**

Secrets are masked in logs, but masking is textual — \`echo \$SECRET | base64\` leaks. Secrets are also unavailable to workflows triggered by pull requests from forks, which is the feature that stops a drive-by PR from exfiltrating them.

## Building and pushing an image

\`\`\`yaml
  package:
    needs: [test]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/\${{ github.repository }}:sha-\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
\`\`\`

## Reusable workflows and composite actions

A **reusable workflow** is a whole job graph you call from elsewhere:

\`\`\`yaml
# .github/workflows/deploy.yml  (the callee)
on:
  workflow_call:
    inputs:
      environment: { required: true, type: string }
    secrets:
      registry_token: { required: true }
\`\`\`

\`\`\`yaml
# the caller
jobs:
  ship:
    uses: ./.github/workflows/deploy.yml
    with:
      environment: production
    secrets:
      registry_token: \${{ secrets.REGISTRY_TOKEN }}
\`\`\`

A **composite action** (\`action.yml\` with \`runs.using: composite\`) packages a sequence of *steps* instead. Rule of thumb: steps → composite action; jobs, matrices or environments → reusable workflow.

> Jobs share nothing but what you pass. To hand data between them use \`outputs\` (\`needs.test.outputs.version\`) or upload/download artifacts — the filesystem does not travel.`,
    },
    {
      slug: 'gitlab-ci-and-jenkins',
      title: 'GitLab CI and Jenkins — The Same Pipeline, Twice',
      estimatedMinutes: 65,
      body: `# GitLab CI and Jenkins — The Same Pipeline, Twice

You will not always get to pick your CI system. The concepts transfer completely; only the nouns change.

| Concept | GitHub Actions | GitLab CI | Jenkins |
| --- | --- | --- | --- |
| Definition file | \`.github/workflows/*.yml\` | \`.gitlab-ci.yml\` | \`Jenkinsfile\` |
| Unit of parallelism | job | job (grouped into stages) | stage / parallel block |
| Executor | runner | runner (shell, docker, k8s) | agent / node |
| Reuse | reusable workflow, composite action | \`include\`, \`extends\`, YAML anchors | shared library |
| Secrets | repo/environment secrets, OIDC | CI/CD variables (masked, protected) | credentials binding |

## GitLab CI

GitLab organises jobs into **stages** that run in sequence; jobs inside a stage run in parallel.

\`\`\`yaml
# .gitlab-ci.yml
stages: [build, test, scan, package, deploy]

default:
  image: node:22-alpine
  interruptible: true

variables:
  npm_config_cache: "$CI_PROJECT_DIR/.npm"
  DOCKER_IMAGE: "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA"

cache:
  key:
    files: [package-lock.json]
  paths: [.npm/]
  policy: pull-push

build:
  stage: build
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]
    expire_in: 1 week

unit-test:
  stage: test
  script:
    - npm ci --cache .npm --prefer-offline
    - npm test -- --coverage --reporters=default --reporters=jest-junit
  coverage: '/All files[^|]*\\|[^|]*\\s+([\\d.]+)/'
  artifacts:
    when: always
    reports:
      junit: junit.xml

audit:
  stage: scan
  script: npm audit --audit-level=high
  allow_failure: true

package:
  stage: package
  image: docker:27
  services: [docker:27-dind]
  script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" "$CI_REGISTRY"
    - docker build -t "$DOCKER_IMAGE" .
    - docker push "$DOCKER_IMAGE"
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'

deploy:production:
  stage: deploy
  environment:
    name: production
    url: https://app.example.com
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
      when: manual
  script:
    - ./scripts/deploy.sh "$DOCKER_IMAGE"
\`\`\`

Things worth calling out:

- **\`rules:\`** replaced the old \`only/except\`. Each rule is evaluated top-down; the first match decides whether the job is created and with what \`when\` (\`on_success\`, \`manual\`, \`never\`, \`delayed\`).
- **\`artifacts:reports:\`** is not just storage — GitLab parses JUnit, coverage, SAST and dependency-scanning reports and renders them *inside the merge request*. That feedback loop is GitLab's real advantage.
- **\`environment:\`** creates a first-class deployment record with a URL, a rollback button and an audit trail, and unlocks *protected variables* which are only exposed to protected branches/tags.
- **\`needs:\`** breaks out of strict stage ordering and builds a DAG, so a fast job does not wait for a slow sibling in an earlier stage.

Runners are agents you register against the project or group. The **docker executor** runs each job in a fresh container (\`image:\`), with \`services:\` for sidecars like \`postgres:16\` or \`docker:dind\`. Self-hosting runners is normal at GitLab — it is how you get big machines, GPUs, or access to a private network.

Reuse comes from \`extends\` and \`include\`:

\`\`\`yaml
include:
  - project: acme/ci-templates
    ref: v3
    file: /node/test.yml

.node-job:
  image: node:22-alpine
  before_script: [npm ci --cache .npm --prefer-offline]

integration-test:
  extends: .node-job
  stage: test
  script: [npm run test:integration]
\`\`\`

A job whose name starts with \`.\` is a hidden template and never runs on its own.

## Jenkins

Jenkins is twenty years old, self-hosted, and still runs an enormous amount of the world's builds. Modern Jenkins means a **declarative pipeline** checked into the repo:

\`\`\`groovy
// Jenkinsfile
pipeline {
  agent none

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
    disableConcurrentBuilds(abortPrevious: true)
  }

  environment {
    REGISTRY = 'ghcr.io/acme'
    IMAGE    = "acme-api"
  }

  stages {
    stage('Test') {
      agent { docker { image 'node:22-alpine' } }
      steps {
        sh 'npm ci'
        sh 'npm run lint'
        sh 'npm test -- --ci --reporters=jest-junit'
      }
      post {
        always { junit 'reports/*.xml' }
      }
    }

    stage('Package') {
      when { branch 'main' }
      agent { label 'docker' }
      steps {
        withCredentials([usernamePassword(credentialsId: 'ghcr',
                                          usernameVariable: 'U',
                                          passwordVariable: 'P')]) {
          sh 'echo "$P" | docker login ghcr.io -u "$U" --password-stdin'
          sh 'docker build -t "$REGISTRY/$IMAGE:$GIT_COMMIT" .'
          sh 'docker push "$REGISTRY/$IMAGE:$GIT_COMMIT"'
        }
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      agent { label 'deploy' }
      input { message 'Deploy to production?' }
      steps { sh './scripts/deploy.sh "$REGISTRY/$IMAGE:$GIT_COMMIT"' }
    }
  }

  post {
    failure { slackSend channel: '#builds', message: "FAILED: \$JOB_NAME #\$BUILD_NUMBER" }
  }
}
\`\`\`

- **\`agent\`** decides where a stage runs. \`agent none\` at the top forces every stage to declare its own, which stops you from accidentally holding the controller hostage.
- **\`when\`** gates a stage; **\`input\`** pauses for a human.
- **\`post\`** blocks (\`always\`, \`success\`, \`failure\`, \`unstable\`, \`cleanup\`) are where notifications and test publishing live.

**Shared libraries** are Jenkins' reuse mechanism: a separate git repo with \`vars/standardNodePipeline.groovy\`, versioned and loaded by tag.

\`\`\`groovy
@Library('acme-pipelines@v3') _
standardNodePipeline(nodeVersion: '22', deployTo: 'production')
\`\`\`

### Why teams still run Jenkins

Not nostalgia. Jenkins runs **inside your network** with no egress requirement, which matters in banking, defence and healthcare. It has a plugin for every legacy system anyone has ever built, it is not billed per compute-minute, and a 4,000-job installation with a decade of shared libraries does not get migrated on a whim. The trade-offs are real too: plugins are a security surface, the controller is a stateful single point of failure, and Groovy pipelines are hard to test. Treat the controller as cattle — configuration-as-code (JCasC), agents ephemeral, backups verified.`,
    },
    {
      slug: 'cloud-fundamentals-and-terraform',
      title: 'Cloud Fundamentals, the Big Three & Terraform',
      estimatedMinutes: 85,
      body: `# Cloud Fundamentals, the Big Three & Terraform

Every cloud sells the same six primitives under different brand names: **compute, storage, managed databases, networking, identity, and observability**. Learn the primitives and the vendor becomes a lookup table.

## The service mapping

| Capability | AWS | Google Cloud | Azure |
| --- | --- | --- | --- |
| Virtual machines | EC2 | Compute Engine | Virtual Machines |
| Serverless containers | ECS Fargate / App Runner | Cloud Run | Container Apps |
| Managed Kubernetes | EKS | GKE | AKS |
| Functions (FaaS) | Lambda | Cloud Run functions | Azure Functions |
| Managed web app (PaaS) | Elastic Beanstalk | App Engine | App Service |
| Object storage | S3 | Cloud Storage (GCS) | Blob Storage |
| Block storage | EBS | Persistent Disk | Managed Disks |
| Managed relational DB | RDS / Aurora | Cloud SQL / AlloyDB | Azure SQL / DB for PostgreSQL |
| Managed NoSQL | DynamoDB | Firestore / Bigtable | Cosmos DB |
| Managed cache | ElastiCache | Memorystore | Azure Cache for Redis |
| Private network | VPC | VPC | Virtual Network (VNet) |
| Instance firewall | Security group | VPC firewall rules | Network security group |
| Load balancer | ALB / NLB | Cloud Load Balancing | Load Balancer / App Gateway |
| CDN | CloudFront | Cloud CDN | Front Door |
| DNS | Route 53 | Cloud DNS | Azure DNS |
| Container registry | ECR | Artifact Registry | ACR |
| Identity & access | IAM | IAM | Entra ID + Azure RBAC |
| Secrets | Secrets Manager | Secret Manager | Key Vault |
| Queue / pub-sub | SQS / SNS | Pub/Sub | Service Bus / Event Grid |
| Metrics & logs | CloudWatch | Cloud Monitoring & Logging | Azure Monitor |
| Native IaC | CloudFormation | Infrastructure Manager | ARM / Bicep |

## Compute: pick the smallest thing that fits

\`\`\`
Functions      → event-driven, sub-second, spiky, stateless. Pay per invocation.
Serverless     → HTTP services that scale to zero. Cloud Run / Fargate / Container Apps.
containers
Managed K8s    → many services, you already have platform engineers.
VMs            → legacy software, GPUs, kernel-level control, licensing quirks.
\`\`\`

The trap at the top of that list is the **cold start**, and the trap at the bottom is that *you* now patch the OS. Serverless containers are the current sweet spot for a typical web API: you ship the same Docker image you tested, it scales to zero overnight, and there is no cluster to babysit.

## Storage: object storage is not a filesystem

S3/GCS/Blob give you a flat key-value namespace of immutable blobs, eleven nines of durability, and HTTP access. \`user/2026/avatar.png\` looks like a path but is just a key containing slashes.

- Serve user uploads with **pre-signed URLs** so bytes never transit your API.
- Turn on **versioning** plus a **lifecycle rule** that tiers objects to cold storage and eventually deletes them.
- Block public access at the account level; put a CDN in front of anything public.

## Managed databases

You are paying for the operational work, not the engine: automated backups with point-in-time recovery, minor-version patching, failover to a standby in another availability zone, and read replicas. What you *don't* get is exemption from schema design, index discipline or connection-pool math — a Lambda fleet with 500 concurrent executions will happily exhaust a small instance's connection limit, which is why RDS Proxy and PgBouncer exist.

Put databases in **private subnets**. A production database has no legitimate reason to hold a public IP.

## Networking in one diagram

\`\`\`
VPC 10.0.0.0/16  (ap-southeast-2)
├── public subnet  10.0.1.0/24  (az-a)  → route 0.0.0.0/0 to Internet Gateway
│     ALB, NAT gateway, bastion
├── private subnet 10.0.10.0/24 (az-a)  → route 0.0.0.0/0 to NAT gateway
│     app containers
└── private subnet 10.0.20.0/24 (az-b)
      RDS primary + standby
\`\`\`

- **Subnet = a slice of the VPC pinned to one availability zone.** "Public" only means its route table has a path to the internet gateway.
- **Security groups are stateful allow-lists attached to instances.** The idiomatic move is to reference *another security group* as the source: "the database SG allows 5432 from the app SG", never from a CIDR.
- **NACLs are stateless subnet-level filters.** You rarely need them.
- Spread across at least two AZs or you have no story for a zone outage.

## IAM and least privilege

Three rules that prevent most cloud incidents:

1. **No long-lived keys.** Workloads get a role (EC2 instance profile, IRSA on EKS, Workload Identity on GKE, Managed Identity on Azure). CI gets OIDC federation. Humans get SSO with MFA.
2. **Grant the narrowest action on the narrowest resource.** \`s3:GetObject\` on \`arn:aws:s3:::acme-uploads/*\` — not \`s3:*\` on \`*\`. Start from a deny-all and add what breaks.
3. **Separate accounts/projects/subscriptions per environment.** A blast radius that stops at the account boundary is worth more than any policy you can write inside one.

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::acme-uploads/tenant/\${aws:PrincipalTag/tenant}/*"
  }]
}
\`\`\`

## Infrastructure as Code with Terraform

Clicking in a console produces infrastructure nobody can reproduce, review or diff. Terraform describes the desired state; \`plan\` shows the delta; \`apply\` reconciles it.

\`\`\`hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state: shared, locked, versioned. Never commit state to git.
  backend "s3" {
    bucket         = "acme-tfstate"
    key            = "prod/app.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "acme-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

variable "region" {
  type    = string
  default = "ap-southeast-2"
}

variable "environment" {
  type = string
}

resource "aws_s3_bucket" "uploads" {
  bucket = "acme-uploads-\${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}
\`\`\`

\`\`\`bash
terraform init
terraform fmt -check && terraform validate
terraform plan -out=tf.plan       # review this in the PR
terraform apply tf.plan
\`\`\`

Operational rules that keep Terraform pleasant:

- **State is the source of truth and it contains secrets.** Remote backend, encrypted, locked, access-controlled. \`terraform.tfstate\` in git is a resume-generating event.
- **Plan in CI on the PR, apply on merge** from a protected job with an OIDC role.
- **One state file per environment**, never a single global blast radius.
- Use **modules** for the units you repeat, and version them by tag.

Pulumi, CDK and Bicep make different language trade-offs, but the reconcile-to-desired-state model is identical everywhere.`,
    },
  ],
  quiz: [
    {
      prompt: 'Your pipeline rebuilds the Docker image separately for staging and production. Why is that a problem?',
      options: [
        'The artifact deployed to production was never the one that passed the tests, so the test results do not describe what is running',
        'Docker images cannot be built twice from the same Dockerfile',
        'It doubles the registry storage cost, which is the main concern',
        'Production images must always be built on the production host',
      ],
      correctIndex: 0,
      explanation:
        'The "build once, deploy many" rule exists precisely so that the bytes tested are the bytes shipped. Rebuilding re-resolves base images and dependencies and can silently produce a different artifact. Environment differences belong in configuration, not in the build.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In GitHub Actions, what does `fail-fast: false` do inside a `strategy` block?',
      options: [
        'It retries failed matrix jobs automatically',
        'It lets the remaining matrix combinations finish instead of cancelling them when one fails',
        'It marks the workflow as successful even if a job fails',
        'It skips the matrix entirely and runs a single job',
      ],
      correctIndex: 1,
      explanation:
        'By default a failing matrix job cancels its siblings. `fail-fast: false` runs every combination to completion so you can see whether the break is specific to one Node version or OS, rather than only learning about the first failure.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why is OIDC federation preferred over storing an AWS access key pair in GitHub secrets?',
      options: [
        'OIDC tokens are faster to validate',
        'Repository secrets are stored in plaintext and visible to anyone with read access',
        'The runner receives a short-lived token exchanged for temporary credentials, so there is no long-lived key to leak or rotate',
        'OIDC removes the need to define an IAM role at all',
      ],
      correctIndex: 2,
      explanation:
        'With OIDC the workflow requests a signed identity token (`permissions: id-token: write`), and the cloud exchanges it for credentials that expire in minutes. The IAM trust policy pins repo and ref, so the credential cannot be replayed elsewhere. Secrets are encrypted at rest, but a static key that never expires is still the bigger risk.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You need an instant, total rollback for a release that changes a lot of behaviour at once. Which strategy fits best?',
      options: [
        'Rolling update',
        'Recreate',
        'Canary at 1%',
        'Blue-green',
      ],
      correctIndex: 3,
      explanation:
        'Blue-green keeps the previous version fully running, so rollback is a load-balancer flip measured in seconds. Rolling has to unwind instance by instance, recreate implies downtime, and a canary is about *gradual* exposure and measurement rather than instant reversal.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In `.gitlab-ci.yml`, what does `needs:` change about job execution?',
      options: [
        'It makes a job wait for manual approval',
        'It builds a DAG so a job starts as soon as its listed dependencies finish, rather than waiting for the whole previous stage',
        'It declares which artifacts to upload',
        'It pins the runner tag the job must use',
      ],
      correctIndex: 1,
      explanation:
        '`needs:` opts a job out of strict stage ordering and expresses direct dependencies instead, which usually shortens the critical path dramatically. It also implicitly downloads the artifacts of the jobs it needs.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A production database in AWS should live in which subnet, and why?',
      options: [
        'A private subnet, with access controlled by a security group that references the application security group as its source',
        'A public subnet, so the CI runner can reach it to run migrations',
        'A public subnet with a security group allowing 0.0.0.0/0 on 5432',
        'It does not matter — RDS is managed, so AWS secures it',
      ],
      correctIndex: 0,
      explanation:
        'Private subnets have no route to an internet gateway, so the database is unreachable from the internet regardless of any security-group mistake. Referencing the app security group as the source is the idiomatic least-privilege rule; migrations run from inside the VPC or through a bastion/SSM session.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Which Terraform practice is essential when more than one engineer applies changes?',
      options: [
        'Committing terraform.tfstate so everyone has the latest copy',
        'Running terraform apply only from a laptop with admin credentials',
        'Using -auto-approve to avoid merge conflicts in plans',
        'A remote backend with state locking, so two applies cannot run concurrently against the same state',
      ],
      correctIndex: 3,
      explanation:
        'State is shared mutable data and contains secrets. A remote backend (S3 + DynamoDB lock, GCS, Terraform Cloud) makes it shared, encrypted and locked. Committing state to git leaks credentials and guarantees conflicts; -auto-approve removes the review that makes IaC safe.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which pairing of managed services is correct across the three clouds?',
      options: [
        'S3 ↔ Cloud SQL ↔ Blob Storage',
        'Lambda ↔ Compute Engine ↔ Azure Functions',
        'DynamoDB ↔ Firestore ↔ Cosmos DB',
        'EKS ↔ Cloud Run ↔ App Service',
      ],
      correctIndex: 2,
      explanation:
        'DynamoDB, Firestore and Cosmos DB are the managed NoSQL offerings. S3 maps to Cloud Storage and Blob Storage; Lambda maps to Cloud Run functions and Azure Functions; EKS maps to GKE and AKS.',
      difficulty: 'EASY',
    },
  ],
  problems: [
    {
      slug: 'semver-from-conventional-commits',
      title: 'Release Bot: Version Bump from Conventional Commits',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Your release job must decide the next version from the commits since the last tag, using [Conventional Commits](https://www.conventionalcommits.org/).

Implement \`nextVersion(current, commits)\`:

- \`current\` is a semver string like \`"1.4.2"\`. If it does not match \`MAJOR.MINOR.PATCH\` (digits only), **throw**.
- \`commits\` is an array of full commit messages (the header may be followed by a blank line and a body).

Bump rules — the **highest** bump wins:

| Trigger | Bump |
| --- | --- |
| A \`!\` before the colon (\`feat(api)!: ...\`) **or** a \`BREAKING CHANGE:\` line in the body | major → \`2.0.0\` |
| Any \`feat\` commit | minor → \`1.5.0\` |
| Any \`fix\` commit | patch → \`1.4.3\` |
| Anything else (\`chore\`, \`docs\`, \`test\`, unparseable) | no change → \`1.4.2\` |

A major bump zeroes minor and patch; a minor bump zeroes patch.

Header grammar: \`type(optional-scope)!: subject\`. Type matching is case-insensitive; a line that does not match the grammar is ignored.

\`\`\`js
nextVersion('1.4.2', ['fix: off-by-one', 'docs: readme']);        // '1.4.3'
nextVersion('1.4.2', ['feat(api): add cursor paging']);           // '1.5.0'
nextVersion('1.4.2', ['feat!: drop node 18']);                    // '2.0.0'
\`\`\``,
      starterCode: `function nextVersion(current, commits) {
  // 1. parse and validate \`current\`
  // 2. find the highest bump level across \`commits\`
  // 3. return the new version string
}

module.exports = { nextVersion };`,
      solutionCode: `function nextVersion(current, commits) {
  var m = /^(\\d+)\\.(\\d+)\\.(\\d+)$/.exec(String(current).trim());
  if (!m) throw new Error('invalid semver: ' + current);

  var major = Number(m[1]);
  var minor = Number(m[2]);
  var patch = Number(m[3]);

  // 0 = none, 1 = patch, 2 = minor, 3 = major
  var level = 0;
  var list = Array.isArray(commits) ? commits : [];

  for (var i = 0; i < list.length; i += 1) {
    var msg = String(list[i]);
    var header = msg.split('\\n')[0].trim();
    var hm = /^([A-Za-z]+)(\\([^)]*\\))?(!)?:\\s*(.+)$/.exec(header);
    if (!hm) continue;

    var type = hm[1].toLowerCase();
    var bang = Boolean(hm[3]);
    var footer = /(^|\\n)BREAKING[ -]CHANGE:/.test(msg);

    if (bang || footer) {
      level = Math.max(level, 3);
    } else if (type === 'feat') {
      level = Math.max(level, 2);
    } else if (type === 'fix') {
      level = Math.max(level, 1);
    }
  }

  if (level === 3) return (major + 1) + '.0.0';
  if (level === 2) return major + '.' + (minor + 1) + '.0';
  if (level === 1) return major + '.' + minor + '.' + (patch + 1);
  return major + '.' + minor + '.' + patch;
}

module.exports = { nextVersion };`,
      hints: [
        'Score each commit 0-3 and keep the maximum instead of returning early — the last commit can still be the breaking one.',
        'Only the first line of a commit message is the header; the BREAKING CHANGE footer lives in the body.',
        'A `!` before the colon is a breaking change regardless of the type, including `fix!:` and `refactor!:`.',
        'Remember to zero the lower components: a minor bump makes patch 0, a major bump zeroes both.',
      ],
      tests: [
        {
          name: 'fix bumps the patch',
          assertion: "solution.nextVersion('1.4.2', ['fix: off-by-one']) === '1.4.3'",
        },
        {
          name: 'feat outranks fix',
          assertion: "solution.nextVersion('1.4.2', ['fix: typo', 'feat(api): cursor paging']) === '1.5.0'",
        },
        {
          name: 'bang marks a breaking change',
          assertion: "solution.nextVersion('1.4.2', ['feat(api)!: drop v1 routes']) === '2.0.0'",
        },
        {
          name: 'BREAKING CHANGE footer also bumps major',
          assertion:
            "solution.nextVersion('0.9.9', ['refactor: rework client\\n\\nBREAKING CHANGE: removed the legacy adapter']) === '1.0.0'",
        },
        {
          name: 'chore and docs change nothing',
          assertion: "solution.nextVersion('1.4.2', ['chore: bump deps', 'docs: fix readme']) === '1.4.2'",
        },
        {
          name: 'unparseable messages are ignored',
          assertion: "solution.nextVersion('2.0.0', ['wip', 'merged main into feature']) === '2.0.0'",
          hidden: true,
        },
        {
          name: 'type matching is case-insensitive',
          assertion: "solution.nextVersion('1.0.0', ['Feat: shiny thing']) === '1.1.0'",
          hidden: true,
        },
        {
          name: 'empty commit list is a no-op',
          assertion: "solution.nextVersion('3.2.1', []) === '3.2.1'",
          hidden: true,
        },
        {
          name: 'invalid current version throws',
          assertion: "throws(() => solution.nextVersion('1.2', ['fix: x']))",
          hidden: true,
        },
      ],
      xp: 45,
    },
    {
      slug: 'pipeline-dag-scheduler',
      title: 'Pipeline Scheduler: Resolve `needs` into Execution Waves',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Both GitHub Actions (\`needs:\`) and GitLab CI (\`needs:\`) turn a job list into a DAG and run everything that is unblocked in parallel. Build that scheduler.

Implement \`schedule(jobs)\` where \`jobs\` is an array of \`{ name, needs }\`. \`needs\` may be missing (treat as \`[]\`).

Return an **array of waves**. Wave 0 is every job with no dependencies; wave *n* is every job whose dependencies all completed in waves \`0..n-1\`. **Sort each wave alphabetically** so the output is deterministic.

Throw an \`Error\` when the graph is invalid:

- a duplicate job name
- a \`needs\` entry that names no job
- a dependency cycle (including a job that needs itself)

\`\`\`js
schedule([
  { name: 'deploy', needs: ['test', 'scan'] },
  { name: 'test',   needs: ['build'] },
  { name: 'scan',   needs: ['build'] },
  { name: 'build',  needs: [] },
]);
// [['build'], ['scan', 'test'], ['deploy']]
\`\`\`

An empty job list returns \`[]\`.`,
      starterCode: `function schedule(jobs) {
  // Build a name -> needs map, validate it, then peel off
  // one wave of unblocked jobs at a time.
}

module.exports = { schedule };`,
      solutionCode: `function schedule(jobs) {
  var list = Array.isArray(jobs) ? jobs : [];
  var deps = new Map();

  for (var i = 0; i < list.length; i += 1) {
    var job = list[i];
    var name = job && job.name;
    if (!name) throw new Error('every job needs a name');
    if (deps.has(name)) throw new Error('duplicate job: ' + name);
    deps.set(name, Array.isArray(job.needs) ? job.needs.slice() : []);
  }

  deps.forEach(function (needs, name) {
    needs.forEach(function (n) {
      if (!deps.has(n)) throw new Error('unknown dependency: ' + n + ' (needed by ' + name + ')');
    });
  });

  var waves = [];
  var done = new Set();
  var remaining = new Set(deps.keys());

  while (remaining.size > 0) {
    var wave = [];
    remaining.forEach(function (name) {
      var ready = deps.get(name).every(function (d) { return done.has(d); });
      if (ready) wave.push(name);
    });

    if (wave.length === 0) throw new Error('cycle detected among: ' + Array.from(remaining).sort().join(', '));

    wave.sort();
    waves.push(wave);
    wave.forEach(function (name) {
      done.add(name);
      remaining.delete(name);
    });
  }

  return waves;
}

module.exports = { schedule };`,
      hints: [
        'This is Kahn topological sort, but you collect a whole level at a time instead of one node at a time.',
        'Validate that every name in a `needs` array exists before you start scheduling — otherwise an unknown dependency looks identical to a cycle.',
        'If a pass finds zero ready jobs while jobs remain, everything left is blocked by something in the remaining set: that is your cycle.',
        'Sort each wave before pushing it so the result is stable regardless of input order.',
      ],
      tests: [
        {
          name: 'independent jobs share wave 0',
          assertion:
            "deepEqual(solution.schedule([{name:'build',needs:[]},{name:'lint',needs:[]},{name:'test',needs:['build']}]), [['build','lint'],['test']])",
        },
        {
          name: 'diamond graph produces three waves',
          assertion:
            "deepEqual(solution.schedule([{name:'deploy',needs:['test','scan']},{name:'test',needs:['build']},{name:'scan',needs:['build']},{name:'build',needs:[]}]), [['build'],['scan','test'],['deploy']])",
        },
        {
          name: 'missing needs field means no dependencies',
          assertion: "deepEqual(solution.schedule([{name:'a'},{name:'b',needs:['a']}]), [['a'],['b']])",
        },
        {
          name: 'empty pipeline returns an empty array',
          assertion: 'deepEqual(solution.schedule([]), [])',
        },
        {
          name: 'a cycle throws',
          assertion: "throws(() => solution.schedule([{name:'a',needs:['b']},{name:'b',needs:['a']}]))",
        },
        {
          name: 'a self-dependency throws',
          assertion: "throws(() => solution.schedule([{name:'a',needs:['a']}]))",
          hidden: true,
        },
        {
          name: 'an unknown dependency throws',
          assertion: "throws(() => solution.schedule([{name:'a',needs:['ghost']}]))",
          hidden: true,
        },
        {
          name: 'duplicate job names throw',
          assertion: "throws(() => solution.schedule([{name:'a'},{name:'a'}]))",
          hidden: true,
        },
        {
          name: 'a long chain becomes one job per wave',
          assertion:
            "deepEqual(solution.schedule([{name:'d',needs:['c']},{name:'c',needs:['b']},{name:'b',needs:['a']},{name:'a'}]), [['a'],['b'],['c'],['d']])",
          hidden: true,
        },
      ],
      xp: 70,
    },
    {
      slug: 'canary-rollout-controller',
      title: 'Canary Controller with Automatic Rollback',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `A canary is only useful if something automatically watches it. Implement the controller.

\`runCanary(config, windows)\`:

- \`config = { steps, errorThreshold, minRequests }\` — \`steps\` is an ascending list of traffic percentages (e.g. \`[5, 25, 50, 100]\`), \`errorThreshold\` is the maximum tolerated error *rate* (e.g. \`0.05\`), \`minRequests\` is the minimum sample size for a window to count (default \`0\`).
- \`windows\` is an ordered list of observation windows \`{ requests, errors }\` measured against the **canary** at its current step.

Process the windows in order. The canary starts at \`steps[0]\`. For each window:

1. \`errorRate = requests === 0 ? 0 : errors / requests\`, rounded to 4 decimal places.
2. If \`requests < minRequests\` → record \`action: 'hold'\` and stay at the current step.
3. Else if \`errorRate > errorThreshold\` → record \`action: 'rollback'\` and **stop immediately**, returning \`{ status: 'rolled_back', percent: 0, history }\`.
4. Else if already at the last step → record \`action: 'promote'\` and return \`{ status: 'promoted', percent: <last step>, history }\`.
5. Else record \`action: 'advance'\` and move to the next step.

If the windows run out first, return \`{ status: 'in_progress', percent: <current step>, history }\`.

Every history entry is \`{ percent, action, errorRate }\` where \`percent\` is the step the window was **observed at**. An error rate exactly equal to the threshold is acceptable and does not roll back.`,
      starterCode: `function runCanary(config, windows) {
  // Walk the windows, tracking an index into config.steps.
  // Return { status, percent, history }.
}

module.exports = { runCanary };`,
      solutionCode: `function runCanary(config, windows) {
  var steps = (config && Array.isArray(config.steps) && config.steps.length) ? config.steps : [100];
  var threshold = (config && typeof config.errorThreshold === 'number') ? config.errorThreshold : 0;
  var minRequests = (config && typeof config.minRequests === 'number') ? config.minRequests : 0;
  var list = Array.isArray(windows) ? windows : [];

  var index = 0;
  var history = [];

  function round4(n) {
    return Math.round(n * 10000) / 10000;
  }

  for (var i = 0; i < list.length; i += 1) {
    var w = list[i] || {};
    var requests = typeof w.requests === 'number' ? w.requests : 0;
    var errors = typeof w.errors === 'number' ? w.errors : 0;
    var rate = requests === 0 ? 0 : round4(errors / requests);
    var percent = steps[index];

    if (requests < minRequests) {
      history.push({ percent: percent, action: 'hold', errorRate: rate });
      continue;
    }

    if (rate > threshold) {
      history.push({ percent: percent, action: 'rollback', errorRate: rate });
      return { status: 'rolled_back', percent: 0, history: history };
    }

    if (index === steps.length - 1) {
      history.push({ percent: percent, action: 'promote', errorRate: rate });
      return { status: 'promoted', percent: steps[steps.length - 1], history: history };
    }

    history.push({ percent: percent, action: 'advance', errorRate: rate });
    index += 1;
  }

  return { status: 'in_progress', percent: steps[index], history: history };
}

module.exports = { runCanary };`,
      hints: [
        'Track an index into steps rather than the percentage itself — you need to know when you are on the last step.',
        'Record the percentage the window was observed at, then advance. Recording after the increment reports the wrong step.',
        'A hold must not advance the index and must not end the rollout; use continue.',
        'Use a strict greater-than for the threshold check so an error rate exactly equal to the threshold still advances.',
      ],
      tests: [
        {
          name: 'clean windows promote through every step',
          assertion:
            "solution.runCanary({steps:[5,25,50,100],errorThreshold:0.05,minRequests:100},[{requests:1000,errors:10},{requests:1000,errors:10},{requests:1000,errors:10},{requests:1000,errors:10}]).status === 'promoted'",
        },
        {
          name: 'promotion reports 100 percent',
          assertion:
            "solution.runCanary({steps:[5,25,50,100],errorThreshold:0.05,minRequests:100},[{requests:1000,errors:10},{requests:1000,errors:10},{requests:1000,errors:10},{requests:1000,errors:10}]).percent === 100",
        },
        {
          name: 'a bad window rolls back to zero',
          assertion:
            "solution.runCanary({steps:[5,25,50,100],errorThreshold:0.05,minRequests:100},[{requests:1000,errors:10},{requests:1000,errors:200}]).percent === 0",
        },
        {
          name: 'rollback is recorded at the step it was observed at',
          assertion:
            "deepEqual(solution.runCanary({steps:[5,25,50,100],errorThreshold:0.05,minRequests:100},[{requests:1000,errors:10},{requests:1000,errors:200}]).history, [{percent:5,action:'advance',errorRate:0.01},{percent:25,action:'rollback',errorRate:0.2}])",
        },
        {
          name: 'low-traffic windows hold at the current step',
          assertion:
            "solution.runCanary({steps:[5,25,100],errorThreshold:0.05,minRequests:100},[{requests:10,errors:9},{requests:20,errors:0}]).percent === 5",
        },
        {
          name: 'a held rollout is still in progress',
          assertion:
            "solution.runCanary({steps:[5,25,100],errorThreshold:0.05,minRequests:100},[{requests:10,errors:9}]).status === 'in_progress'",
          hidden: true,
        },
        {
          name: 'an error rate exactly at the threshold does not roll back',
          assertion:
            "solution.runCanary({steps:[5,100],errorThreshold:0.05,minRequests:1},[{requests:1000,errors:50},{requests:1000,errors:50}]).status === 'promoted'",
          hidden: true,
        },
        {
          name: 'running out of windows leaves it in progress at the current step',
          assertion:
            "solution.runCanary({steps:[5,25,50,100],errorThreshold:0.05,minRequests:0},[{requests:100,errors:0},{requests:100,errors:0}]).percent === 50",
          hidden: true,
        },
        {
          name: 'error rate is rounded to four decimals',
          assertion:
            "close(solution.runCanary({steps:[5,100],errorThreshold:0.5,minRequests:0},[{requests:3,errors:1}]).history[0].errorRate, 0.3333)",
          hidden: true,
        },
      ],
      xp: 95,
    },
  ],
  flashcards: [
    {
      front: 'What are the five canonical CI/CD pipeline stages?',
      back: 'build → test → scan → package → deploy. Build once, deploy many: the artifact that passed the tests is the artifact that ships.',
      tags: ['cicd', 'pipeline'],
    },
    {
      front: 'Cache vs artifact in a pipeline',
      back: 'A cache is an optional speed-up (dependency downloads) and the build must be correct without it. An artifact is a deliverable later stages or humans consume (dist/, coverage, JUnit XML).',
      tags: ['cicd', 'pipeline'],
    },
    {
      front: 'Continuous delivery vs continuous deployment',
      back: 'Delivery: every green commit is releasable with one click. Deployment: that click is automatic. Delivery is an engineering capability, deployment is a business decision.',
      tags: ['cicd'],
    },
    {
      front: 'GitHub Actions: workflow vs job vs step',
      back: 'A workflow file contains jobs; jobs run in parallel on separate runners; steps run sequentially inside one job and share a filesystem. Pass data between jobs via outputs or artifacts.',
      tags: ['github-actions'],
    },
    {
      front: 'What does `permissions: id-token: write` enable?',
      back: 'It lets the job request a short-lived OIDC token that AWS/GCP/Azure exchange for temporary credentials — no long-lived cloud keys stored in the repo.',
      tags: ['github-actions', 'security'],
    },
    {
      front: 'GitLab CI: what does `needs:` change?',
      back: 'It turns stage-ordered execution into a DAG — a job starts as soon as its listed dependencies finish (and downloads their artifacts) instead of waiting for the whole previous stage.',
      tags: ['gitlab-ci'],
    },
    {
      front: 'Why does `agent none` appear at the top of a Jenkinsfile?',
      back: 'It forces every stage to declare its own agent, so nothing accidentally runs on (and pins) the controller. Stages then use `agent { docker { image ... } }` or a labelled node.',
      tags: ['jenkins'],
    },
    {
      front: 'Blue-green vs canary',
      back: 'Blue-green: two complete environments, flip the load balancer, rollback in seconds, 2x infra. Canary: shift a small percentage of traffic to v2 and watch SLIs, rolling back automatically on regression.',
      tags: ['deployment'],
    },
    {
      front: 'Why does blue-green not solve database migrations?',
      back: 'Both versions are live against one schema during the flip. You need expand/contract: add nullable column → dual-write → backfill → read new → drop old in a later release.',
      tags: ['deployment', 'database'],
    },
    {
      front: 'Security group vs NACL (AWS)',
      back: 'Security group: stateful allow-list attached to an instance/ENI, can reference another security group as source. NACL: stateless allow/deny rules at the subnet level, evaluated in order.',
      tags: ['aws', 'networking'],
    },
    {
      front: 'Why must Terraform state live in a remote backend?',
      back: 'State is shared mutable data containing secrets. A remote backend gives locking (no concurrent applies), encryption, versioning and access control. Committing tfstate to git leaks credentials.',
      tags: ['terraform', 'iac'],
    },
    {
      front: 'Least privilege in one sentence',
      back: 'The narrowest action on the narrowest resource, granted to a workload identity or federated token rather than a long-lived key, with environments split across separate accounts/projects.',
      tags: ['cloud', 'iam', 'security'],
    },
  ],
  resources: [
    {
      label: 'GitHub Actions — Workflow syntax reference',
      url: 'https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions',
      kind: 'DOCS',
    },
    { label: 'GitLab CI/CD — .gitlab-ci.yml keyword reference', url: 'https://docs.gitlab.com/ee/ci/yaml/', kind: 'DOCS' },
    { label: 'Jenkins — Declarative Pipeline syntax', url: 'https://www.jenkins.io/doc/book/pipeline/syntax/', kind: 'DOCS' },
    { label: 'Terraform — AWS provider registry docs', url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs', kind: 'DOCS' },
    {
      label: 'AWS — OpenID Connect federation for GitHub Actions',
      url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html',
      kind: 'ARTICLE',
    },
  ],
};

export default day;
