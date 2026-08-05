import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 27,
  week: 5,
  pillar: 'DEVOPS',
  title: 'Docker & Containerization',
  summary: 'Package your app so it runs identically on your laptop, in CI and in production.',
  estimatedMinutes: 320,
  objectives: [
    'Explain what a container actually is and how it differs from a virtual machine',
    'Read an image as a stack of layers and order a Dockerfile for maximum cache reuse',
    'Write multi-stage builds that ship a small, non-root runtime image',
    'Choose correctly between ENTRYPOINT and CMD, and between ARG and ENV',
    'Persist data with volumes and connect services over user-defined networks',
    'Run a web + api + postgres + redis stack with docker compose and healthchecks',
    'Debug a container that exits immediately or never becomes healthy',
  ],
  technologies: ['Docker'],
  lessons: [
    {
      slug: 'containers-images-layers',
      title: 'Containers, Images and the Layered Filesystem',
      estimatedMinutes: 70,
      body: `# Containers, Images and the Layered Filesystem

## A container is a process, not a machine

A virtual machine boots a full guest kernel on virtualised hardware. A container is an ordinary Linux process on the **host kernel**, wearing three pieces of kernel machinery:

- **namespaces** — the process gets its own view of PIDs, mounts, network interfaces, hostname, users and IPC. Inside, your app is PID 1 and \`/\` is the image's filesystem.
- **cgroups** — limits and accounts for CPU, memory, PIDs and block I/O.
- **union filesystem** (overlayfs) — stacks read-only image layers under one thin writable layer.

| | Virtual machine | Container |
| --- | --- | --- |
| Kernel | its own guest kernel | shares the host kernel |
| Boot time | tens of seconds | milliseconds |
| Size | GBs | tens of MBs |
| Isolation | hardware-level, strong | kernel-level, weaker |
| Density | tens per host | hundreds per host |

The consequences follow directly from "shares the host kernel". A Linux container cannot run on a Windows kernel — Docker Desktop quietly runs a Linux VM for you. A kernel exploit escapes the container. And an image built for \`linux/arm64\` will not run on \`linux/amd64\` without emulation, which is why \`docker buildx build --platform linux/amd64,linux/arm64\` exists.

## Images are stacks of layers

An image is an ordered list of **read-only layers** plus a JSON config (env, entrypoint, user, working dir). Each layer is a tarball of filesystem changes produced by one Dockerfile instruction.

\`\`\`bash
docker history node:20-alpine
docker image inspect myapp:1.0 --format '{{json .RootFS.Layers}}'
\`\`\`

When you start a container, Docker mounts those layers with overlayfs and adds a thin writable layer on top. Ten containers from the same image share one copy of every read-only layer on disk — that is where the density comes from.

Two rules fall out of the layer model, and they explain most Dockerfile mistakes:

**1. Layers are additive; deleting does not shrink.**

\`\`\`dockerfile
RUN wget https://example.com/big.tar.gz     # layer 1: +200 MB
RUN tar -xzf big.tar.gz && rm big.tar.gz    # layer 2: deletion marker only
\`\`\`

The archive is still in layer 1 and still ships. Do the whole thing in one \`RUN\`:

\`\`\`dockerfile
RUN wget -qO- https://example.com/big.tar.gz | tar -xz -C /opt
\`\`\`

**2. Cache invalidation is positional.** Docker walks the instructions in order and reuses a cached layer while the instruction (and, for \`COPY\`/\`ADD\`, the checksum of the copied files) is unchanged. **The first change busts every layer after it.**

## Ordering for the cache

This is the single highest-value Dockerfile skill. Put the things that rarely change first, and the things that change on every commit last.

\`\`\`dockerfile
# ❌ every source edit reinstalls node_modules — 90 s per build
FROM node:20.11-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
\`\`\`

\`\`\`dockerfile
# ✅ dependencies are cached until package-lock.json changes — 3 s per build
FROM node:20.11-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
RUN npm run build
\`\`\`

Your dependency manifests change weekly; your source changes hourly. Copy them separately.

## .dockerignore

The build context is everything Docker uploads to the daemon before the build starts. \`COPY . .\` without a \`.dockerignore\` sends your \`node_modules\`, your \`.git\` history and your \`.env\` file into the image — slow builds and a real secret leak.

\`\`\`gitignore
node_modules
.git
.env
.env.*
dist
coverage
npm-debug.log
Dockerfile*
docker-compose*.yml
**/*.md
\`\`\`

> A secret copied into a layer and deleted in a later layer is still in the image. \`docker history\` will show it. Rotate the credential; you cannot un-ship it.

## Tags are mutable; digests are not

\`node:20-alpine\` points at a different image today than it did last month. \`latest\` is not "the newest release" — it is just the default tag, and it is frequently stale or missing.

\`\`\`dockerfile
FROM node:20.11.1-alpine3.19                     # good: pinned, reproducible-ish
FROM node@sha256:8f7a1c3...                      # best: immutable digest
\`\`\`

Pin your base images. A build that succeeded yesterday and fails today with no code change is almost always a floating tag that moved.

## Inspecting what you built

\`\`\`bash
docker build -t myapp:1.0 .
docker images myapp                # size
docker history myapp:1.0           # per-layer size and the instruction that made it
docker run --rm -it myapp:1.0 sh   # poke around the filesystem
docker inspect myapp:1.0 | jq '.[0].Config'
\`\`\`

\`docker history\` is the debugging tool for size problems: it tells you exactly which instruction added the 400 MB you did not want.`,
    },
    {
      slug: 'dockerfile-multistage-and-runtime',
      title: 'Dockerfile Instructions, Multi-Stage Builds and Small Images',
      estimatedMinutes: 85,
      body: `# Dockerfile Instructions, Multi-Stage Builds and Small Images

## The instructions that matter

| Instruction | Creates a layer? | Notes |
| --- | --- | --- |
| \`FROM\` | base | starts a stage; may be named with \`AS\` |
| \`RUN\` | yes | executes at **build** time |
| \`COPY\` | yes | prefer over \`ADD\` |
| \`ADD\` | yes | also fetches URLs and auto-extracts tars — usually not what you want |
| \`WORKDIR\` | metadata | creates the dir; always use it instead of \`RUN cd\` |
| \`ENV\` | metadata | present at build **and** run time |
| \`ARG\` | metadata | build time only; not in the final image's env |
| \`EXPOSE\` | metadata | documentation only, publishes nothing |
| \`USER\` | metadata | applies to following \`RUN\` and to the container process |
| \`ENTRYPOINT\` | metadata | the executable |
| \`CMD\` | metadata | default arguments, or the whole command if no entrypoint |
| \`HEALTHCHECK\` | metadata | how the daemon decides the container is healthy |

## ENTRYPOINT vs CMD

The rule: **\`ENTRYPOINT\` is the program, \`CMD\` is its default arguments.** Anything you append to \`docker run\` replaces \`CMD\`, never \`ENTRYPOINT\`.

\`\`\`dockerfile
ENTRYPOINT ["node", "dist/server.js"]
CMD ["--port", "3000"]
\`\`\`

\`\`\`bash
docker run myapp                    # node dist/server.js --port 3000
docker run myapp --port 8080        # node dist/server.js --port 8080
docker run --entrypoint sh myapp    # sh   (override explicitly)
\`\`\`

With only \`CMD\`, the whole command is replaceable — convenient for general-purpose images:

\`\`\`dockerfile
CMD ["node", "dist/server.js"]
# docker run myapp bash   -> bash
\`\`\`

**Always use the exec form (JSON array).** The shell form \`CMD node server.js\` runs \`/bin/sh -c "node server.js"\`, which makes \`sh\` PID 1. \`sh\` does not forward \`SIGTERM\`, so \`docker stop\` waits 10 seconds and then kills your process — no graceful shutdown, no draining connections.

## ARG vs ENV

\`\`\`dockerfile
ARG NODE_VERSION=20.11-alpine
FROM node:\${NODE_VERSION}

ARG BUILD_ID                 # docker build --build-arg BUILD_ID=abc123 .
ENV NODE_ENV=production
RUN echo "built from \${BUILD_ID}" > /app/BUILD
\`\`\`

\`ARG\` exists only during the build and is **not** in the running container's environment — but it *is* visible in \`docker history\`, so it is not a secret. For real secrets use BuildKit mounts:

\`\`\`dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
\`\`\`

\`\`\`bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .
\`\`\`

The file is mounted only for that instruction and never lands in a layer.

> \`ARG\` declared before the first \`FROM\` is global but must be re-declared inside a stage to be used there.

## Multi-stage builds

Build tools do not belong in a production image. Compile in one stage, copy only the artefact into a clean runtime stage.

\`\`\`dockerfile
# syntax=docker/dockerfile:1

# ---------- deps ----------
FROM node:20.11-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM node:20.11-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- runtime ----------
FROM node:20.11-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \\
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--", "node", "dist/server.js"]
\`\`\`

That is roughly 180 MB instead of 1.2 GB, and it contains no compiler, no dev dependencies and no source.

\`docker build --target build .\` stops at a named stage — handy for a CI test stage that never ships.

## How small should you go?

| Base | Size | Trade-off |
| --- | --- | --- |
| \`node:20\` (Debian) | ~1.1 GB | everything works, huge attack surface |
| \`node:20-slim\` | ~200 MB | Debian, no build toolchain — a good default |
| \`node:20-alpine\` | ~130 MB | musl libc: native modules may need rebuilding; DNS and timezone quirks |
| \`gcr.io/distroless/nodejs20\` | ~110 MB | no shell, no package manager — hardest to exploit, hardest to debug |

Distroless has no \`sh\`, so \`docker exec -it ... sh\` fails. Debug it by running the \`:debug\` variant, or with \`docker run --rm -it --pidns=container:<id> nicolaka/netshoot\`.

## Running as non-root

By default the container process is **root** — uid 0 inside is uid 0 on the host, and a container escape or a bind-mounted volume turns that into a real problem.

\`\`\`dockerfile
# Debian-based images: create a user
RUN groupadd --system --gid 1001 app \\
 && useradd --system --uid 1001 --gid app app
USER app
\`\`\`

The \`node\` images already ship a \`node\` user (uid 1000) — just \`USER node\`, and remember \`COPY --chown=node:node\` so the files are readable. Note that a non-root process cannot bind ports below 1024: listen on 3000, not 80.

## Init and signals

PID 1 in Linux does not get default signal handlers and does not reap orphans. If your app is PID 1 and ignores \`SIGTERM\`, \`docker stop\` becomes \`SIGKILL\` after the grace period. Either handle \`SIGTERM\` yourself:

\`\`\`js
const server = app.listen(3000);
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
});
\`\`\`

…or use \`tini\` (as above) / \`docker run --init\`, which inserts a tiny init that forwards signals and reaps zombies.`,
    },
    {
      slug: 'volumes-networks-compose',
      title: 'Volumes, Networks and a Compose Stack',
      estimatedMinutes: 80,
      body: `# Volumes, Networks and a Compose Stack

## Storage: the writable layer is disposable

Anything written inside a container goes to its thin writable layer and dies with \`docker rm\`. For anything you care about, mount storage.

| Kind | Syntax | Use for |
| --- | --- | --- |
| Named volume | \`-v pgdata:/var/lib/postgresql/data\` | databases, uploads — Docker-managed, fast on all platforms |
| Bind mount | \`-v "$PWD/src:/app/src"\` | live-reload during development |
| tmpfs | \`--tmpfs /tmp\` | secrets and scratch that must never touch disk |

\`\`\`bash
docker volume create pgdata
docker run -d --name db -v pgdata:/var/lib/postgresql/data postgres:16.2-alpine
docker volume inspect pgdata
\`\`\`

> Bind-mounting your project over \`/app\` also hides the image's \`/app/node_modules\`. The fix is an **anonymous volume** on that path so it survives the overlay: \`-v "$PWD:/app" -v /app/node_modules\`.

## Networking

Each container gets its own network namespace. On a **user-defined bridge** network, Docker runs an embedded DNS server so containers resolve each other **by service name**.

\`\`\`bash
docker network create appnet
docker run -d --name db --network appnet postgres:16.2-alpine
docker run -d --name api --network appnet -p 3000:3000 myapp:1.0
# inside api:  postgres://user:pass@db:5432/app     <- "db" resolves
\`\`\`

The default \`bridge\` network has no DNS — that is why the manual says to create your own. Compose creates one for you automatically.

\`-p 3000:3000\` is \`host:container\`. \`-p 127.0.0.1:5432:5432\` binds to loopback only, which is what you want for a database you do not intend to expose to the LAN. \`EXPOSE\` in a Dockerfile publishes nothing — it is documentation.

## docker compose: web + api + postgres + redis

\`\`\`yaml
services:
  db:
    image: postgres:16.2-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?set it in .env}
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped

  cache:
    image: redis:7.2-alpine
    command: ["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru", "--save", ""]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://app:\${POSTGRES_PASSWORD}@db:5432/app
      REDIS_URL: redis://cache:6379
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 20s
    restart: unless-stopped

  web:
    image: nginx:1.25-alpine
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "8080:80"
    restart: unless-stopped

volumes:
  pgdata:
\`\`\`

\`\`\`nginx
# nginx.conf
server {
  listen 80;
  location /api/ {
    proxy_pass http://api:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
\`\`\`

Everyday commands:

\`\`\`bash
docker compose up -d --build
docker compose ps                 # STATUS column shows (healthy)
docker compose logs -f api
docker compose exec api sh
docker compose down               # keep volumes
docker compose down -v            # delete volumes too — destroys the database
\`\`\`

## depends_on is not "wait until ready"

Plain \`depends_on: [db]\` only orders **start**, not readiness — your API will happily try to connect to a Postgres that is still initialising. \`condition: service_healthy\` (as above) is the fix, and it requires the dependency to define a \`healthcheck\`. Even then, write a retrying connect in the app: in Kubernetes there is no \`depends_on\` at all.

## A dev override

\`compose.override.yml\` is merged automatically by \`docker compose up\`:

\`\`\`yaml
services:
  api:
    build:
      target: build
    command: ["npm", "run", "dev"]
    environment:
      NODE_ENV: development
    volumes:
      - ./src:/app/src
      - /app/node_modules
    ports:
      - "3000:3000"
      - "9229:9229"
\`\`\`

## Debugging a container that will not start

Work through this in order:

1. \`docker compose ps -a\` — what is the exit code? \`0\` = the process finished (your CMD was not a server). \`1\` = app error. \`125\` = daemon/flag error. \`126\` = not executable. \`127\` = command not found. \`137\` = SIGKILL, almost always the OOM killer. \`139\` = segfault.
2. \`docker compose logs --tail=100 api\` — for a crash loop, this is where the stack trace is.
3. \`docker inspect <id> --format '{{.State.ExitCode}} {{.State.OOMKilled}} {{.State.Error}}'\`.
4. **Bypass the entrypoint** and look around:
   \`docker run --rm -it --entrypoint sh myapp:1.0\` — then run the real command by hand and read the error.
5. \`docker run --rm myapp:1.0 ls -la /app\` — did \`COPY\` actually put the files where you think?
6. Environment: \`docker compose exec api env | sort\`. Missing \`DATABASE_URL\` looks exactly like a network problem.
7. Networking: \`docker compose exec api getent hosts db\` — if the name does not resolve, the services are on different networks.
8. Healthcheck never green: run its command manually — \`docker compose exec api node -e "fetch('http://127.0.0.1:3000/healthz')"\`. A common cause is the server binding \`127.0.0.1\` **inside** the container while the check comes from elsewhere, or listening on the wrong port.
9. \`137\` on build or run: raise the memory limit, or check for an unbounded process.

> If the container exits instantly with code 0 and no logs, your \`CMD\` was a one-shot command, not a long-running process. \`docker run -d nginx\` stays up; \`docker run -d alpine\` does not.`,
    },
  ],
  quiz: [
    {
      prompt: 'What makes a container fundamentally different from a virtual machine?',
      options: [
        'Containers share the host kernel and are isolated by namespaces and cgroups, not by virtualised hardware',
        'Containers cannot access the network',
        'Containers run a stripped-down guest kernel supplied by Docker',
        'Containers are written in Go while VMs are written in C',
      ],
      correctIndex: 0,
      explanation:
        'A container is a host process with its own namespaces (PID, mount, net, user) and cgroup limits, sharing the host kernel. A VM boots its own kernel on virtual hardware — stronger isolation, far more overhead.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A Dockerfile does `RUN wget big.tar.gz` then, in a separate `RUN`, extracts and deletes it. Why is the image still huge?',
      options: [
        'wget stores a copy in /var/cache',
        'The delete needs `--force`',
        'Layers are additive: the file lives in the earlier layer, and a later layer can only add a whiteout marker',
        'Docker compresses layers only when you push',
      ],
      correctIndex: 2,
      explanation:
        'Each instruction produces an immutable layer. Removing a file in a later layer records a deletion, it does not rewrite history. Download, extract and delete must happen inside one RUN.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which Dockerfile ordering maximises build-cache reuse for a Node app?',
      options: [
        'COPY . . then RUN npm ci then RUN npm run build',
        'COPY package.json package-lock.json ./ then RUN npm ci then COPY src ./src',
        'RUN npm ci then COPY . . then COPY package.json ./',
        'COPY . . then COPY package.json ./ then RUN npm ci',
      ],
      correctIndex: 1,
      explanation:
        'Cache invalidation is positional: the first changed instruction busts everything below it. Copying only the manifests before `npm ci` keeps the dependency layer cached until the lockfile itself changes.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Given `ENTRYPOINT ["node","server.js"]` and `CMD ["--port","3000"]`, what does `docker run myapp --port 8080` execute?',
      options: [
        '--port 8080',
        'node server.js --port 3000 --port 8080',
        'node server.js --port 8080',
        'It errors because CMD cannot be overridden',
      ],
      correctIndex: 2,
      explanation:
        'Arguments after the image name replace CMD entirely and are appended to ENTRYPOINT. Overriding the entrypoint itself requires the explicit `--entrypoint` flag.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why is `CMD node server.js` (shell form) a problem in production?',
      options: [
        'It is slower to parse',
        'It runs `/bin/sh -c`, making sh PID 1, which does not forward SIGTERM — so `docker stop` kills the app instead of shutting it down gracefully',
        'Shell form is not supported by BuildKit',
        'It prevents the image from being multi-arch',
      ],
      correctIndex: 1,
      explanation:
        'The shell form wraps the command in `/bin/sh -c`. sh becomes PID 1 and does not propagate signals, so your process never receives SIGTERM and is SIGKILLed after the 10-second grace period. Use the exec (JSON array) form.',
      difficulty: 'HARD',
    },
    {
      prompt: 'You pass a token with `ARG NPM_TOKEN` and use it in a RUN. Is it a secret?',
      options: [
        'Yes — ARG values are stripped from the final image',
        'Yes, as long as you unset it in a later layer',
        'Only if the image is private',
        'No — build args are recorded in the image history and visible via `docker history`',
      ],
      correctIndex: 3,
      explanation:
        'ARG values are not in the container environment but they are recorded in image metadata and readable with `docker history`. Use BuildKit secret mounts (`RUN --mount=type=secret,...`), which never land in a layer.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In compose, what does `depends_on: { db: { condition: service_healthy } }` guarantee that plain `depends_on: [db]` does not?',
      options: [
        'That the API container starts before db',
        'That the db container is passing its declared healthcheck before the API starts',
        'That db and api share a network',
        'That db data is persisted to a volume',
      ],
      correctIndex: 1,
      explanation:
        'Plain depends_on only orders container start. `condition: service_healthy` waits for the dependency’s HEALTHCHECK to report healthy — and therefore requires the dependency to declare one. Your app should still retry its connection.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A container exits with code 137. What is the most likely cause?',
      options: [
        'The command inside the container was not found',
        'The Dockerfile had a syntax error',
        'The process was SIGKILLed — usually by the OOM killer hitting the memory limit',
        'The healthcheck failed three times',
      ],
      correctIndex: 2,
      explanation:
        '137 = 128 + 9 (SIGKILL). In practice that is the cgroup OOM killer or a `docker stop` that timed out. Check `docker inspect --format {{.State.OOMKilled}}` and raise the limit or fix the leak. 127 is command-not-found; 126 is not-executable.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'entrypoint-cmd-resolver',
      title: 'Resolve ENTRYPOINT + CMD Like Docker Does',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Half of all "why did my container run the wrong thing" tickets come from misunderstanding how ENTRYPOINT, CMD and \`docker run\` arguments combine. Implement the rules.

Export \`resolveCommand(image, runArgs)\` where \`image\` is \`{ entrypoint, cmd }\` (either may be missing; each is an **array** for exec form or a **string** for shell form) and \`runArgs\` is the array of arguments appended to \`docker run\` (default \`[]\`). Return the final argv array.

Rules, in order:

1. If \`entrypoint\` is a **string** (shell form) the container runs \`["/bin/sh","-c", entrypoint]\`. CMD and run arguments are ignored entirely.
2. Otherwise pick the arguments: non-empty \`runArgs\` **replace** \`cmd\`; otherwise use \`cmd\`.
3. If \`entrypoint\` is an **array**:
   - no arguments at all → just the entrypoint;
   - arguments are a string (shell-form CMD) → \`[...entrypoint, "/bin/sh", "-c", theString]\`;
   - arguments are an array → \`[...entrypoint, ...args]\`.
4. If there is no entrypoint: a string becomes \`["/bin/sh","-c", theString]\`, an array is used as-is, and nothing at all yields \`[]\`.

\`\`\`js
resolveCommand({ entrypoint: ['node','server.js'], cmd: ['--port','3000'] });
// ['node','server.js','--port','3000']

resolveCommand({ entrypoint: ['node','server.js'], cmd: ['--port','3000'] }, ['--port','8080']);
// ['node','server.js','--port','8080']

resolveCommand({ cmd: ['node','server.js'] }, ['bash']);
// ['bash']

resolveCommand({ entrypoint: 'node server.js', cmd: ['x'] }, ['y']);
// ['/bin/sh','-c','node server.js']
\`\`\`

Never mutate the input arrays.`,
      starterCode: `const SHELL = ['/bin/sh', '-c'];

function resolveCommand(image, runArgs = []) {
  const { entrypoint, cmd } = image || {};
  // your code
}

module.exports = { resolveCommand };`,
      solutionCode: `const SHELL = ['/bin/sh', '-c'];

function resolveCommand(image, runArgs = []) {
  const { entrypoint, cmd } = image || {};

  // Rule 1: shell-form ENTRYPOINT swallows everything else.
  if (typeof entrypoint === 'string') return [...SHELL, entrypoint];

  // Rule 2: run arguments replace CMD when present.
  const override = Array.isArray(runArgs) && runArgs.length > 0;
  const args = override ? runArgs : cmd;

  // Rule 3: exec-form ENTRYPOINT.
  if (Array.isArray(entrypoint)) {
    if (args === undefined || args === null) return [...entrypoint];
    if (typeof args === 'string') return [...entrypoint, ...SHELL, args];
    return [...entrypoint, ...args];
  }

  // Rule 4: no ENTRYPOINT.
  if (args === undefined || args === null) return [];
  if (typeof args === 'string') return [...SHELL, args];
  return [...args];
}

module.exports = { resolveCommand };`,
      hints: [
        'Check the shell-form entrypoint first — it short-circuits every other rule.',
        '`runArgs` only counts as an override when it is a non-empty array.',
        'A shell-form CMD under an exec-form ENTRYPOINT becomes three extra argv entries: /bin/sh, -c, and the string.',
        'Return copies (spread the arrays) so callers cannot mutate the image definition.',
      ],
      tests: [
        {
          name: 'entrypoint plus default cmd',
          assertion:
            "deepEqual(solution.resolveCommand({ entrypoint: ['node','server.js'], cmd: ['--port','3000'] }), ['node','server.js','--port','3000'])",
        },
        {
          name: 'run arguments replace cmd',
          assertion:
            "deepEqual(solution.resolveCommand({ entrypoint: ['node','server.js'], cmd: ['--port','3000'] }, ['--port','8080']), ['node','server.js','--port','8080'])",
        },
        {
          name: 'no entrypoint: run arguments replace the whole command',
          assertion:
            "deepEqual(solution.resolveCommand({ cmd: ['node','server.js'] }, ['bash']), ['bash'])",
        },
        {
          name: 'shell-form cmd with no entrypoint wraps in /bin/sh -c',
          assertion:
            "deepEqual(solution.resolveCommand({ cmd: 'node server.js' }), ['/bin/sh','-c','node server.js'])",
        },
        {
          name: 'shell-form entrypoint ignores cmd and run arguments',
          assertion:
            "deepEqual(solution.resolveCommand({ entrypoint: 'node server.js', cmd: ['ignored'] }, ['also-ignored']), ['/bin/sh','-c','node server.js'])",
        },
        {
          name: 'shell-form cmd under an exec-form entrypoint',
          assertion:
            "deepEqual(solution.resolveCommand({ entrypoint: ['docker-entrypoint.sh'], cmd: 'npm start' }), ['docker-entrypoint.sh','/bin/sh','-c','npm start'])",
          hidden: true,
        },
        {
          name: 'entrypoint alone, and an empty image',
          assertion:
            "deepEqual(solution.resolveCommand({ entrypoint: ['/init'] }), ['/init']) && deepEqual(solution.resolveCommand({}), [])",
          hidden: true,
        },
        {
          name: 'does not mutate the input',
          assertion:
            "(() => { const img = { entrypoint: ['node'], cmd: ['a'] }; solution.resolveCommand(img, ['b']); return deepEqual(img.entrypoint, ['node']) && deepEqual(img.cmd, ['a']); })()",
          hidden: true,
        },
      ],
      xp: 50,
    },
    {
      slug: 'layer-cache-simulator',
      title: 'Build-Cache Simulator',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Prove to yourself why instruction order decides build time. Simulate Docker's positional layer cache.

Export \`simulateBuild(previousKeys, layers)\`:

- \`previousKeys\` — the cache keys produced by the previous build, in order (\`string[]\`).
- \`layers\` — this build's layers, in order: \`{ id, key, costMs }\`. The \`key\` already folds in the instruction text and, for COPY/ADD, a content digest.

Docker reuses cached layers from the top while the key at the same index matches, and **the first mismatch invalidates every layer below it**. Return:

\`\`\`js
{
  cachedCount,   // number of leading layers reused
  rebuiltIds,    // ids of the layers that had to be rebuilt, in order
  buildMs,       // total costMs of the rebuilt layers
  newKeys,       // this build's keys, in order (the next build's previousKeys)
}
\`\`\`

\`\`\`js
const layers = [
  { id: 'base',     key: 'FROM node:20.11-alpine', costMs: 0 },
  { id: 'manifest', key: 'COPY package*.json|h1',  costMs: 20 },
  { id: 'deps',     key: 'RUN npm ci',             costMs: 5000 },
  { id: 'src',      key: 'COPY . .|h2',            costMs: 50 },
];
simulateBuild(['FROM node:20.11-alpine','COPY package*.json|h1','RUN npm ci','COPY . .|OLD'], layers);
// { cachedCount: 3, rebuiltIds: ['src'], buildMs: 50, newKeys: [...] }
\`\`\`

An empty \`previousKeys\` means a cold build: nothing is cached.`,
      starterCode: `function simulateBuild(previousKeys, layers) {
  // Walk from index 0 while previousKeys[i] === layers[i].key.
  // Everything from the first mismatch onward is rebuilt.
}

module.exports = { simulateBuild };`,
      solutionCode: `function simulateBuild(previousKeys, layers) {
  const prev = Array.isArray(previousKeys) ? previousKeys : [];
  let cachedCount = 0;
  while (
    cachedCount < layers.length &&
    cachedCount < prev.length &&
    prev[cachedCount] === layers[cachedCount].key
  ) {
    cachedCount++;
  }

  const rebuilt = layers.slice(cachedCount);

  return {
    cachedCount,
    rebuiltIds: rebuilt.map((l) => l.id),
    buildMs: rebuilt.reduce((sum, l) => sum + l.costMs, 0),
    newKeys: layers.map((l) => l.key),
  };
}

module.exports = { simulateBuild };`,
      hints: [
        'Stop at the first index where the keys differ — do not keep scanning for later matches.',
        'A previous build shorter than this one caps how many layers can possibly be cached.',
        '`layers.slice(cachedCount)` is exactly the rebuilt set.',
        'newKeys is unconditional: it is just every layer key in order.',
      ],
      tests: [
        {
          name: 'cold build rebuilds everything',
          assertion:
            "(() => { const L = [{id:'a',key:'k1',costMs:10},{id:'b',key:'k2',costMs:20}]; const r = solution.simulateBuild([], L); return r.cachedCount === 0 && deepEqual(r.rebuiltIds, ['a','b']) && r.buildMs === 30; })()",
        },
        {
          name: 'identical build is fully cached',
          assertion:
            "(() => { const L = [{id:'a',key:'k1',costMs:10},{id:'b',key:'k2',costMs:20}]; const r = solution.simulateBuild(['k1','k2'], L); return r.cachedCount === 2 && deepEqual(r.rebuiltIds, []) && r.buildMs === 0; })()",
        },
        {
          name: 'first mismatch invalidates everything below it',
          assertion:
            "(() => { const L = [{id:'base',key:'FROM',costMs:0},{id:'manifest',key:'M1',costMs:20},{id:'deps',key:'RUN npm ci',costMs:5000},{id:'src',key:'S2',costMs:50}]; const r = solution.simulateBuild(['FROM','M1','RUN npm ci','S1'], L); return r.cachedCount === 3 && deepEqual(r.rebuiltIds, ['src']) && r.buildMs === 50; })()",
        },
        {
          name: 'a later match after a mismatch does not restore the cache',
          assertion:
            "(() => { const L = [{id:'a',key:'k1',costMs:1},{id:'b',key:'CHANGED',costMs:100},{id:'c',key:'k3',costMs:1000}]; const r = solution.simulateBuild(['k1','k2','k3'], L); return r.cachedCount === 1 && deepEqual(r.rebuiltIds, ['b','c']) && r.buildMs === 1100; })()",
        },
        {
          name: 'bad ordering costs the dependency layer',
          assertion:
            "(() => { const bad = [{id:'base',key:'FROM',costMs:0},{id:'src',key:'COPY.|h2',costMs:50},{id:'deps',key:'RUN npm ci',costMs:5000}]; const r = solution.simulateBuild(['FROM','COPY.|h1','RUN npm ci'], bad); return r.buildMs === 5050 && deepEqual(r.rebuiltIds, ['src','deps']); })()",
        },
        {
          name: 'newKeys feeds the next build',
          assertion:
            "(() => { const L = [{id:'a',key:'k1',costMs:1},{id:'b',key:'k2',costMs:2}]; const first = solution.simulateBuild([], L); const second = solution.simulateBuild(first.newKeys, L); return deepEqual(first.newKeys, ['k1','k2']) && second.cachedCount === 2 && second.buildMs === 0; })()",
          hidden: true,
        },
        {
          name: 'a shorter previous build caps the cache',
          assertion:
            "(() => { const L = [{id:'a',key:'k1',costMs:1},{id:'b',key:'k2',costMs:2},{id:'c',key:'k3',costMs:4}]; const r = solution.simulateBuild(['k1'], L); return r.cachedCount === 1 && r.buildMs === 6; })()",
          hidden: true,
        },
      ],
      xp: 80,
    },
    {
      slug: 'dockerfile-linter',
      title: 'Dockerfile Linter',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Write the linter that would have caught every bad Dockerfile you will review this year.

Export \`lintDockerfile(text)\` returning \`{ line, rule, message }[]\`, sorted by \`line\` ascending, then \`rule\` alphabetically (\`a.rule.localeCompare(b.rule)\`).

**Parsing.** Skip blank lines and comment lines (\`#\` after trimming). Join continuations: a logical instruction continues while the trimmed line ends with a backslash. Report the **first physical line** (1-based) of the logical instruction. Split the joined text on whitespace: token 0 is the keyword (compare uppercased), the rest are arguments.

**Rules**

| rule | Trigger | Reported line |
| --- | --- | --- |
| \`no-latest-tag\` | \`FROM\` whose image reference has no tag, or the tag \`latest\`. Ignore \`--flags\` when finding the reference; a digest (\`@sha256:...\`) is always fine. Only the part after the last \`/\` can contain the tag separator. | the FROM line |
| \`copy-whole-context\` | \`COPY\` or \`ADD\` whose first non-flag argument is \`.\` or \`./\` | that line |
| \`apt-cache-not-cleaned\` | \`RUN\` matching \`/apt-get\\s+install/\` that does not also match \`/rm\\s+-rf\\s+\\/var\\/lib\\/apt\\/lists/\` | that line |
| \`bad-layer-order\` | a broad \`COPY .\` appears **before** a later \`RUN\` that installs dependencies (\`npm ci\`, \`npm install\`, \`yarn install\`, \`pnpm install\`, \`pip install\`, \`go mod download\`) | the **first** broad COPY line |
| \`runs-as-root\` | no \`USER\` instruction anywhere, **or** the last \`USER\` is \`root\`/\`0\` | the last USER line, or the last instruction's line when there is no USER at all |

Emit at most one finding per rule occurrence; \`bad-layer-order\` and \`runs-as-root\` are emitted at most once per file. The \`message\` text is yours — only \`line\` and \`rule\` are tested.

\`\`\`js
lintDockerfile('FROM node:latest\\nCOPY . .\\nRUN npm ci\\nCMD ["node","x.js"]').map((f) => f.rule);
// ['no-latest-tag','bad-layer-order','copy-whole-context','runs-as-root']
\`\`\``,
      starterCode: `function lintDockerfile(text) {
  const physical = String(text).split('\\n');
  const instructions = []; // { line, keyword, args, text }

  // 1. parse (skip blanks/comments, join backslash continuations)
  // 2. apply the rules
  // 3. sort by line, then rule

  return [];
}

module.exports = { lintDockerfile };`,
      solutionCode: `function lintDockerfile(text) {
  const physical = String(text).split('\\n');
  const instructions = [];

  let i = 0;
  while (i < physical.length) {
    const trimmed = physical[i].trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }
    const startLine = i + 1;
    let joined = trimmed;
    while (joined.endsWith('\\\\') && i + 1 < physical.length) {
      joined = joined.slice(0, -1).trim() + ' ';
      i++;
      joined += physical[i].trim();
    }
    const parts = joined.split(/\\s+/);
    instructions.push({
      line: startLine,
      keyword: parts[0].toUpperCase(),
      args: parts.slice(1),
      text: joined,
    });
    i++;
  }

  const findings = [];
  const add = (line, rule, message) => findings.push({ line, rule, message });

  let lastUser = null;
  let firstBroadCopy = null;
  let depInstallAfterBroadCopy = false;

  for (const ins of instructions) {
    if (ins.keyword === 'FROM') {
      const ref = ins.args.filter((a) => !a.startsWith('--'))[0] || '';
      const withoutDigest = ref.split('@')[0];
      const lastSegment = withoutDigest.slice(withoutDigest.lastIndexOf('/') + 1);
      const tag = lastSegment.includes(':') ? lastSegment.split(':')[1] : null;
      if (!ref.includes('@sha256:') && (tag === null || tag === 'latest')) {
        add(ins.line, 'no-latest-tag', 'Pin an explicit image tag or digest instead of latest/untagged.');
      }
    }

    if (ins.keyword === 'COPY' || ins.keyword === 'ADD') {
      const positional = ins.args.filter((a) => !a.startsWith('--'));
      if (positional[0] === '.' || positional[0] === './') {
        add(ins.line, 'copy-whole-context', 'Copying the whole build context: add a .dockerignore and copy narrowly.');
        if (firstBroadCopy === null) firstBroadCopy = ins.line;
      }
    }

    if (ins.keyword === 'RUN') {
      if (/apt-get\\s+install/.test(ins.text) && !/rm\\s+-rf\\s+\\/var\\/lib\\/apt\\/lists/.test(ins.text)) {
        add(ins.line, 'apt-cache-not-cleaned', 'Remove /var/lib/apt/lists in the same RUN layer.');
      }
      if (
        firstBroadCopy !== null &&
        /(npm (ci|install))|(yarn install)|(pnpm install)|(pip install)|(go mod download)/.test(ins.text)
      ) {
        depInstallAfterBroadCopy = true;
      }
    }

    if (ins.keyword === 'USER') lastUser = ins;
  }

  if (firstBroadCopy !== null && depInstallAfterBroadCopy) {
    add(firstBroadCopy, 'bad-layer-order', 'Copy manifests and install dependencies before copying application source.');
  }

  if (lastUser === null) {
    const line = instructions.length ? instructions[instructions.length - 1].line : 1;
    add(line, 'runs-as-root', 'No USER instruction: the container runs as root.');
  } else if (lastUser.args[0] === 'root' || lastUser.args[0] === '0') {
    add(lastUser.line, 'runs-as-root', 'The final USER is root.');
  }

  findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  return findings;
}

module.exports = { lintDockerfile };`,
      hints: [
        'Parse into logical instructions first. Every rule gets much easier once continuations are joined.',
        'For the tag check, only look after the last slash: `registry.io:5000/app` has a port, not a tag.',
        'bad-layer-order needs two passes worth of state: remember the first broad COPY line, then look for a dependency install after it.',
        'When there is no USER at all, report the line of the last instruction in the file.',
        'Sort at the end with `a.line - b.line || a.rule.localeCompare(b.rule)`.',
      ],
      tests: [
        {
          name: 'flags a latest tag',
          assertion:
            "(() => { const f = solution.lintDockerfile('FROM node:latest\\nUSER node\\nCMD [\"sh\"]'); return f.length === 1 && f[0].rule === 'no-latest-tag' && f[0].line === 1; })()",
        },
        {
          name: 'flags an untagged base image but accepts a digest',
          assertion:
            "(() => { const a = solution.lintDockerfile('FROM ubuntu\\nUSER app'); const b = solution.lintDockerfile('FROM node@sha256:abc123\\nUSER app'); return deepEqual(a.map((x) => x.rule), ['no-latest-tag']) && deepEqual(b.map((x) => x.rule), []); })()",
        },
        {
          name: 'a registry port is not a tag',
          assertion:
            "(() => { const f = solution.lintDockerfile('FROM registry.internal:5000/team/app:1.4.2\\nUSER app'); return f.length === 0; })()",
        },
        {
          name: 'flags COPY . and the resulting bad layer order',
          assertion:
            "(() => { const f = solution.lintDockerfile('FROM node:20.11-alpine\\nWORKDIR /app\\nCOPY . .\\nRUN npm ci\\nUSER node'); return deepEqual(f.map((x) => x.rule), ['bad-layer-order','copy-whole-context']) && f.every((x) => x.line === 3); })()",
        },
        {
          name: 'flags an uncleaned apt cache',
          assertion:
            "(() => { const f = solution.lintDockerfile('FROM debian:12\\nRUN apt-get update && apt-get install -y curl\\nUSER app'); return deepEqual(f.map((x) => x.rule), ['apt-cache-not-cleaned']) && f[0].line === 2; })()",
        },
        {
          name: 'joins backslash continuations and accepts a cleaned apt cache',
          assertion:
            "(() => { const f = solution.lintDockerfile('FROM debian:12\\nRUN apt-get update \\\\\\n  && apt-get install -y curl \\\\\\n  && rm -rf /var/lib/apt/lists/*\\nUSER 1000'); return f.length === 0; })()",
        },
        {
          name: 'flags a missing USER at the last instruction line',
          assertion:
            "(() => { const f = solution.lintDockerfile('FROM alpine:3.19\\nRUN echo hi\\nCMD [\"sh\"]'); return deepEqual(f.map((x) => x.rule), ['runs-as-root']) && f[0].line === 3; })()",
          hidden: true,
        },
        {
          name: 'flags a final USER root even when an earlier USER was safe',
          assertion:
            "(() => { const f = solution.lintDockerfile('FROM alpine:3.19\\nUSER node\\nUSER root\\nCMD [\"sh\"]'); return deepEqual(f.map((x) => x.rule), ['runs-as-root']) && f[0].line === 3; })()",
          hidden: true,
        },
        {
          name: 'a clean multi-stage Dockerfile produces no findings',
          assertion:
            "(() => { const src = ['# syntax=docker/dockerfile:1','FROM node:20.11-alpine AS build','WORKDIR /app','COPY package.json package-lock.json ./','RUN npm ci','COPY src ./src','RUN npm run build','','FROM node:20.11-alpine','WORKDIR /app','COPY --from=build /app/dist ./dist','USER node','CMD [\"node\",\"dist/server.js\"]'].join('\\n'); return solution.lintDockerfile(src).length === 0; })()",
          hidden: true,
        },
        {
          name: 'findings are sorted by line then rule',
          assertion:
            "(() => { const src = 'FROM node:latest\\nCOPY . .\\nRUN npm ci\\nRUN apt-get install -y curl\\nCMD [\"node\",\"x.js\"]'; const f = solution.lintDockerfile(src); return deepEqual(f.map((x) => x.rule), ['no-latest-tag','bad-layer-order','copy-whole-context','apt-cache-not-cleaned','runs-as-root']) && deepEqual(f.map((x) => x.line), [1,2,2,4,5]); })()",
          hidden: true,
        },
      ],
      xp: 120,
    },
  ],
  flashcards: [
    {
      front: 'What three kernel features make a container?',
      back: 'Namespaces (isolated PID/mount/net/user views), cgroups (CPU/memory/IO limits), and a union filesystem (overlayfs) stacking read-only image layers under one writable layer.',
      tags: ['docker', 'fundamentals'],
    },
    {
      front: 'Why does deleting a file in a later RUN not shrink the image?',
      back: 'Layers are immutable and additive. A later layer can only record a whiteout marker; the bytes still ship in the earlier layer. Download, use and delete inside a single RUN.',
      tags: ['docker', 'images'],
    },
    {
      front: 'The layer-cache ordering rule',
      back: 'Docker reuses cached layers positionally and the first changed instruction invalidates everything below it. Copy manifests and install dependencies before copying source.',
      tags: ['docker', 'build-cache'],
    },
    {
      front: 'ENTRYPOINT vs CMD',
      back: 'ENTRYPOINT is the executable, CMD supplies default arguments. Arguments passed to `docker run` replace CMD, never ENTRYPOINT; overriding ENTRYPOINT needs `--entrypoint`.',
      tags: ['docker', 'dockerfile'],
    },
    {
      front: 'Why always use the exec (JSON array) form?',
      back: 'The shell form runs `/bin/sh -c`, so sh becomes PID 1 and does not forward SIGTERM. `docker stop` then SIGKILLs your app after the grace period instead of shutting it down gracefully.',
      tags: ['docker', 'signals'],
    },
    {
      front: 'ARG vs ENV',
      back: 'ARG exists only during the build and is not in the container environment — but it is visible in `docker history`, so it is not a secret. ENV is set at build and run time. For secrets use `RUN --mount=type=secret`.',
      tags: ['docker', 'dockerfile', 'security'],
    },
    {
      front: 'What does a multi-stage build buy you?',
      back: 'Compilers, dev dependencies and source stay in the build stage; only the artefact is COPY --from=build into a clean runtime image. Smaller image, smaller attack surface, and `--target` lets CI stop at a test stage.',
      tags: ['docker', 'images'],
    },
    {
      front: 'Named volume vs bind mount vs tmpfs',
      back: 'Named volume: Docker-managed, for databases and uploads. Bind mount: a host path, for live-reload in development. tmpfs: memory only, for secrets and scratch that must never hit disk.',
      tags: ['docker', 'storage'],
    },
    {
      front: 'Why create a user-defined network instead of using the default bridge?',
      back: 'User-defined bridges run Docker’s embedded DNS, so containers resolve each other by service name. The legacy default bridge has no DNS-based service discovery.',
      tags: ['docker', 'networking'],
    },
    {
      front: 'What does EXPOSE actually do?',
      back: 'Nothing at runtime — it is metadata documenting the port. Publishing requires `-p host:container` (or `ports:` in compose); `-P` uses EXPOSE to pick random host ports.',
      tags: ['docker', 'networking'],
    },
    {
      front: 'depends_on vs condition: service_healthy',
      back: 'Plain depends_on only orders container start. `condition: service_healthy` waits for the dependency’s HEALTHCHECK to pass. Your app should still retry, because Kubernetes has no depends_on.',
      tags: ['docker', 'compose'],
    },
    {
      front: 'Container exit codes: 0, 125, 126, 127, 137',
      back: '0 = the process finished normally (your CMD was not a server). 125 = Docker daemon/flag error. 126 = not executable. 127 = command not found. 137 = SIGKILL, usually the OOM killer.',
      tags: ['docker', 'debugging'],
    },
  ],
  resources: [
    { label: 'Docker — Dockerfile reference', url: 'https://docs.docker.com/reference/dockerfile/', kind: 'DOCS' },
    { label: 'Docker — Building best practices', url: 'https://docs.docker.com/build/building/best-practices/', kind: 'DOCS' },
    { label: 'Docker Compose file reference', url: 'https://docs.docker.com/reference/compose-file/', kind: 'SPEC' },
    { label: 'Docker — Multi-stage builds', url: 'https://docs.docker.com/build/building/multi-stage/', kind: 'DOCS' },
    { label: 'GoogleContainerTools — distroless images', url: 'https://github.com/GoogleContainerTools/distroless', kind: 'TOOL' },
  ],
};

export default day;
