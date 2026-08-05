import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 28,
  week: 5,
  pillar: 'DEVOPS',
  title: 'Kubernetes Orchestration',
  summary: 'Declare the state you want and let the control plane keep the cluster there.',
  estimatedMinutes: 340,
  objectives: [
    'Explain what orchestration solves that docker compose does not',
    'Name every control-plane and node component and what it reconciles',
    'Write Pod, Deployment, Service and Ingress manifests that actually apply',
    'Inject configuration with ConfigMaps and Secrets without baking it into images',
    'Set resource requests and limits and predict the resulting QoS class',
    'Configure liveness, readiness and startup probes correctly',
    'Perform a rolling update, watch it, and roll it back',
    'Scale with an HPA, run stateful workloads with StatefulSets and PVCs',
    'Debug a broken workload with a repeatable kubectl workflow',
  ],
  technologies: ['Kubernetes'],
  lessons: [
    {
      slug: 'why-orchestration-and-architecture',
      title: 'Why Orchestration, and How a Cluster Is Built',
      estimatedMinutes: 75,
      body: `# Why Orchestration, and How a Cluster Is Built

## The problem compose does not solve

\`docker compose up\` runs your stack on **one machine**. Production asks harder questions:

- A node dies at 3 a.m. Who restarts the containers, and where?
- Traffic triples. Who adds replicas, and who tells the load balancer about them?
- You ship v2 and it panics on boot. Who stops the rollout before it reaches every replica?
- Ten teams share a cluster. Who stops one team's memory leak from evicting another team's pods?

Kubernetes answers all four with one idea: **declarative reconciliation**. You submit the desired state; controllers continuously compare it against observed state and act to close the gap. You never say "start three containers on node 2". You say \`replicas: 3\` and a controller makes it true — now, and after every failure, forever.

## The control plane

| Component | Responsibility |
| --- | --- |
| **kube-apiserver** | The only thing that talks to etcd. Validates, authenticates, admits and serves the REST API. Everything else is a client. |
| **etcd** | Consistent key-value store holding all cluster state. Back this up; it *is* your cluster. |
| **kube-scheduler** | Watches for Pods with no \`nodeName\` and picks a node: filter (does it fit? do the taints/affinities allow it?) then score (least-requested, spread, affinity). |
| **kube-controller-manager** | Runs the built-in control loops: Deployment, ReplicaSet, Node, Job, endpoints, service accounts. |
| **cloud-controller-manager** | Talks to the cloud API for LoadBalancers, routes and node lifecycle. |

## Every node

| Component | Responsibility |
| --- | --- |
| **kubelet** | The node agent. Watches the API server for Pods bound to its node, drives the container runtime, runs probes, reports status. |
| **container runtime** | containerd or CRI-O, via the CRI. Docker Engine was removed as a runtime in v1.24. |
| **kube-proxy** | Programs iptables/IPVS so Service virtual IPs load-balance to healthy Pod IPs. |

The loop that runs everything: *watch desired state → observe actual state → act → repeat*. When you \`kubectl apply\` a Deployment, the deployment controller creates a ReplicaSet, the replicaset controller creates Pods, the scheduler binds each Pod to a node, and that node's kubelet starts the containers. Four independent loops, no central orchestrator script.

## Pods

The Pod — not the container — is the smallest deployable unit. Containers in one Pod share a network namespace (they reach each other on \`localhost\`), share volumes, and are always scheduled together on one node.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: api
  labels:
    app: api
spec:
  containers:
    - name: api
      image: ghcr.io/acme/api:1.4.2
      ports:
        - containerPort: 3000
      env:
        - name: NODE_ENV
          value: production
\`\`\`

Use multiple containers in a Pod only when they are genuinely one unit: a log shipper, a service-mesh proxy, a config reloader. Two services that merely talk to each other belong in two Pods.

**You almost never create a bare Pod.** Nothing recreates it when its node dies. Pods are cattle: mortal, replaceable, and identified by labels rather than names.

## ReplicaSets and Deployments

A **ReplicaSet** keeps N pods matching a selector alive. A **Deployment** manages ReplicaSets to give you versioned, rollable updates.

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
spec:
  replicas: 3
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: ghcr.io/acme/api:1.4.2
          ports:
            - containerPort: 3000
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits:   { cpu: 500m, memory: 256Mi }
\`\`\`

\`spec.selector.matchLabels\` must match \`spec.template.metadata.labels\`, and it is **immutable** after creation — get it wrong and you delete and recreate the Deployment.

Changing anything in \`spec.template\` creates a **new ReplicaSet** and starts a rollout. Changing \`replicas\` only scales the current one. That distinction is why editing an env var restarts your pods and editing the replica count does not.

## Labels and selectors

Labels are how everything in Kubernetes finds everything else — Services find Pods, Deployments own ReplicaSets, network policies match traffic. Use the recommended set:

\`\`\`yaml
labels:
  app.kubernetes.io/name: api
  app.kubernetes.io/instance: api-prod
  app.kubernetes.io/version: "1.4.2"
  app.kubernetes.io/component: backend
  app.kubernetes.io/part-of: storefront
\`\`\`

\`\`\`bash
kubectl get pods -l app=api,environment!=canary
kubectl get pods -L app.kubernetes.io/version
\`\`\`

Annotations carry non-identifying metadata (checksums, ingress config, tool state) and are never used as selectors.

## Namespaces

A namespace is a scope for names plus a boundary for quota and RBAC — not a security perimeter on its own (network policy does that).

\`\`\`bash
kubectl create namespace staging
kubectl config set-context --current --namespace=staging
kubectl get pods -A                    # every namespace
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: staging
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    pods: "50"
\`\`\`

A Service in another namespace is reachable at \`api.staging.svc.cluster.local\` — the DNS name encodes the namespace, which is exactly how you cross the boundary on purpose.`,
    },
    {
      slug: 'services-config-resources-probes',
      title: 'Services, Ingress, Config, Resources and Probes',
      estimatedMinutes: 90,
      body: `# Services, Ingress, Config, Resources and Probes

## Services: a stable address for mortal Pods

Pod IPs change on every restart. A Service gives you a permanent virtual IP and DNS name, and load-balances across whichever Pods currently match its selector.

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  type: ClusterIP
  selector:
    app: api             # matches POD labels, not the Deployment's name
  ports:
    - name: http
      port: 80           # the Service port
      targetPort: 3000   # the container port
\`\`\`

Other Pods reach it at \`http://api\` (same namespace) or \`http://api.production.svc.cluster.local\`.

| Type | What it does | Use it for |
| --- | --- | --- |
| \`ClusterIP\` | internal virtual IP (default) | service-to-service |
| \`NodePort\` | opens the same high port (30000–32767) on every node | bare-metal, dev, behind an external LB |
| \`LoadBalancer\` | asks the cloud for a real load balancer, one per Service | a small number of public entry points |
| \`ExternalName\` | a CNAME to an external host | migrating to/from outside services |
| headless (\`clusterIP: None\`) | no VIP; DNS returns every Pod IP | StatefulSets, client-side balancing |

A Service selects Pods by label; the endpoints controller maintains the list of **ready** Pod IPs. A Pod that fails its readiness probe is removed from that list — that is the mechanism behind zero-downtime deploys.

## Ingress: one L7 entry point

A \`LoadBalancer\` per Service gets expensive fast. An Ingress is HTTP routing (host, path, TLS) in front of many ClusterIP Services, implemented by an ingress controller you install (ingress-nginx, Traefik, HAProxy).

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: storefront
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  tls:
    - hosts: [shop.example.com]
      secretName: shop-tls
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
\`\`\`

> An Ingress with no controller installed applies cleanly and does absolutely nothing. If \`kubectl get ingress\` shows no ADDRESS, that is your problem.

## ConfigMaps and Secrets

Configuration belongs outside the image so one artefact runs in every environment.

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  LOG_LEVEL: info
  FEATURE_CHECKOUT_V2: "true"
  app.properties: |
    cache.ttl=300
    cache.jitter=30
---
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
type: Opaque
stringData:                # plain text in; the API server base64-encodes it
  DATABASE_URL: postgres://app:s3cret@db:5432/app
  SESSION_SECRET: change-me
\`\`\`

\`\`\`yaml
spec:
  containers:
    - name: api
      envFrom:
        - configMapRef: { name: api-config }
        - secretRef: { name: api-secrets }
      env:
        - name: POD_IP
          valueFrom:
            fieldRef: { fieldPath: status.podIP }
      volumeMounts:
        - name: config
          mountPath: /etc/api
          readOnly: true
  volumes:
    - name: config
      configMap:
        name: api-config
        items:
          - key: app.properties
            path: app.properties
\`\`\`

Two things people get wrong:

1. **Secrets are base64, not encrypted.** Anyone with \`get secret\` RBAC reads them. Enable encryption at rest on etcd, restrict RBAC, and prefer an external store (External Secrets Operator, Vault, cloud secret manager).
2. **Env vars do not hot-reload.** Values injected via \`envFrom\` are fixed at container start; editing the ConfigMap changes nothing until the Pod restarts. Mounted files *do* update (after a kubelet sync delay). To force a restart on config change, put a checksum annotation on the Pod template — or run \`kubectl rollout restart deployment/api\`.

## Requests, limits and QoS

**Request** = what the scheduler reserves for you. **Limit** = the ceiling the kubelet enforces.

\`\`\`yaml
resources:
  requests: { cpu: 100m, memory: 128Mi }
  limits:   { cpu: 500m, memory: 256Mi }
\`\`\`

\`100m\` is 0.1 of a CPU core. Memory is in bytes; \`Mi\` = 2^20, \`M\` = 10^6.

The two resources behave completely differently at the limit:

- **CPU is compressible.** Exceeding the CPU limit throttles the process (CFS quota). Slow, not fatal. Aggressive CPU limits on a latency-sensitive service cause p99 spikes for no good reason.
- **Memory is not.** Exceeding the memory limit gets the container **OOMKilled** — exit code 137, then a restart with backoff.

QoS class is derived, not declared, and it decides who is evicted first under node pressure:

| Class | Condition | Evicted |
| --- | --- | --- |
| **Guaranteed** | every container sets requests **=** limits for both cpu and memory | last |
| **Burstable** | at least one request set, but not equal to limits | middle |
| **BestEffort** | no requests or limits at all | first |

Practical advice: always set requests (otherwise the scheduler is blind and you land in BestEffort), always set a memory limit (to contain leaks), and be cautious with CPU limits on latency-critical services.

## Probes

The kubelet runs three probes, and confusing them causes most self-inflicted outages.

| Probe | Question | Failure action |
| --- | --- | --- |
| \`startupProbe\` | has it finished booting? | restart; **disables the other two until it passes** |
| \`livenessProbe\` | is it wedged? | **restart the container** |
| \`readinessProbe\` | can it serve traffic *right now*? | remove from Service endpoints (no restart) |

\`\`\`yaml
startupProbe:
  httpGet: { path: /healthz, port: 3000 }
  periodSeconds: 5
  failureThreshold: 30        # up to 150s to boot
livenessProbe:
  httpGet: { path: /healthz, port: 3000 }
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /readyz, port: 3000 }
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 2
  successThreshold: 1
\`\`\`

The rules that matter:

- **Liveness must not check dependencies.** If \`/healthz\` pings the database, a database blip restarts every pod in the fleet and turns a small incident into an outage. Liveness answers "is *this process* wedged" and nothing more.
- **Readiness is where dependencies belong.** \`/readyz\` can check the database and the cache: the pod is removed from load balancing and comes back on its own when the dependency recovers.
- **Use a startup probe for slow starters** instead of a giant \`initialDelaySeconds\` on liveness, which delays real restart detection forever.
- \`successThreshold\` must be 1 for liveness and startup probes; only readiness may require more.`,
    },
    {
      slug: 'rollouts-scaling-state-rbac-debugging',
      title: 'Rollouts, Autoscaling, StatefulSets, RBAC and Debugging',
      estimatedMinutes: 90,
      body: `# Rollouts, Autoscaling, StatefulSets, RBAC and Debugging

## Rolling updates

\`\`\`yaml
spec:
  replicas: 10
  minReadySeconds: 10
  progressDeadlineSeconds: 600
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%          # extra pods allowed above replicas  -> ceil(2.5) = 3
      maxUnavailable: 25%    # pods allowed below replicas        -> floor(2.5) = 2
\`\`\`

The two knobs define a corridor: total pods never exceed \`replicas + maxSurge\`, available pods never drop below \`replicas - maxUnavailable\`. Percentages round **up** for surge and **down** for unavailable, and both resolving to 0 is rejected. \`maxUnavailable: 0\` gives a strictly zero-downtime rollout that needs spare capacity; \`maxSurge: 0\` works with no spare capacity but runs degraded during the roll.

\`minReadySeconds\` is the underrated one: without it a pod counts as available the instant its readiness probe passes, so a container that crashes two seconds after starting can still let the rollout proceed.

\`\`\`bash
kubectl set image deployment/api api=ghcr.io/acme/api:1.5.0
kubectl rollout status deployment/api --timeout=5m
kubectl rollout history deployment/api
kubectl rollout undo deployment/api                      # previous revision
kubectl rollout undo deployment/api --to-revision=3
kubectl rollout restart deployment/api                   # re-roll with no spec change
\`\`\`

A rollout that stalls past \`progressDeadlineSeconds\` is marked \`Progressing=False\` with reason \`ProgressDeadlineExceeded\` — but Kubernetes does **not** roll it back automatically. Your CD pipeline must run \`kubectl rollout status\` and call \`undo\` on failure.

\`\`\`yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
spec:
  minAvailable: 80%
  selector:
    matchLabels:
      app: api
\`\`\`

A PDB guards *voluntary* disruption: \`kubectl drain\` honours it, rolling updates honour maxUnavailable instead.

## Autoscaling

\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70      # % of the CPU *request*
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
\`\`\`

The algorithm is one line: \`desired = ceil(current * (currentMetric / targetMetric))\`. Ten pods averaging 90% against a 70% target gives \`ceil(10 * 90/70) = 13\`.

Two prerequisites people miss: the **metrics-server must be installed**, and the pods **must declare CPU requests** — utilisation is a percentage of the request, so with no request there is no denominator and the HPA reports \`<unknown>\`.

## StatefulSets and storage

Deployments give you interchangeable pods with random names. Databases need stable identity and stable storage.

\`\`\`yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres          # a headless Service, required
  replicas: 3
  selector:
    matchLabels: { app: postgres }
  template:
    metadata:
      labels: { app: postgres }
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: postgres
          image: postgres:16.2-alpine
          ports:
            - { name: pg, containerPort: 5432 }
          envFrom:
            - secretRef: { name: postgres-secret }
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 20Gi
\`\`\`

What the StatefulSet guarantees:

- **Stable names**: \`postgres-0\`, \`postgres-1\`, \`postgres-2\` — and \`postgres-0.postgres.default.svc.cluster.local\` resolves to that specific pod.
- **Ordered operations**: created 0 → 1 → 2, deleted in reverse, each waiting for the previous to be Ready.
- **Sticky storage**: each replica gets its own PVC from the template, and \`postgres-1\` gets the *same* volume back after a reschedule.

> Deleting a StatefulSet does **not** delete its PVCs. That is deliberate data protection — and a real source of surprise storage bills.

\`\`\`bash
kubectl get pvc,pv
kubectl get storageclass
\`\`\`

Also worth knowing: **DaemonSet** (one pod per node — log agents, CNI), **Job** (run to completion), **CronJob** (scheduled Jobs).

## RBAC

Four objects: Role and RoleBinding (namespaced), ClusterRole and ClusterRoleBinding (cluster-wide).

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: oncall-can-read-pods
  namespace: production
subjects:
  - kind: User
    name: dana@acme.io
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

RBAC is additive and there are no deny rules — permission is the union of every binding. Check before you guess:

\`\`\`bash
kubectl auth can-i delete pods --namespace production
kubectl auth can-i list secrets --as=system:serviceaccount:production:api
\`\`\`

Every pod runs as a ServiceAccount (\`default\` unless you say otherwise). If your app does not call the API, set \`automountServiceAccountToken: false\`.

## Helm and Kustomize

Twelve near-identical manifests per environment is not a plan.

**Kustomize** (built into kubectl) does overlays with no templating:

\`\`\`yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: production
resources:
  - ../../base
images:
  - name: ghcr.io/acme/api
    newTag: 1.5.0
replicas:
  - name: api
    count: 10
patches:
  - path: resources-patch.yaml
    target: { kind: Deployment, name: api }
\`\`\`

\`\`\`bash
kubectl kustomize overlays/production | kubectl apply -f -
kubectl apply -k overlays/production
\`\`\`

**Helm** is a package manager: templated charts, a values file per environment, versioned releases and \`helm rollback\`.

\`\`\`bash
helm install api ./charts/api -f values.production.yaml --namespace production
helm upgrade api ./charts/api --set image.tag=1.5.0 --atomic --timeout 5m
helm history api
helm rollback api 3
\`\`\`

Rule of thumb: Kustomize for your own apps (no templating language to debug), Helm for third-party software and for anything you distribute to other teams.

## The debugging workflow

Work top-down, and read events before you read logs.

\`\`\`bash
kubectl get pods -o wide                       # STATUS, RESTARTS, node
kubectl describe pod api-7d9f-abcde            # Events at the bottom: the answer is usually here
kubectl logs api-7d9f-abcde -c api             # current container
kubectl logs api-7d9f-abcde --previous         # the one that just crashed
kubectl get events --sort-by=.lastTimestamp
kubectl exec -it api-7d9f-abcde -- sh
kubectl debug -it api-7d9f-abcde --image=nicolaka/netshoot --target=api
kubectl port-forward svc/api 3000:80           # bypass Ingress to test the Service
kubectl top pods                               # needs metrics-server
\`\`\`

Read the STATUS column as a diagnosis:

| Status | Meaning | First check |
| --- | --- | --- |
| \`Pending\` | not scheduled | \`describe\`: insufficient cpu/memory, unbound PVC, taints, node selector |
| \`ImagePullBackOff\` | cannot pull | tag typo, private registry needs an \`imagePullSecrets\` |
| \`CrashLoopBackOff\` | starts then exits repeatedly | \`logs --previous\` — it is almost always a config or migration error |
| \`OOMKilled\` (exit 137) | over the memory limit | raise the limit or fix the leak |
| \`CreateContainerConfigError\` | a referenced ConfigMap/Secret key does not exist | \`describe\` names the missing key |
| \`Running\` but 0/1 READY | readiness probe failing | run the probe URL via \`kubectl exec\` |
| \`Terminating\` forever | a finalizer or a stuck preStop hook | \`describe\`, then the owning controller |

One more: if a Service returns connection refused, run \`kubectl get endpointslice -l kubernetes.io/service-name=api\`. An empty list means the selector matches nothing, or every matching pod is unready — a label typo and a failing readiness probe look identical from outside.`,
    },
  ],
  quiz: [
    {
      prompt: 'What does a Deployment give you that a bare ReplicaSet does not?',
      options: [
        'Persistent storage for each replica',
        'Versioned rollouts with rollback, by managing successive ReplicaSets',
        'A stable DNS name for each pod',
        'Automatic horizontal scaling',
      ],
      correctIndex: 1,
      explanation:
        'A ReplicaSet only keeps N pods alive. A Deployment creates a new ReplicaSet whenever the pod template changes and shifts replicas between them, which is what makes rolling updates and `kubectl rollout undo` possible. Stable per-pod identity is StatefulSets; scaling is the HPA.',
      difficulty: 'EASY',
    },
    {
      prompt: 'A container sets `requests: {cpu: 200m, memory: 256Mi}` and `limits: {cpu: 200m, memory: 256Mi}`. What QoS class is the pod?',
      options: ['BestEffort', 'Burstable', 'Guaranteed', 'Preemptible'],
      correctIndex: 2,
      explanation:
        'Guaranteed requires every container in the pod to set both cpu and memory, with requests equal to limits. Guaranteed pods are the last to be evicted under node pressure. No requests or limits at all would be BestEffort — evicted first.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Your liveness probe hits `/healthz`, which queries the database. The database is briefly unavailable. What happens?',
      options: [
        'Pods are removed from the Service endpoints and added back when the database recovers',
        'Nothing — liveness failures are only logged',
        'The HPA scales up to compensate',
        'Every pod is restarted, turning a database blip into an application outage',
      ],
      correctIndex: 3,
      explanation:
        'A failing liveness probe restarts the container. Dependency checks belong in the readiness probe, which only removes the pod from load balancing and recovers by itself. Liveness must answer "is this process wedged" and nothing else.',
      difficulty: 'HARD',
    },
    {
      prompt: 'A Deployment has `replicas: 8`, `maxSurge: 25%`, `maxUnavailable: 25%`. What are the pod-count bounds during the rollout?',
      options: [
        'At most 10 total, at least 6 available',
        'At most 12 total, at least 4 available',
        'At most 8 total, at least 8 available',
        'At most 9 total, at least 7 available',
      ],
      correctIndex: 0,
      explanation:
        'maxSurge rounds up: ceil(8 * 0.25) = 2, so at most 8 + 2 = 10 pods exist. maxUnavailable rounds down: floor(8 * 0.25) = 2, so at least 8 - 2 = 6 pods stay available.',
      difficulty: 'HARD',
    },
    {
      prompt: 'You edit a ConfigMap that a Deployment consumes via `envFrom`. What do the running pods see?',
      options: [
        'The new values within about a minute',
        'Nothing changes until the pods are restarted',
        'The pods are automatically rolled by the ConfigMap controller',
        'The pods crash with a configuration checksum error',
      ],
      correctIndex: 1,
      explanation:
        'Environment variables are materialised once at container start. Only ConfigMaps mounted as volumes are refreshed in place (after a kubelet sync delay). Force the change with `kubectl rollout restart` or a checksum annotation on the pod template.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Your HPA shows TARGETS `<unknown>/70%` and never scales. What is the most likely cause?',
      options: [
        'minReplicas is set too high',
        'The Deployment has no readiness probe',
        'The pods declare no CPU requests (or metrics-server is not installed)',
        'The HPA needs a LoadBalancer Service',
      ],
      correctIndex: 2,
      explanation:
        'CPU utilisation is expressed as a percentage of the CPU *request*, so with no request there is no denominator to compute against. The other classic cause is a missing metrics-server, which is what supplies the metric in the first place.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which statement about StatefulSets is correct?',
      options: [
        'Deleting the StatefulSet also deletes the PersistentVolumeClaims it created',
        'Pods get stable ordinal names and each keeps its own PVC across rescheduling',
        'StatefulSet pods are created in parallel for speed',
        'A StatefulSet does not need a Service',
      ],
      correctIndex: 1,
      explanation:
        'StatefulSets provide stable network identity (`postgres-0`, `postgres-1`), ordered creation and deletion, and sticky per-replica PVCs from volumeClaimTemplates. They require a headless governing Service, and their PVCs deliberately survive deletion of the StatefulSet.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A Service exists and pods are Running, but requests get connection refused. `kubectl get endpointslice` shows no endpoints. What are the two likely causes?',
      options: [
        'The Service type is ClusterIP, or the Ingress is missing',
        'The pods have no resource limits, or the namespace has a quota',
        'The selector does not match the pod labels, or every matching pod is failing readiness',
        'kube-proxy is not installed, or the node is cordoned',
      ],
      correctIndex: 2,
      explanation:
        'Endpoints are built from pods that match the Service selector *and* are Ready. An empty endpoint list means either a label/selector mismatch or that readiness is failing for every pod. Check `kubectl get pods --show-labels` and the READY column.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'readiness-probe-state-machine',
      title: 'Readiness Probe State Machine',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `The kubelet decides whether a pod receives traffic by running the readiness probe on a fixed schedule and counting **consecutive** results. Implement that state machine.

Export \`runProbe(config, samples)\`:

- \`config\` — \`{ initialDelaySeconds = 0, periodSeconds = 10, successThreshold = 1, failureThreshold = 3 }\`.
- \`samples\` — the probe results in order, one per period. Sample \`i\` happens at \`t = initialDelaySeconds + i * periodSeconds\`.

Start **not ready**. For each sample:

- success → increment the consecutive-success count and reset the failure count. If not ready and successes \`>= successThreshold\`, become ready.
- failure → increment the consecutive-failure count and reset the success count. If ready and failures \`>= failureThreshold\`, become not ready.

Return:

\`\`\`js
{
  timeline,          // [{ t, result, ready }] — ready is the state AFTER this sample
  ready,             // final state
  readyAtSeconds,    // t of the first sample that made it ready, else null
  flips,             // how many times the state changed
}
\`\`\`

\`\`\`js
runProbe({ initialDelaySeconds: 5, periodSeconds: 10, successThreshold: 2, failureThreshold: 3 },
         [false, true, true, true, false, false, false, true]);
// readyAtSeconds: 25, ready: false, flips: 2
\`\`\`

> Note the asymmetry a real cluster has: a single failure does not pull a pod out of the load balancer, but \`failureThreshold\` consecutive ones do.`,
      starterCode: `function runProbe(config, samples) {
  const {
    initialDelaySeconds = 0,
    periodSeconds = 10,
    successThreshold = 1,
    failureThreshold = 3,
  } = config || {};

  let ready = false;
  // track consecutive successes and failures

  return { timeline: [], ready, readyAtSeconds: null, flips: 0 };
}

module.exports = { runProbe };`,
      solutionCode: `function runProbe(config, samples) {
  const {
    initialDelaySeconds = 0,
    periodSeconds = 10,
    successThreshold = 1,
    failureThreshold = 3,
  } = config || {};

  let ready = false;
  let consecutiveSuccess = 0;
  let consecutiveFailure = 0;
  let readyAtSeconds = null;
  let flips = 0;

  const timeline = samples.map((result, i) => {
    const t = initialDelaySeconds + i * periodSeconds;

    if (result) {
      consecutiveSuccess++;
      consecutiveFailure = 0;
      if (!ready && consecutiveSuccess >= successThreshold) {
        ready = true;
        flips++;
        if (readyAtSeconds === null) readyAtSeconds = t;
      }
    } else {
      consecutiveFailure++;
      consecutiveSuccess = 0;
      if (ready && consecutiveFailure >= failureThreshold) {
        ready = false;
        flips++;
      }
    }

    return { t, result, ready };
  });

  return { timeline, ready, readyAtSeconds, flips };
}

module.exports = { runProbe };`,
      hints: [
        'The counters are *consecutive*: a success resets the failure count to 0 and vice versa.',
        'Only transition to ready when you are currently not ready — otherwise flips over-counts.',
        'readyAtSeconds is the time of the first transition and never changes afterwards.',
        'The `ready` value in the timeline is the state after processing that sample.',
      ],
      tests: [
        {
          name: 'a single success makes it ready with the default threshold',
          assertion:
            "(() => { const r = solution.runProbe({ periodSeconds: 5 }, [true]); return r.ready === true && r.readyAtSeconds === 0 && r.timeline[0].t === 0; })()",
        },
        {
          name: 'initialDelaySeconds offsets every sample time',
          assertion:
            "(() => { const r = solution.runProbe({ initialDelaySeconds: 30, periodSeconds: 10 }, [true, true]); return deepEqual(r.timeline.map((s) => s.t), [30, 40]) && r.readyAtSeconds === 30; })()",
        },
        {
          name: 'successThreshold requires consecutive successes',
          assertion:
            "(() => { const r = solution.runProbe({ initialDelaySeconds: 5, periodSeconds: 10, successThreshold: 2 }, [false, true, true]); return r.readyAtSeconds === 25 && r.ready === true; })()",
        },
        {
          name: 'a non-consecutive success run does not reach the threshold',
          assertion:
            "(() => { const r = solution.runProbe({ periodSeconds: 10, successThreshold: 3 }, [true, true, false, true, true]); return r.ready === false && r.readyAtSeconds === null && r.flips === 0; })()",
        },
        {
          name: 'one failure does not remove a ready pod',
          assertion:
            "(() => { const r = solution.runProbe({ periodSeconds: 10, failureThreshold: 3 }, [true, false, true]); return r.ready === true && r.flips === 1; })()",
        },
        {
          name: 'failureThreshold consecutive failures flip it back',
          assertion:
            "(() => { const r = solution.runProbe({ initialDelaySeconds: 5, periodSeconds: 10, successThreshold: 2, failureThreshold: 3 }, [false, true, true, true, false, false, false, true]); return r.readyAtSeconds === 25 && r.ready === false && r.flips === 2 && deepEqual(r.timeline.map((s) => s.ready), [false,false,true,true,true,true,false,false]); })()",
          hidden: true,
        },
        {
          name: 'a pod that never passes stays not ready',
          assertion:
            "(() => { const r = solution.runProbe({ initialDelaySeconds: 10, periodSeconds: 5, failureThreshold: 3 }, [false, false, false, false]); return r.ready === false && r.readyAtSeconds === null && r.flips === 0 && r.timeline.length === 4; })()",
          hidden: true,
        },
        {
          name: 'no samples yields an empty timeline',
          assertion:
            "(() => { const r = solution.runProbe({}, []); return deepEqual(r.timeline, []) && r.ready === false && r.readyAtSeconds === null && r.flips === 0; })()",
          hidden: true,
        },
      ],
      xp: 60,
    },
    {
      slug: 'rolling-update-planner',
      title: 'Rolling Update Planner',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Compute the pod counts the Deployment controller walks through during a rolling update.

Export \`planRollout({ replicas, maxSurge, maxUnavailable })\`.

**Resolving the knobs.** Each may be a non-negative integer or a percentage string like \`'25%'\`. \`maxSurge\` rounds **up** (\`Math.ceil\`), \`maxUnavailable\` rounds **down** (\`Math.floor\`). Defaults are \`'25%'\` for both. Throw if \`replicas\` is not an integer >= 1, if a knob is neither a non-negative integer nor a percentage string, or if both resolve to 0 (no progress is possible).

**The corridor.** \`maxTotal = replicas + maxSurge\`, \`minAvailable = replicas - maxUnavailable\`. Assume every existing pod is available.

**Each step**, starting from \`oldReady = replicas\`, \`newReady = 0\`:

1. Scale up: \`add = min(maxTotal - (oldReady + newReady), replicas - newReady)\`, then \`newReady += max(0, add)\`.
2. Scale down: \`remove = min(oldReady, (oldReady + newReady) - minAvailable)\`, then \`oldReady -= max(0, remove)\`.
3. Record \`{ step, oldReady, newReady, total }\` (values **after** the step; \`step\` is 1-based).

Repeat until \`newReady === replicas\` and \`oldReady === 0\`.

Return \`{ maxSurge, maxUnavailable, maxTotal, minAvailable, steps }\` with the two knobs resolved to integers.

\`\`\`js
planRollout({ replicas: 10, maxSurge: 2, maxUnavailable: 2 }).steps;
// [ {step:1, oldReady:6, newReady:2, total:8},
//   {step:2, oldReady:2, newReady:6, total:8},
//   {step:3, oldReady:0, newReady:10, total:10} ]
\`\`\`

Invariants your plan must never break: \`total <= maxTotal\` at every recorded step, and \`total >= minAvailable\` at every recorded step.`,
      starterCode: `function resolveCount(value, replicas, roundUp) {
  // number -> itself; '25%' -> ceil/floor of replicas * 0.25
}

function planRollout({ replicas, maxSurge = '25%', maxUnavailable = '25%' }) {
  // resolve, validate, then loop: scale up, scale down, record
}

module.exports = { planRollout, resolveCount };`,
      solutionCode: `function resolveCount(value, replicas, roundUp) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('maxSurge/maxUnavailable must be a non-negative integer');
    }
    return value;
  }
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const pct = Number(value.trim().slice(0, -1));
    if (!Number.isFinite(pct) || pct < 0) {
      throw new Error('invalid percentage');
    }
    const exact = (replicas * pct) / 100;
    return roundUp ? Math.ceil(exact) : Math.floor(exact);
  }
  throw new Error('maxSurge/maxUnavailable must be a non-negative integer or a percentage string');
}

function planRollout({ replicas, maxSurge = '25%', maxUnavailable = '25%' }) {
  if (!Number.isInteger(replicas) || replicas < 1) {
    throw new Error('replicas must be an integer >= 1');
  }

  const surge = resolveCount(maxSurge, replicas, true);
  const unavailable = resolveCount(maxUnavailable, replicas, false);
  if (surge === 0 && unavailable === 0) {
    throw new Error('maxSurge and maxUnavailable cannot both be 0');
  }

  const maxTotal = replicas + surge;
  const minAvailable = replicas - unavailable;

  let oldReady = replicas;
  let newReady = 0;
  const steps = [];

  while (newReady < replicas || oldReady > 0) {
    const add = Math.min(maxTotal - (oldReady + newReady), replicas - newReady);
    newReady += Math.max(0, add);

    const remove = Math.min(oldReady, oldReady + newReady - minAvailable);
    oldReady -= Math.max(0, remove);

    steps.push({ step: steps.length + 1, oldReady, newReady, total: oldReady + newReady });
    if (steps.length > 1000) throw new Error('rollout did not converge');
  }

  return { maxSurge: surge, maxUnavailable: unavailable, maxTotal, minAvailable, steps };
}

module.exports = { planRollout, resolveCount };`,
      hints: [
        'Surge rounds up, unavailable rounds down — that asymmetry is real Kubernetes behaviour, not a typo.',
        'Clamp both moves with Math.max(0, ...): when maxSurge is 0 the scale-up step legitimately adds nothing.',
        'Record the counts *after* both moves in a step, so each entry is a valid cluster state.',
        'The loop terminates when the new ReplicaSet is at full size and the old one is empty.',
      ],
      tests: [
        {
          name: 'the classic surge-and-drain plan',
          assertion:
            "deepEqual(solution.planRollout({ replicas: 10, maxSurge: 2, maxUnavailable: 2 }).steps, [{step:1,oldReady:6,newReady:2,total:8},{step:2,oldReady:2,newReady:6,total:8},{step:3,oldReady:0,newReady:10,total:10}])",
        },
        {
          name: 'maxUnavailable 0 keeps full capacity at every step',
          assertion:
            "(() => { const p = solution.planRollout({ replicas: 3, maxSurge: 1, maxUnavailable: 0 }); return p.minAvailable === 3 && p.steps.every((s) => s.total >= 3 && s.total <= 4) && p.steps.length === 3 && p.steps[2].newReady === 3; })()",
        },
        {
          name: 'maxSurge 0 never exceeds the replica count',
          assertion:
            "(() => { const p = solution.planRollout({ replicas: 3, maxSurge: 0, maxUnavailable: 1 }); return p.maxTotal === 3 && p.steps.every((s) => s.total <= 3 && s.total >= 2) && p.steps[p.steps.length-1].oldReady === 0 && p.steps[p.steps.length-1].newReady === 3; })()",
        },
        {
          name: 'percentages round up for surge and down for unavailable',
          assertion:
            "(() => { const p = solution.planRollout({ replicas: 10 }); return p.maxSurge === 3 && p.maxUnavailable === 2 && p.maxTotal === 13 && p.minAvailable === 8; })()",
        },
        {
          name: 'the corridor invariants hold for many configurations',
          assertion:
            "(() => { for (const r of [1,2,5,7,10,25]) { for (const s of [0,1,2]) { for (const u of [0,1,2]) { if (s === 0 && u === 0) continue; const p = solution.planRollout({ replicas: r, maxSurge: s, maxUnavailable: Math.min(u, r) }); if (!p.steps.every((x) => x.total <= p.maxTotal && x.total >= p.minAvailable)) return false; const last = p.steps[p.steps.length-1]; if (last.oldReady !== 0 || last.newReady !== r) return false; } } } return true; })()",
        },
        {
          name: 'rejects both knobs resolving to zero',
          assertion:
            "throws(() => solution.planRollout({ replicas: 4, maxSurge: 0, maxUnavailable: 0 })) && throws(() => solution.planRollout({ replicas: 4, maxSurge: '0%', maxUnavailable: '10%' }))",
          hidden: true,
        },
        {
          name: 'rejects invalid replicas and knob types',
          assertion:
            "throws(() => solution.planRollout({ replicas: 0, maxSurge: 1, maxUnavailable: 1 })) && throws(() => solution.planRollout({ replicas: 3, maxSurge: 'two', maxUnavailable: 1 })) && throws(() => solution.planRollout({ replicas: 3, maxSurge: -1, maxUnavailable: 1 }))",
          hidden: true,
        },
        {
          name: 'a single replica with surge rolls in one step',
          assertion:
            "deepEqual(solution.planRollout({ replicas: 1, maxSurge: 1, maxUnavailable: 0 }).steps, [{step:1,oldReady:0,newReady:1,total:1}])",
          hidden: true,
        },
      ],
      xp: 100,
    },
    {
      slug: 'pod-bin-packing-scheduler',
      title: 'Least-Requested Pod Scheduler',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Implement a miniature kube-scheduler: filter nodes that can hold the pod, score the survivors, bind to the winner.

Export \`schedulePods(nodes, pods)\`.

- \`nodes\` — \`{ name, cpu, memory, labels? }\` where \`cpu\` is millicores and \`memory\` is MiB of **allocatable** capacity.
- \`pods\` — \`{ name, cpu, memory, nodeSelector? }\`, scheduled **in the given order** (one at a time, each seeing the placements made before it).

For each pod:

1. **Filter.** A node is feasible when every key in \`nodeSelector\` matches \`node.labels\` exactly, and both \`cpu\` and \`memory\` remaining after placing the pod are \`>= 0\`.
2. **Score.** Least-requested: \`score = ((cpuFreeAfter / node.cpu) + (memFreeAfter / node.memory)) / 2\`.
3. **Bind** to the highest score. On a tie, the node earlier in the \`nodes\` array wins.
4. If nothing is feasible the pod is **Pending**.

Return:

\`\`\`js
{
  assignments,  // { [podName]: nodeName | null }
  pending,      // pod names that could not be placed, in order
  nodes,        // [{ name, cpuUsed, memoryUsed, pods }] in the input node order
}
\`\`\`

\`\`\`js
schedulePods(
  [{ name: 'n1', cpu: 2000, memory: 4096 }, { name: 'n2', cpu: 2000, memory: 4096 }],
  [{ name: 'a', cpu: 500, memory: 512 }, { name: 'b', cpu: 500, memory: 512 }, { name: 'c', cpu: 500, memory: 512 }],
);
// a -> n1, b -> n2 (n1 is now busier), c -> n1 (tie, first node wins)
\`\`\`

Do not mutate the input arrays or objects. A missing \`nodeSelector\` (or an empty one) matches every node.`,
      starterCode: `function schedulePods(nodes, pods) {
  const state = nodes.map((n) => ({
    name: n.name,
    labels: n.labels || {},
    cpu: n.cpu,
    memory: n.memory,
    cpuUsed: 0,
    memoryUsed: 0,
    pods: [],
  }));

  // for each pod: filter -> score -> bind, or push to pending

  return { assignments: {}, pending: [], nodes: [] };
}

module.exports = { schedulePods };`,
      solutionCode: `function schedulePods(nodes, pods) {
  const state = nodes.map((n) => ({
    name: n.name,
    labels: n.labels || {},
    cpu: n.cpu,
    memory: n.memory,
    cpuUsed: 0,
    memoryUsed: 0,
    pods: [],
  }));

  const assignments = {};
  const pending = [];

  for (const pod of pods) {
    const selector = pod.nodeSelector || {};
    let best = null;
    let bestScore = -Infinity;

    for (const node of state) {
      // 1. filter: labels
      if (!Object.keys(selector).every((k) => node.labels[k] === selector[k])) continue;

      // 1. filter: capacity
      const cpuFree = node.cpu - node.cpuUsed - pod.cpu;
      const memFree = node.memory - node.memoryUsed - pod.memory;
      if (cpuFree < 0 || memFree < 0) continue;

      // 2. score: least requested
      const score = (cpuFree / node.cpu + memFree / node.memory) / 2;
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = node;
      }
    }

    if (!best) {
      assignments[pod.name] = null;
      pending.push(pod.name);
      continue;
    }

    // 3. bind
    best.cpuUsed += pod.cpu;
    best.memoryUsed += pod.memory;
    best.pods.push(pod.name);
    assignments[pod.name] = best.name;
  }

  return {
    assignments,
    pending,
    nodes: state.map((n) => ({
      name: n.name,
      cpuUsed: n.cpuUsed,
      memoryUsed: n.memoryUsed,
      pods: n.pods,
    })),
  };
}

module.exports = { schedulePods };`,
      hints: [
        'Copy the nodes into a mutable working state first — the caller must not see their objects change.',
        'Filtering happens before scoring: an infeasible node is never scored, even if its score would be highest.',
        'Free capacity in the score is what remains *after* hypothetically placing the pod.',
        'For a stable tie-break, only replace the best node when the new score is strictly greater (use a small epsilon against float noise).',
      ],
      tests: [
        {
          name: 'spreads pods across equally sized nodes',
          assertion:
            "(() => { const r = solution.schedulePods([{name:'n1',cpu:2000,memory:4096},{name:'n2',cpu:2000,memory:4096}], [{name:'a',cpu:500,memory:512},{name:'b',cpu:500,memory:512},{name:'c',cpu:500,memory:512}]); return r.assignments.a === 'n1' && r.assignments.b === 'n2' && r.assignments.c === 'n1'; })()",
        },
        {
          name: 'tracks used capacity per node',
          assertion:
            "(() => { const r = solution.schedulePods([{name:'n1',cpu:2000,memory:4096}], [{name:'a',cpu:500,memory:512},{name:'b',cpu:250,memory:256}]); return deepEqual(r.nodes, [{name:'n1',cpuUsed:750,memoryUsed:768,pods:['a','b']}]); })()",
        },
        {
          name: 'a pod that does not fit anywhere is pending',
          assertion:
            "(() => { const r = solution.schedulePods([{name:'n1',cpu:1000,memory:1024}], [{name:'big',cpu:2000,memory:512}]); return r.assignments.big === null && deepEqual(r.pending, ['big']) && r.nodes[0].cpuUsed === 0; })()",
        },
        {
          name: 'memory pressure alone can make a node infeasible',
          assertion:
            "(() => { const r = solution.schedulePods([{name:'n1',cpu:8000,memory:512},{name:'n2',cpu:1000,memory:4096}], [{name:'p',cpu:500,memory:1024}]); return r.assignments.p === 'n2'; })()",
        },
        {
          name: 'nodeSelector filters before scoring',
          assertion:
            "(() => { const r = solution.schedulePods([{name:'gpu',cpu:1000,memory:1024,labels:{accelerator:'gpu'}},{name:'cpu',cpu:8000,memory:16384,labels:{accelerator:'none'}}], [{name:'train',cpu:500,memory:512,nodeSelector:{accelerator:'gpu'}}]); return r.assignments.train === 'gpu'; })()",
        },
        {
          name: 'a selector matching no node leaves the pod pending',
          assertion:
            "(() => { const r = solution.schedulePods([{name:'n1',cpu:8000,memory:8192,labels:{zone:'a'}}], [{name:'p',cpu:100,memory:100,nodeSelector:{zone:'b'}}]); return deepEqual(r.pending, ['p']) && r.assignments.p === null; })()",
          hidden: true,
        },
        {
          name: 'fills the cluster and reports only the overflow as pending',
          assertion:
            "(() => { const nodes = [{name:'n1',cpu:1000,memory:1024},{name:'n2',cpu:1000,memory:1024}]; const pods = [1,2,3,4,5].map((i) => ({ name: 'p' + i, cpu: 500, memory: 512 })); const r = solution.schedulePods(nodes, pods); return r.pending.length === 1 && deepEqual(r.pending, ['p5']) && r.nodes.every((n) => n.cpuUsed === 1000 && n.memoryUsed === 1024); })()",
          hidden: true,
        },
        {
          name: 'does not mutate the caller input',
          assertion:
            "(() => { const nodes = [{name:'n1',cpu:1000,memory:1024}]; const pods = [{name:'a',cpu:100,memory:128}]; solution.schedulePods(nodes, pods); return deepEqual(nodes, [{name:'n1',cpu:1000,memory:1024}]) && deepEqual(pods, [{name:'a',cpu:100,memory:128}]); })()",
          hidden: true,
        },
      ],
      xp: 130,
    },
  ],
  flashcards: [
    {
      front: 'What is the core idea Kubernetes is built on?',
      back: 'Declarative reconciliation: you submit desired state to the API server, and independent controllers continuously compare it with observed state and act to close the gap.',
      tags: ['kubernetes', 'architecture'],
    },
    {
      front: 'Two things people get wrong about ConfigMaps and Secrets',
      back: 'Secrets are base64-encoded, not encrypted — anyone with `get secret` RBAC reads them. And values injected via env/envFrom are fixed at container start: only volume-mounted keys refresh, so config changes need `kubectl rollout restart`.',
      tags: ['kubernetes', 'config', 'security'],
    },
    {
      front: 'Deployment vs ReplicaSet vs Pod',
      back: 'A Pod is the scheduling unit. A ReplicaSet keeps N pods matching a selector alive. A Deployment manages successive ReplicaSets to give versioned rolling updates and rollbacks.',
      tags: ['kubernetes', 'workloads'],
    },
    {
      front: 'ClusterIP vs NodePort vs LoadBalancer vs Ingress',
      back: 'ClusterIP: internal virtual IP. NodePort: the same high port on every node. LoadBalancer: one cloud load balancer per Service. Ingress: L7 host/path routing and TLS in front of many ClusterIP Services, needing an installed controller.',
      tags: ['kubernetes', 'networking'],
    },
    {
      front: 'Liveness vs readiness vs startup probe — and the rule that prevents outages',
      back: 'Liveness: is the process wedged — failure restarts the container. Readiness: can it serve now — failure only removes it from Service endpoints. Startup: has it booted — it suspends the other two until it passes. Never check dependencies in liveness: a database blip would restart every replica at once.',
      tags: ['kubernetes', 'probes', 'reliability'],
    },
    {
      front: 'Requests vs limits, QoS classes, and what happens at the ceiling',
      back: 'Requests are what the scheduler reserves; limits are the enforced ceiling. Guaranteed = requests equal limits for cpu and memory on every container; Burstable = some requests; BestEffort = none, evicted first. Exceeding a CPU limit throttles (compressible); exceeding a memory limit gets you OOMKilled with exit 137.',
      tags: ['kubernetes', 'resources'],
    },
    {
      front: 'maxSurge and maxUnavailable rounding',
      back: 'Percentages round up for maxSurge and down for maxUnavailable. Total pods never exceed replicas + maxSurge; available pods never drop below replicas - maxUnavailable. Both cannot be 0.',
      tags: ['kubernetes', 'rollouts'],
    },
    {
      front: 'Does Kubernetes roll back a failed deployment automatically?',
      back: 'No. Past progressDeadlineSeconds it marks the Deployment Progressing=False with ProgressDeadlineExceeded and stops. Your pipeline must run `kubectl rollout status` and call `kubectl rollout undo`.',
      tags: ['kubernetes', 'rollouts'],
    },
    {
      front: 'The HPA formula and its two prerequisites',
      back: 'desired = ceil(currentReplicas * currentMetric / targetMetric). It needs metrics-server installed and CPU requests declared on the pods, because utilisation is a percentage of the request.',
      tags: ['kubernetes', 'autoscaling'],
    },
    {
      front: 'What does a StatefulSet guarantee that a Deployment does not?',
      back: 'Stable ordinal names and per-pod DNS, ordered creation/deletion, and sticky per-replica PVCs from volumeClaimTemplates that survive rescheduling — and survive deleting the StatefulSet itself.',
      tags: ['kubernetes', 'stateful'],
    },
    {
      front: 'CrashLoopBackOff: what is the first command?',
      back: '`kubectl logs <pod> --previous` to read the crashed container’s output, then `kubectl describe pod` for the events. It is almost always a config, secret or migration error rather than a cluster problem.',
      tags: ['kubernetes', 'debugging'],
    },
    {
      front: 'Helm vs Kustomize',
      back: 'Kustomize (built into kubectl) does overlay patches on plain YAML with no templating language. Helm is a package manager with templated charts, values files, release history and rollback. Kustomize for your own apps, Helm for third-party software.',
      tags: ['kubernetes', 'tooling'],
    },
  ],
  resources: [
    { label: 'Kubernetes — Concepts', url: 'https://kubernetes.io/docs/concepts/', kind: 'DOCS' },
    { label: 'Kubernetes — Configure liveness, readiness and startup probes', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/', kind: 'DOCS' },
    { label: 'Kubernetes — Deployments and rolling updates', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/', kind: 'DOCS' },
    { label: 'kubectl quick reference', url: 'https://kubernetes.io/docs/reference/kubectl/quick-reference/', kind: 'DOCS' },
    { label: 'Helm documentation', url: 'https://helm.sh/docs/', kind: 'DOCS' },
  ],
};

export default day;
