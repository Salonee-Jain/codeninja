import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 30,
  week: 5,
  pillar: 'DEVOPS',
  title: 'Capstone — Monitoring, Logging & Ship It',
  summary: 'Instrument it, watch it, alert on it, then ship the whole stack to production.',
  estimatedMinutes: 340,
  objectives: [
    'Distinguish metrics, logs and traces and pick the right one for a question',
    'Instrument a Node service with Prometheus counters, gauges and histograms',
    'Write PromQL using rate(), aggregation and histogram_quantile, and codify it as recording and alerting rules',
    'Build a Grafana RED dashboard with template variables and a working alert rule',
    'Ship structured JSON logs through the Elastic stack with an index lifecycle policy',
    'Define SLIs, SLOs and error budgets, and alert on burn rate instead of raw thresholds',
    'Deploy, observe and operate the full-stack application built across the month',
  ],
  technologies: ['Prometheus', 'Grafana', 'ELK Stack'],
  lessons: [
    {
      slug: 'observability-golden-signals-and-slos',
      title: 'Observability: Three Pillars, Golden Signals, SLOs',
      estimatedMinutes: 70,
      body: `# Observability: Three Pillars, Golden Signals, SLOs

Monitoring answers questions you thought of in advance. **Observability** is the property of a system that lets you answer questions you did *not* think of in advance, from the outside, without shipping new code. You get there with three kinds of telemetry.

## The three pillars

| Signal | Shape | Answers | Cost model |
| --- | --- | --- | --- |
| **Metrics** | numeric time series with labels | "Is it broken? How badly? Since when?" | cheap, bounded by *cardinality* |
| **Logs** | timestamped structured events | "What exactly happened to *this* request?" | expensive, scales with volume |
| **Traces** | causally linked spans across services | "Which of the nine services made it slow?" | expensive, usually sampled |

The workflow is always the same: **a metric tells you something is wrong, a trace tells you where, a log tells you why.** Teams that skip metrics end up grepping terabytes of logs to answer "is the error rate up", which is both slow and expensive.

### Cardinality is the thing that kills metric systems

A time series is uniquely identified by its name *plus every label value*. \`http_requests_total{route="/orders", status="500", region="ap-southeast-2"}\` is one series. Add \`user_id\` as a label and you have created one series per user — millions of them — and your Prometheus falls over.

> Rule: labels must be **bounded and low-cardinality**. Route templates (\`/orders/:id\`), status classes, method, region, version. Never user IDs, order IDs, emails, full URLs or raw error messages. High-cardinality identifiers belong in logs and traces, where they are indexed differently.

## The four golden signals

From Google's SRE book — the minimum set for any user-facing service:

1. **Latency** — how long requests take. Track *distributions*, not averages, and separate successful from failed requests (a fast 500 flatters your p99).
2. **Traffic** — demand on the system: requests/second, messages/second, concurrent sessions.
3. **Errors** — the rate of requests that fail, explicitly (5xx) or implicitly (200 with a wrong body, or too slow to be useful).
4. **Saturation** — how full the system is: queue depth, connection-pool utilisation, memory headroom, disk fill rate. This is your leading indicator; the other three are lagging.

Two mnemonics operationalise this:

- **RED** — *Rate, Errors, Duration* — for **request-driven services**. One dashboard row per service, three panels.
- **USE** — *Utilisation, Saturation, Errors* — for **resources**: CPU, memory, disks, connection pools, thread pools.

Use RED for your API, USE for the machine and the database underneath it. Together they cover almost every "why is it slow" conversation.

## Averages lie

An average latency of 120 ms is compatible with 99% of requests at 50 ms and 1% at 7 seconds. Percentiles are what users experience:

- **p50** — the typical experience.
- **p95 / p99** — the experience of your loudest users and your biggest customers, who make the most requests and therefore hit the tail most often.
- **max** — useful only for spotting timeouts.

And a warning you will otherwise learn the hard way: **you cannot average percentiles.** \`avg(p99_per_instance)\` is not the p99 of the fleet. That is precisely why Prometheus histograms store bucket counts — so quantiles can be computed *after* aggregation.

## SLIs, SLOs and error budgets

- **SLI** — a *measured* number describing user-visible quality. "The proportion of HTTP requests that return non-5xx within 300 ms."
- **SLO** — the target for that SLI over a window. "99.9% over 30 days."
- **SLA** — an SLO with money attached. Always set your SLO tighter than your SLA.

The **error budget** is the leftover: \`100% − 99.9% = 0.1%\`. Over 30 days that is **43 minutes** of full unavailability, or a much longer period of partial degradation.

| SLO | Budget / 30 days |
| --- | --- |
| 99% | 7h 18m |
| 99.9% | 43m 12s |
| 99.95% | 21m 36s |
| 99.99% | 4m 19s |

The budget is a *permission slip*, and this is the part people miss. If you have budget left, ship faster and take more risk — an unspent budget means you are over-investing in reliability at the expense of features. If you have burned it, the team freezes risky launches and spends the sprint on reliability work. That single rule turns "how much reliability?" from an argument into arithmetic.

### Burn rate beats static thresholds

Alerting on "error rate > 1% for 5 minutes" pages you at 3am for a blip that consumed 0.02% of the budget. Instead alert on **burn rate**: how many times faster than sustainable you are consuming the budget.

\`\`\`
burn_rate = observed_error_rate / (1 - SLO)
\`\`\`

At burn rate 1 you exactly exhaust the budget at the end of the window. The standard multi-window setup:

| Burn rate | Window | Budget consumed | Action |
| --- | --- | --- | --- |
| 14.4× | 1h (and 5m) | 2% | **page** — a full outage burns the month in 2 days |
| 6× | 6h (and 30m) | 5% | **page** |
| 3× | 1d (and 2h) | 10% | ticket |
| 1× | 3d (and 6h) | 10% | ticket |

The short second window is the trick: it requires the problem to be happening *right now*, so the alert resolves quickly once you fix it instead of hanging around for the length of the long window.

## What deserves a page

A page is a promise to wake someone up. Reserve it for **symptoms users feel**, not causes.

- Page: the checkout SLO is burning at 14×, the queue is growing without bound, the certificate expires in 24 hours.
- Ticket: one replica of three is unhealthy, disk is 70% full, a cache hit rate dropped.
- Neither: CPU is at 90% while latency is fine. That is a well-utilised machine.

Every alert must be **actionable, urgent and about the user**. If the responder's only move is to acknowledge it, delete the alert — you are training the team to ignore the whole channel, and one day the real one will look exactly like it.`,
    },
    {
      slug: 'prometheus-and-promql',
      title: 'Prometheus: Instrumentation, PromQL & Alerting',
      estimatedMinutes: 85,
      body: `# Prometheus: Instrumentation, PromQL & Alerting

Prometheus is a time-series database that **pulls**. On a fixed interval it scrapes an HTTP endpoint on each target and stores every sample it finds.

## Why pull matters

- A failed scrape *is* a signal (\`up == 0\`). With push, a silent service is indistinguishable from a healthy quiet one.
- Targets need no configuration about where to send data, and no outbound credentials.
- Service discovery (Kubernetes, EC2, Consul, file-based) generates the target list, so autoscaling just works.

Short-lived batch jobs die before a scrape; those push to the **Pushgateway**, and that is the only place it belongs.

\`\`\`yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: prod-ap-southeast-2

rule_files:
  - /etc/prometheus/rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

scrape_configs:
  - job_name: api
    metrics_path: /metrics
    static_configs:
      - targets: ['api:3000']
        labels:
          env: production

  - job_name: node-exporter
    static_configs:
      - targets: ['node-exporter:9100']
\`\`\`

An **exporter** translates something else's stats into the Prometheus text format: \`node_exporter\` (host CPU/memory/disk), \`postgres_exporter\`, \`redis_exporter\`, \`blackbox_exporter\` (probes URLs from outside). For your own code you use a client library.

## The four metric types

| Type | Meaning | Never do this |
| --- | --- | --- |
| **Counter** | monotonically increasing total; resets to 0 on restart | never decrement; never graph it raw — always \`rate()\` |
| **Gauge** | a value that goes up and down (queue depth, temperature, in-flight requests) | don't use \`rate()\` on it |
| **Histogram** | cumulative bucket counts + \`_sum\` + \`_count\`; quantiles computed at query time | don't guess buckets — they must bracket your SLO |
| **Summary** | client-computed quantiles + \`_sum\` + \`_count\` | **cannot be aggregated across instances** |

Histogram vs summary is the decision people get wrong. A summary's \`0.99\` quantile is computed *inside one process*, so summing or averaging it across ten replicas is mathematically meaningless. A histogram ships raw bucket counters, which *are* additive — so you can aggregate first and compute the quantile after. Use histograms unless you have a single instance and need exact quantiles.

## Instrumenting an Express API

\`\`\`js
import express from 'express';
import client from 'prom-client';

const app = express();
const register = new client.Registry();
register.setDefaultLabels({ service: 'api' });
client.collectDefaultMetrics({ register }); // process CPU, memory, event-loop lag

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  // Buckets must bracket the SLO threshold (0.3s) so the quantile is accurate there.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 1, 2.5, 5],
  registers: [register],
});

const queueDepth = new client.Gauge({
  name: 'job_queue_depth',
  help: 'Jobs waiting to be processed',
  registers: [register],
});

app.use((req, res, next) => {
  const stop = httpDuration.startTimer();
  res.on('finish', () => {
    // Use the ROUTE PATTERN, never req.originalUrl — that would be unbounded cardinality.
    const route = (req.route && req.route.path) || 'unmatched';
    const labels = { method: req.method, route, status: String(res.statusCode) };
    stop(labels);
    httpRequests.inc(labels);
  });
  next();
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
\`\`\`

Naming convention: **base units** — seconds, not milliseconds; bytes, not megabytes — and counters end in \`_total\`. A histogram named \`http_request_duration_seconds\` exposes three families: \`_bucket{le="..."}\` (cumulative), \`_sum\` and \`_count\`.

## PromQL

An **instant vector** is one sample per series at a moment; a **range vector** (\`[5m]\`) is all samples in a window. Functions like \`rate()\` turn a range vector back into an instant vector.

\`\`\`promql
# Traffic: requests/sec per route over the last 5 minutes.
sum by (route) (rate(http_requests_total[5m]))

# Errors: the 5xx ratio for the whole service.
sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
sum(rate(http_requests_total[5m]))

# Duration: p95 latency per route, aggregated across ALL replicas.
histogram_quantile(
  0.95,
  sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))
)

# Saturation: memory headroom.
1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)

# Availability: is anything not being scraped?
up{job="api"} == 0
\`\`\`

Four rules that cover most PromQL mistakes:

1. **\`rate()\` only on counters.** It computes per-second increase and transparently corrects for resets (a drop is read as a restart, not a negative rate).
2. **The range must cover at least 4 scrape intervals.** With a 15s scrape, \`[1m]\` is the floor; \`[5m]\` is the safe default. Too short and a single missed scrape yields no data.
3. **\`rate()\` before \`sum()\`, always.** \`sum(rate(x[5m]))\` is correct; \`rate(sum(x)[5m])\` hides resets and is usually a syntax error anyway.
4. **Keep \`le\` when aggregating buckets.** \`sum by (le, route)\` — drop \`le\` and \`histogram_quantile\` has nothing to interpolate over.

### How histogram_quantile actually works

Buckets are cumulative counts of observations \`<= le\`. To get q, the function finds the bucket where the cumulative count crosses \`q × total\`, then **linearly interpolates** inside it. Two consequences: the answer is never more precise than your bucket boundaries, and if the value falls in the \`+Inf\` bucket you get back the largest finite \`le\`. If your SLO is 300 ms, you need a bucket boundary at 0.3 — otherwise your "p95 = 0.5s" is just the nearest bucket edge, not a measurement. You will implement this algorithm yourself in today's second problem.

## Recording rules and alerts

Recording rules pre-compute expensive expressions on a schedule so dashboards stay fast and alert definitions stay readable.

\`\`\`yaml
# /etc/prometheus/rules/api.yml
groups:
  - name: api-red
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))

      - record: job:http_errors:ratio5m
        expr: |
          sum by (job) (rate(http_requests_total{status=~"5.."}[5m]))
            /
          sum by (job) (rate(http_requests_total[5m]))

  - name: api-alerts
    rules:
      - alert: HighErrorBudgetBurn
        expr: job:http_errors:ratio5m{job="api"} > 14.4 * 0.001
        for: 5m
        labels:
          severity: page
        annotations:
          summary: 'API burning error budget 14x faster than sustainable'
          description: 'Error ratio is {{ $value | humanizePercentage }} for {{ $labels.job }}.'
          runbook_url: 'https://runbooks.example.com/api/high-error-rate'

      - alert: ApiDown
        expr: up{job="api"} == 0
        for: 2m
        labels:
          severity: page
        annotations:
          summary: 'Prometheus cannot scrape {{ $labels.instance }}'
\`\`\`

The recording-rule naming convention is \`level:metric:operation\` — the aggregation level, the metric, and what was done to it.

\`for: 5m\` means the expression must stay true for five continuous minutes before the alert fires — this is your entire defence against flapping. The alert sits in state \`pending\` until then.

**Alertmanager** takes fired alerts and handles routing, grouping, inhibition and silencing:

\`\`\`yaml
route:
  receiver: slack-default
  group_by: ['alertname', 'service']
  group_wait: 30s        # wait for siblings before the first notification
  group_interval: 5m     # then batch new members of the same group
  repeat_interval: 4h
  routes:
    - matchers: [severity="page"]
      receiver: pagerduty

inhibit_rules:
  - source_matchers: [alertname="ApiDown"]
    target_matchers: [severity="warning"]
    equal: ['service']   # if the API is down, don't also page about its latency

receivers:
  - name: slack-default
    slack_configs:
      - api_url_file: /etc/alertmanager/slack_url
        channel: '#alerts'
  - name: pagerduty
    pagerduty_configs:
      - service_key_file: /etc/alertmanager/pd_key
\`\`\`

Grouping stops 200 restarting pods producing 200 notifications; inhibition stops one root cause paging four teams.`,
    },
    {
      slug: 'grafana-dashboards-and-alerting',
      title: 'Grafana: Dashboards, Variables & Alerts',
      estimatedMinutes: 60,
      body: `# Grafana: Dashboards, Variables & Alerts

Prometheus stores and evaluates; Grafana is where humans look. It is a query-and-visualise layer over many data sources — Prometheus, Elasticsearch, Loki, PostgreSQL, CloudWatch — in one pane of glass.

## Provision it, don't click it

A dashboard that exists only in someone's browser is lost the first time the container restarts. Provision data sources and dashboards from files, checked into git next to the service.

\`\`\`yaml
# /etc/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy          # Grafana's backend queries Prometheus, not the browser
    url: http://prometheus:9090
    isDefault: true
    jsonData:
      timeInterval: 15s    # tell Grafana your scrape interval
\`\`\`

\`\`\`yaml
# /etc/grafana/provisioning/dashboards/all.yml
apiVersion: 1
providers:
  - name: services
    folder: Services
    type: file
    disableDeletion: false
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
\`\`\`

Drop the exported dashboard JSON into that path and it appears on boot, identically, in every environment. \`allowUiUpdates: false\` makes the file authoritative — people edit, then export and commit.

> \`access: proxy\` matters for more than tidiness. In \`browser\` mode every viewer's laptop must be able to reach Prometheus directly, which means exposing it. Keep Prometheus on the private network.

## The RED dashboard

One row per service, three panels, in this order — it is the layout an on-call engineer can read at 3am without thinking.

\`\`\`promql
# Panel 1 — Rate (req/s by route), stacked time series
sum by (route) (rate(http_requests_total{job=~"$service"}[$__rate_interval]))

# Panel 2 — Errors (%), time series with a red threshold at 1
100 * sum(rate(http_requests_total{job=~"$service", status=~"5.."}[$__rate_interval]))
    / sum(rate(http_requests_total{job=~"$service"}[$__rate_interval]))

# Panel 3 — Duration (p50/p95/p99), three queries on one panel
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job=~"$service"}[$__rate_interval])))
\`\`\`

\`$__rate_interval\` is a Grafana built-in that expands to a window guaranteed to contain at least four scrape intervals *at the current zoom level*. Hard-coding \`[5m]\` makes the panel go blank when someone zooms into a 5-minute window. Always use \`$__rate_interval\` inside \`rate()\` in Grafana.

## Template variables

Variables turn one dashboard into N. Define them once, reference them as \`$name\`.

\`\`\`json
"templating": {
  "list": [
    {
      "name": "service",
      "label": "Service",
      "type": "query",
      "datasource": "Prometheus",
      "query": "label_values(http_requests_total, job)",
      "refresh": 2,
      "includeAll": true,
      "multi": true
    },
    {
      "name": "route",
      "type": "query",
      "datasource": "Prometheus",
      "query": "label_values(http_requests_total{job=~\\"$service\\"}, route)",
      "refresh": 2,
      "includeAll": true,
      "multi": true
    }
  ]
}
\`\`\`

- \`refresh: 2\` re-runs the query on every time-range change, so a newly deployed service shows up without an edit.
- With \`multi: true\`, the value interpolates as a regex alternation, which is why the query side must use \`=~\` and not \`=\`.
- **Repeat** a row or panel by a variable to generate one copy per service automatically.

## Panels: pick the right one

| Panel | Use for |
| --- | --- |
| Time series | anything that changes over time — the default, and usually correct |
| Stat | one big number: current error rate, uptime, budget remaining |
| Gauge | a value against a known maximum (disk %, budget consumed) |
| Bar gauge | ranked comparison: slowest endpoints, noisiest tenants |
| Heatmap | a latency histogram over time — feed it \`_bucket\` series with the *Heatmap* format |
| Table | top-N with a link into logs or traces |

Set **units** on every panel (seconds, requests/sec, percent 0–100 vs 0–1). An unlabelled axis is how people confuse a ratio of 0.02 with 2%.

## Alerting in Grafana

Grafana's unified alerting builds a rule from a small pipeline:

1. **Query (A)** — a PromQL range query, e.g. the error-ratio expression above.
2. **Reduce (B)** — collapse the series to one number per series: \`last()\`, \`mean()\`, \`max()\`.
3. **Threshold (C)** — \`IS ABOVE 0.01\`. C is the alert condition.
4. **Evaluation** — an evaluation group with an interval (e.g. 1m) and a **pending period** (e.g. 5m), which is Grafana's \`for:\`.
5. **Labels → notification policy → contact point.** Labels on the rule are matched by the notification policy tree to route to Slack, PagerDuty or email; that indirection is what lets you change routing without touching rules.

Also configure **No Data** and **Error** behaviour explicitly. The default (\`Alerting\`) is right for a service that should always have traffic and wrong for a nightly batch job that legitimately reports nothing at 2pm.

### Prometheus rules or Grafana rules?

Both work. Alerts that are part of the service contract — the SLO burn rate, \`up == 0\` — belong in Prometheus rule files, versioned with the service and evaluated even if Grafana is down. Exploratory or business alerts, and anything spanning several data sources (a Prometheus metric *and* an Elasticsearch query), are easier in Grafana. Do not define the same alert in both; you will page twice and silence once.

## Dashboard hygiene

- **Five panels above the fold, maximum.** A 40-panel wall is where signals go to hide.
- **Annotate deploys.** A vertical line at each release turns "when did this start?" into a glance. Your CD job can POST to the Grafana annotations API.
- **Link the dashboard to the runbook** in the panel description, and link every alert to the same runbook.
- **Delete dead dashboards.** Every stale panel is a chance to misdiagnose an incident.`,
    },
    {
      slug: 'structured-logging-elk-and-incident-response',
      title: 'Structured Logging, the Elastic Stack & Incident Response',
      estimatedMinutes: 75,
      body: `# Structured Logging, the Elastic Stack & Incident Response

Metrics tell you the error rate tripled. Logs tell you *which* requests failed and why. That only works if logs are **structured data**, not prose.

## Structured JSON logging

\`\`\`js
import pino from 'pino';
import { randomUUID } from 'node:crypto';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Never let a token or a password reach the log store.
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.card_number'],
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
});

app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  req.log = logger.child({ request_id: req.id, trace_id: req.headers['traceparent'] });
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const duration_ms = Number(process.hrtime.bigint() - started) / 1e6;
    req.log.info(
      {
        route: (req.route && req.route.path) || 'unmatched',
        method: req.method,
        status: res.statusCode,
        duration_ms: Math.round(duration_ms * 100) / 100,
        user_id: req.user && req.user.id,
      },
      'request completed'
    );
  });

  next();
});
\`\`\`

That emits one JSON object per line:

\`\`\`json
{"level":"info","time":"2026-08-05T02:11:07.412Z","request_id":"7f1c…","route":"/orders/:id","method":"GET","status":200,"duration_ms":42.31,"msg":"request completed"}
\`\`\`

Non-negotiables:

- **One event per line, JSON, to stdout.** In a container, stdout *is* the log pipeline. Writing to files inside a container means rotating them yourself and losing them on restart.
- **A correlation ID on every line** (\`request_id\`, and \`trace_id\` if you have tracing) so one query reconstructs a whole request across services.
- **Consistent field names and types.** \`duration_ms\` must always be a number. Elasticsearch infers the mapping from the first document it sees; send \`"42"\` once and the field becomes a string forever in that index.
- **Redact secrets at the logger**, not in review. Tokens, passwords, card numbers, full request bodies.
- **Levels mean something.** \`error\` = a human must look; \`warn\` = degraded but handled; \`info\` = business-meaningful events; \`debug\` = off in production, switchable per-service.

## The Elastic stack

\`\`\`
app (stdout JSON)
   → Filebeat / Fluent Bit        collect + enrich (k8s metadata)
     → Logstash (optional)        parse, transform, route
       → Elasticsearch            index + store
         → Kibana                 search, visualise, alert
\`\`\`

"ELK" is Elasticsearch + Logstash + Kibana; adding Beats makes it "the Elastic Stack". Beats are lightweight shippers written in Go — Filebeat for logs, Metricbeat for metrics, Heartbeat for uptime. If your app already emits JSON, you can send Filebeat straight to Elasticsearch and **skip Logstash entirely**; Logstash earns its keep only when you need heavy parsing (grok on legacy text logs), enrichment from a database, or fan-out to several destinations.

\`\`\`yaml
# filebeat.yml
filebeat.inputs:
  - type: container
    paths: ['/var/log/containers/*.log']

processors:
  - add_kubernetes_metadata: ~
  - decode_json_fields:
      fields: ['message']
      target: ''            # hoist JSON keys to the top level
      overwrite_keys: true
      add_error_key: true
  - drop_event:
      when:
        equals:
          level: 'debug'

output.elasticsearch:
  hosts: ['https://elasticsearch:9200']
  index: 'app-logs-%{[agent.version]}-%{+yyyy.MM.dd}'
\`\`\`

\`\`\`ruby
# logstash/pipeline/app.conf  — only if you actually need transformation
input { beats { port => 5044 } }

filter {
  json { source => "message" skip_on_invalid_json => true }
  date { match => ["time", "ISO8601"] target => "@timestamp" }
  mutate { convert => { "duration_ms" => "float" } remove_field => ["message"] }
  if [status] >= 500 { mutate { add_tag => ["server_error"] } }
}

output {
  elasticsearch {
    hosts => ["https://elasticsearch:9200"]
    data_stream => true
  }
}
\`\`\`

### Index lifecycle management

Logs are write-once, read-rarely, and they grow forever. ILM automates the tiering so storage costs do not.

\`\`\`json
PUT _ilm/policy/app-logs
{
  "policy": {
    "phases": {
      "hot":    { "actions": { "rollover": { "max_primary_shard_size": "50gb", "max_age": "1d" } } },
      "warm":   { "min_age": "2d",  "actions": { "forcemerge": { "max_num_segments": 1 },
                                                 "shrink": { "number_of_shards": 1 } } },
      "cold":   { "min_age": "7d",  "actions": { "searchable_snapshot": { "snapshot_repository": "s3-logs" } } },
      "delete": { "min_age": "30d", "actions": { "delete": {} } }
    }
  }
}
\`\`\`

- **Rollover on size, not only on time** — a fixed daily index is tiny on Sunday and unusable on Black Friday. Aim for 10–50 GB per primary shard.
- **Set a retention that legal has agreed to**, and enforce it in the delete phase.
- Cost control that actually works: drop \`debug\` at the shipper, sample high-volume success logs (keep 1%, keep 100% of errors), and never index a field you will not search on.

In Kibana, \`Discover\` is your query surface (KQL: \`status >= 500 and route : "/orders/*"\`), and a **data view** maps to your index pattern. The single highest-value habit: paste the \`request_id\` from an error into Discover and read the whole request's story in one filtered view.

## Incident response basics

Observability exists to shorten two numbers: **MTTD** (detect) and **MTTR** (restore).

**Severity, agreed in advance:**

| Sev | Meaning | Response |
| --- | --- | --- |
| SEV1 | Total outage or data loss | page immediately, all hands, comms every 30 min |
| SEV2 | Major feature broken, no workaround | page, fix in business hours if it can wait |
| SEV3 | Degraded or cosmetic | ticket |

**Roles.** Even with three people, name them out loud: an **incident commander** (decides, does not debug), a **communications lead** (status page and stakeholders), and **responders** (debug). The commander's job is to prevent five people from independently restarting the database.

**The order of operations is restore, then diagnose.** Roll back the deploy, fail over, flip the feature flag, scale up. Curiosity is for the postmortem; the users want the site back. Capture evidence — a screenshot of the dashboard, the log query, the trace — *before* you mutate state.

**Runbooks.** Every alert links to one, and it contains: what this alert means, its user impact, the first three commands to run, the two most common causes, how to roll back, and who to escalate to. Write it when you create the alert — the person reading it at 3am will not be you.

**Blameless postmortems** within a week for SEV1/SEV2: timeline, impact quantified in error budget, contributing factors, what went well, and dated action items with owners. Blameless is not sentimentality; it is the only way people tell you what actually happened. Systems that let one tired human cause an outage are broken systems.`,
    },
  ],
  quiz: [
    {
      prompt: 'Why should `user_id` never be a Prometheus label?',
      options: [
        'Prometheus labels must be numeric',
        'Every distinct label value creates a new time series, so an unbounded identifier explodes cardinality and destroys the server',
        'It would be visible in Grafana to unauthorised users',
        'Counters cannot carry labels at all',
      ],
      correctIndex: 1,
      explanation:
        'A series is identified by name plus every label value. High-cardinality identifiers (user IDs, order IDs, raw URLs) multiply series without bound and blow up memory and query time. Those identifiers belong in logs and traces.',
      difficulty: 'EASY',
    },
    {
      prompt: 'You run ten replicas and need a fleet-wide p99 latency. Why is a Prometheus summary the wrong metric type?',
      options: [
        'Summaries do not expose a _count series',
        'Summaries are more expensive to scrape',
        'Summaries cannot have labels',
        'Summary quantiles are computed inside each process, and quantiles from separate processes cannot be meaningfully aggregated',
      ],
      correctIndex: 3,
      explanation:
        'Averaging or summing per-instance quantiles is mathematically invalid. A histogram exposes additive bucket counters, so you sum the buckets across replicas first and then apply histogram_quantile — which is why histograms are the default choice for latency.',
      difficulty: 'HARD',
    },
    {
      prompt: 'Which PromQL expression correctly gives fleet-wide p95 request latency?',
      options: [
        'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))',
        'avg(histogram_quantile(0.95, http_request_duration_seconds_bucket))',
        'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])))',
        'rate(histogram_quantile(0.95, http_request_duration_seconds_sum)[5m])',
      ],
      correctIndex: 0,
      explanation:
        'You must rate() the bucket counters, aggregate while *keeping* the `le` label, and only then apply histogram_quantile. Option 3 drops `le`, leaving nothing to interpolate over; the others average quantiles or misuse rate().',
      difficulty: 'HARD',
    },
    {
      prompt: 'An alert rule has `for: 5m`. What does that mean?',
      options: [
        'The alert is re-sent every 5 minutes until resolved',
        'The query looks back over a 5-minute window',
        'The expression must stay true continuously for 5 minutes before the alert fires; until then it is pending',
        'The alert is silenced for 5 minutes after firing',
      ],
      correctIndex: 2,
      explanation:
        '`for:` is the anti-flap control. The alert sits in `pending` while the condition holds, and only becomes `firing` after the duration elapses. Re-notification cadence is Alertmanager’s `repeat_interval`; the lookback window is the range selector in the expression.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'With a 99.9% availability SLO over 30 days, roughly how much error budget do you have?',
      options: ['About 7 hours', 'About 4 minutes', 'About 21 minutes', 'About 43 minutes'],
      correctIndex: 3,
      explanation:
        '0.1% of 30 days = 0.001 × 43,200 minutes ≈ 43 minutes. 99% gives about 7h18m, 99.95% about 21m, and 99.99% about 4m19s.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Why do multi-window burn-rate alerts pair a long window with a short one?',
      options: [
        'To reduce the load on Prometheus',
        'The long window suppresses noise from brief blips, while the short window requires the problem to be happening right now so the alert also resolves quickly',
        'The short window is used only for the dashboard',
        'Prometheus cannot evaluate a single window longer than one hour',
      ],
      correctIndex: 1,
      explanation:
        'A long window alone is slow to clear after a fix; a short window alone is noisy. Requiring both to breach gives you both precision and fast recovery — the standard 14.4x/1h+5m, 6x/6h+30m ladder.',
      difficulty: 'HARD',
    },
    {
      prompt: 'In Grafana, why use `$__rate_interval` instead of a hard-coded `[5m]` inside `rate()`?',
      options: [
        'It makes queries execute faster',
        'It is required syntax for the Prometheus data source',
        'It expands to a window guaranteed to cover at least four scrape intervals at the current zoom level, so panels do not go blank when you zoom in',
        'It converts the result from per-second to per-minute',
      ],
      correctIndex: 2,
      explanation:
        'A fixed `[5m]` breaks when someone zooms to a 5-minute range or when the scrape interval changes. `$__rate_interval` is computed from the panel interval and the data source’s configured scrape interval.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A field is sometimes logged as `"duration_ms": 42` and sometimes as `"duration_ms": "42"`. What breaks?',
      options: [
        'Elasticsearch maps the field from the first document it sees, so later documents of the other type are rejected or the field becomes unaggregatable',
        'Nothing — Elasticsearch coerces every value automatically',
        'Filebeat refuses to ship the line',
        'Kibana displays the number in the wrong timezone',
      ],
      correctIndex: 0,
      explanation:
        'Dynamic mapping fixes the field type per index from the first document. A later type mismatch causes rejected documents or a field you cannot run numeric aggregations on. Consistent field types are why structured logging needs a shared logger, not ad-hoc string building.',
      difficulty: 'MEDIUM',
    },
  ],
  problems: [
    {
      slug: 'counter-rate-with-resets',
      title: 'Implement rate() Over a Counter with Resets',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Prometheus counters only go up — until the process restarts and the counter drops back to zero. \`rate()\` has to notice that and not report a negative rate.

Implement two functions over an array of samples \`{ t, v }\` (\`t\` in seconds, \`v\` the counter value). The input may be **unsorted**; sort by \`t\` first.

\`increase(samples)\` — total counted increase across the series:

- For each consecutive pair, if \`v[i] >= v[i-1]\`, add \`v[i] - v[i-1]\`.
- Otherwise the counter reset: assume it restarted at 0 and add \`v[i]\` (everything observed since the restart).
- Fewer than 2 samples → \`0\`.

\`rate(samples)\` — \`increase(samples) / (lastT - firstT)\`. If the span is \`0\` or there are fewer than 2 samples, return \`0\`.

\`\`\`js
increase([{ t: 0, v: 100 }, { t: 60, v: 160 }]);              // 60
rate([{ t: 0, v: 100 }, { t: 60, v: 160 }]);                  // 1
increase([{ t: 0, v: 100 }, { t: 30, v: 130 }, { t: 60, v: 10 }]); // 40
\`\`\``,
      starterCode: `function increase(samples) {
  // sum the deltas, treating a drop as a counter reset
}

function rate(samples) {
  // increase divided by the time span in seconds
}

module.exports = { increase, rate };`,
      solutionCode: `function sortByTime(samples) {
  var list = Array.isArray(samples) ? samples.slice() : [];
  list.sort(function (a, b) { return a.t - b.t; });
  return list;
}

function increase(samples) {
  var pts = sortByTime(samples);
  if (pts.length < 2) return 0;

  var total = 0;
  for (var i = 1; i < pts.length; i += 1) {
    var prev = pts[i - 1].v;
    var cur = pts[i].v;
    if (cur >= prev) {
      total += cur - prev;
    } else {
      // Counter reset: the process restarted from 0, so everything
      // we can see now was counted since the reset.
      total += cur;
    }
  }
  return total;
}

function rate(samples) {
  var pts = sortByTime(samples);
  if (pts.length < 2) return 0;

  var span = pts[pts.length - 1].t - pts[0].t;
  if (span <= 0) return 0;

  return increase(pts) / span;
}

module.exports = { increase, rate };`,
      hints: [
        'Sort a copy of the array — mutating the caller’s input is a bug waiting to happen.',
        'A drop between two samples means a restart, not a negative delta. The post-reset value is itself the increase.',
        'rate() divides by the wall-clock span between the first and last sample, not by the number of samples.',
        'Guard the divide: identical timestamps or a single sample must return 0, not NaN or Infinity.',
      ],
      tests: [
        {
          name: 'simple increase',
          assertion: 'solution.increase([{t:0,v:100},{t:60,v:160}]) === 60',
        },
        {
          name: 'rate is increase per second',
          assertion: 'close(solution.rate([{t:0,v:100},{t:60,v:160}]), 1)',
        },
        {
          name: 'a counter reset is not a negative delta',
          assertion: 'solution.increase([{t:0,v:100},{t:30,v:130},{t:60,v:10}]) === 40',
        },
        {
          name: 'rate across a reset',
          assertion: 'close(solution.rate([{t:0,v:100},{t:30,v:130},{t:60,v:10}]), 40/60)',
        },
        {
          name: 'unsorted input is handled',
          assertion: 'solution.increase([{t:60,v:160},{t:0,v:100},{t:30,v:120}]) === 60',
        },
        {
          name: 'a flat counter has zero rate',
          assertion: 'solution.rate([{t:0,v:5},{t:10,v:5}]) === 0',
          hidden: true,
        },
        {
          name: 'fewer than two samples yields zero',
          assertion: 'solution.rate([{t:0,v:5}]) === 0 && solution.increase([]) === 0',
          hidden: true,
        },
        {
          name: 'multiple resets accumulate',
          assertion: 'solution.increase([{t:0,v:10},{t:10,v:2},{t:20,v:6},{t:30,v:1}]) === 7',
          hidden: true,
        },
        {
          name: 'a zero time span returns 0 rather than Infinity',
          assertion: 'solution.rate([{t:5,v:1},{t:5,v:9}]) === 0',
          hidden: true,
        },
      ],
      xp: 45,
    },
    {
      slug: 'prometheus-histogram-quantile',
      title: 'Build a Prometheus Histogram and Estimate Quantiles',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Implement the data structure behind \`http_request_duration_seconds\`.

\`createHistogram(bounds)\` returns an object with three methods. \`bounds\` is a list of upper bucket boundaries (\`le\` values) which may arrive **unsorted**.

**\`observe(value)\`** — record one observation.

**\`snapshot()\`** — returns \`{ buckets, count, sum }\` where \`buckets\` is the **cumulative** count per boundary in ascending order, with a final \`+Inf\` bucket:

\`\`\`js
{
  buckets: [{ le: 0.1, count: 2 }, { le: 0.5, count: 5 }, { le: '+Inf', count: 10 }],
  count: 10,
  sum: 27.3
}
\`\`\`

A bucket with boundary \`le\` counts every observation \`<= le\`, so counts are non-decreasing and the \`+Inf\` bucket always equals \`count\`.

**\`quantile(q)\`** — the Prometheus \`histogram_quantile\` algorithm:

1. No observations → \`NaN\`. \`q <= 0\` → \`0\`.
2. \`rank = q * count\`. Walk the buckets in ascending order, tracking the cumulative count *below* the current bucket.
3. The first bucket that is non-empty and whose cumulative count reaches \`rank\` is the answer's bucket. **Linearly interpolate** inside it: \`lower + (le - lower) * (rank - countBelow) / countInBucket\`, where \`lower\` is the previous boundary (or \`0\` for the first bucket).
4. If \`rank\` falls into the \`+Inf\` bucket, return the largest finite boundary.

That final rule is why a p99 that lands above your top bucket reports exactly your top bucket — a real trap when your buckets do not bracket your SLO.`,
      starterCode: `function createHistogram(bounds) {
  // Keep a sorted copy of bounds and one counter per bucket,
  // plus an overflow counter for +Inf.
  return {
    observe(value) {},
    snapshot() {},
    quantile(q) {},
  };
}

module.exports = { createHistogram };`,
      solutionCode: `function createHistogram(bounds) {
  var upper = (Array.isArray(bounds) ? bounds.slice() : []).sort(function (a, b) { return a - b; });
  // counts[i] = observations in (upper[i-1], upper[i]]; last slot is the +Inf overflow.
  var counts = [];
  for (var k = 0; k <= upper.length; k += 1) counts.push(0);

  var total = 0;
  var sum = 0;

  function observe(value) {
    var i = 0;
    while (i < upper.length && value > upper[i]) i += 1;
    counts[i] += 1;
    total += 1;
    sum += value;
  }

  function snapshot() {
    var out = [];
    var running = 0;
    for (var i = 0; i < upper.length; i += 1) {
      running += counts[i];
      out.push({ le: upper[i], count: running });
    }
    out.push({ le: '+Inf', count: total });
    return { buckets: out, count: total, sum: sum };
  }

  function quantile(q) {
    if (total === 0) return NaN;
    if (q <= 0) return 0;
    var target = q > 1 ? 1 : q;
    var rank = target * total;

    var below = 0;
    for (var i = 0; i < upper.length; i += 1) {
      var inBucket = counts[i];
      if (inBucket > 0 && below + inBucket >= rank) {
        var lower = i === 0 ? 0 : upper[i - 1];
        return lower + (upper[i] - lower) * ((rank - below) / inBucket);
      }
      below += inBucket;
    }

    // Landed in +Inf: the best we can say is "at least the top boundary".
    return upper.length === 0 ? NaN : upper[upper.length - 1];
  }

  return { observe: observe, snapshot: snapshot, quantile: quantile };
}

module.exports = { createHistogram };`,
      hints: [
        'Store per-bucket counts and make them cumulative only in snapshot() — interpolation needs the per-bucket count.',
        'An observation belongs to the first bucket whose boundary is >= the value; anything larger than every boundary goes to the +Inf slot.',
        'Skip empty buckets when searching for the target bucket, otherwise you divide by zero.',
        'The lower bound of the first bucket is 0, not -Infinity — that is what Prometheus assumes for non-negative observations.',
      ],
      tests: [
        {
          name: 'cumulative buckets are correct',
          assertion:
            "(() => { const h = solution.createHistogram([0.1,0.5,1,5]); [0.05,0.05,0.2,0.3,0.4,0.6,0.7,2,3,20].forEach(v => h.observe(v)); return deepEqual(h.snapshot().buckets, [{le:0.1,count:2},{le:0.5,count:5},{le:1,count:7},{le:5,count:9},{le:'+Inf',count:10}]); })()",
        },
        {
          name: 'count and sum are tracked',
          assertion:
            "(() => { const h = solution.createHistogram([0.1,0.5,1,5]); [0.05,0.05,0.2,0.3,0.4,0.6,0.7,2,3,20].forEach(v => h.observe(v)); const s = h.snapshot(); return s.count === 10 && close(s.sum, 27.3, 1e-9); })()",
        },
        {
          name: 'unsorted bounds are sorted',
          assertion:
            "(() => { const h = solution.createHistogram([5,0.1,1,0.5]); [0.05,0.2,2].forEach(v => h.observe(v)); return deepEqual(h.snapshot().buckets.map(b => b.le), [0.1,0.5,1,5,'+Inf']); })()",
        },
        {
          name: 'median interpolates inside its bucket',
          assertion:
            "(() => { const h = solution.createHistogram([0.1,0.5,1,5]); [0.05,0.05,0.2,0.3,0.4,0.6,0.7,2,3,20].forEach(v => h.observe(v)); return close(h.quantile(0.5), 0.5, 1e-9); })()",
        },
        {
          name: 'p10 interpolates from a lower bound of 0',
          assertion:
            "(() => { const h = solution.createHistogram([0.1,0.5,1,5]); [0.05,0.05,0.2,0.3,0.4,0.6,0.7,2,3,20].forEach(v => h.observe(v)); return close(h.quantile(0.1), 0.05, 1e-9); })()",
        },
        {
          name: 'p90 lands on the top of the 5s bucket',
          assertion:
            "(() => { const h = solution.createHistogram([0.1,0.5,1,5]); [0.05,0.05,0.2,0.3,0.4,0.6,0.7,2,3,20].forEach(v => h.observe(v)); return close(h.quantile(0.9), 5, 1e-9); })()",
        },
        {
          name: 'a quantile in +Inf clamps to the largest finite bucket',
          assertion:
            "(() => { const h = solution.createHistogram([0.1,0.5,1,5]); [0.05,0.05,0.2,0.3,0.4,0.6,0.7,2,3,20].forEach(v => h.observe(v)); return h.quantile(0.99) === 5; })()",
          hidden: true,
        },
        {
          name: 'an empty histogram returns NaN',
          assertion: "(() => { const h = solution.createHistogram([1,2]); return Number.isNaN(h.quantile(0.5)); })()",
          hidden: true,
        },
        {
          name: 'observations above every bound only land in +Inf',
          assertion:
            "(() => { const h = solution.createHistogram([1,2]); [9,9,9].forEach(v => h.observe(v)); const s = h.snapshot(); return s.buckets[0].count === 0 && s.buckets[1].count === 0 && s.buckets[2].count === 3; })()",
          hidden: true,
        },
      ],
      xp: 80,
    },
    {
      slug: 'golden-signals-from-logs',
      title: 'Compute the Four Golden Signals from a Log Batch',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Before you have Prometheus, you have logs. Derive the golden signals from a batch of structured log lines.

Implement \`goldenSignals(lines, windowSeconds)\`. Each element of \`lines\` is a **string** that should parse as a JSON object like:

\`\`\`json
{"route":"/orders/:id","status":200,"duration_ms":42.3,"queue_depth":7}
\`\`\`

A line is **malformed** if it does not parse, is not an object, or has no numeric \`status\`. Count it and skip it.

Return exactly this shape:

| Field | Meaning |
| --- | --- |
| \`total\` | number of valid records |
| \`malformed\` | number of skipped lines |
| \`errors\` | valid records with \`status >= 500\` |
| \`errorRate\` | \`errors / total\`, rounded to 4 dp (\`0\` when \`total\` is 0) |
| \`traffic\` | \`total / windowSeconds\`, rounded to 3 dp (\`0\` when \`windowSeconds\` is falsy or <= 0) |
| \`latency\` | \`{ p50, p95, p99 }\` over every numeric \`duration_ms\`, using **nearest-rank** on the ascending sort: index \`ceil(q * n) - 1\`, capped at \`n - 1\`. \`0\` when there are no durations |
| \`saturation\` | the maximum numeric \`queue_depth\` seen, else \`0\` |
| \`topErrorRoute\` | the route with the most \`>= 500\` responses, ties broken alphabetically; \`null\` if there are no errors |

Records missing \`route\` count their errors under \`'unknown'\`.`,
      starterCode: `function goldenSignals(lines, windowSeconds) {
  // Parse defensively, collect durations, then derive:
  // latency (percentiles), traffic, errors, saturation.
}

module.exports = { goldenSignals };`,
      solutionCode: `function goldenSignals(lines, windowSeconds) {
  var list = Array.isArray(lines) ? lines : [];

  var total = 0;
  var malformed = 0;
  var errors = 0;
  var saturation = 0;
  var durations = [];
  var errorsByRoute = new Map();

  for (var i = 0; i < list.length; i += 1) {
    var rec = null;
    try {
      rec = JSON.parse(list[i]);
    } catch (e) {
      malformed += 1;
      continue;
    }

    if (!rec || typeof rec !== 'object' || Array.isArray(rec) || typeof rec.status !== 'number') {
      malformed += 1;
      continue;
    }

    total += 1;

    if (typeof rec.duration_ms === 'number' && isFinite(rec.duration_ms)) durations.push(rec.duration_ms);
    if (typeof rec.queue_depth === 'number' && rec.queue_depth > saturation) saturation = rec.queue_depth;

    if (rec.status >= 500) {
      errors += 1;
      var route = rec.route || 'unknown';
      errorsByRoute.set(route, (errorsByRoute.get(route) || 0) + 1);
    }
  }

  durations.sort(function (a, b) { return a - b; });

  function percentile(q) {
    if (durations.length === 0) return 0;
    var idx = Math.ceil(q * durations.length) - 1;
    if (idx < 0) idx = 0;
    if (idx > durations.length - 1) idx = durations.length - 1;
    return durations[idx];
  }

  var topErrorRoute = null;
  var best = 0;
  Array.from(errorsByRoute.keys()).sort().forEach(function (route) {
    var c = errorsByRoute.get(route);
    if (c > best) {
      best = c;
      topErrorRoute = route;
    }
  });

  var secs = typeof windowSeconds === 'number' && windowSeconds > 0 ? windowSeconds : 0;

  return {
    total: total,
    malformed: malformed,
    errors: errors,
    errorRate: total === 0 ? 0 : Math.round((errors / total) * 10000) / 10000,
    traffic: secs === 0 ? 0 : Math.round((total / secs) * 1000) / 1000,
    latency: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
    saturation: saturation,
    topErrorRoute: topErrorRoute,
  };
}

module.exports = { goldenSignals };`,
      hints: [
        'Wrap JSON.parse in try/catch — one bad line must not take down the whole batch.',
        'JSON.parse("123") succeeds and returns a number, so check the type of the parsed value as well.',
        'Nearest-rank percentile on a sorted array: index = ceil(q * n) - 1, clamped into [0, n-1].',
        'For the alphabetical tie-break, iterate the routes in sorted order and keep the first strict maximum.',
      ],
      tests: [
        {
          name: 'counts valid and malformed lines',
          assertion:
            "(() => { const mk = (s,d,r) => JSON.stringify({route:r,status:s,duration_ms:d}); const lines=[mk(200,10,'/a'),mk(200,20,'/a'),mk(200,30,'/a'),mk(200,40,'/a'),mk(200,50,'/a'),mk(200,60,'/a'),mk(200,70,'/a'),mk(500,80,'/orders'),mk(500,90,'/orders'),mk(503,1000,'/cart'),'oops not json']; const r = solution.goldenSignals(lines, 60); return r.total === 10 && r.malformed === 1; })()",
        },
        {
          name: 'error count and rate',
          assertion:
            "(() => { const mk = (s,d,r) => JSON.stringify({route:r,status:s,duration_ms:d}); const lines=[mk(200,10,'/a'),mk(200,20,'/a'),mk(200,30,'/a'),mk(200,40,'/a'),mk(200,50,'/a'),mk(200,60,'/a'),mk(200,70,'/a'),mk(500,80,'/orders'),mk(500,90,'/orders'),mk(503,1000,'/cart'),'oops not json']; const r = solution.goldenSignals(lines, 60); return r.errors === 3 && close(r.errorRate, 0.3); })()",
        },
        {
          name: 'nearest-rank percentiles',
          assertion:
            "(() => { const mk = (s,d,r) => JSON.stringify({route:r,status:s,duration_ms:d}); const lines=[mk(200,10,'/a'),mk(200,20,'/a'),mk(200,30,'/a'),mk(200,40,'/a'),mk(200,50,'/a'),mk(200,60,'/a'),mk(200,70,'/a'),mk(500,80,'/orders'),mk(500,90,'/orders'),mk(503,1000,'/cart'),'oops not json']; const r = solution.goldenSignals(lines, 60); return deepEqual(r.latency, {p50:50, p95:1000, p99:1000}); })()",
        },
        {
          name: 'traffic is requests per second rounded to 3dp',
          assertion:
            "(() => { const mk = (s,d,r) => JSON.stringify({route:r,status:s,duration_ms:d}); const lines=[mk(200,10,'/a'),mk(200,20,'/a'),mk(200,30,'/a'),mk(200,40,'/a'),mk(200,50,'/a'),mk(200,60,'/a'),mk(200,70,'/a'),mk(500,80,'/orders'),mk(500,90,'/orders'),mk(503,1000,'/cart'),'oops not json']; return close(solution.goldenSignals(lines, 60).traffic, 0.167); })()",
        },
        {
          name: 'top error route wins on count',
          assertion:
            "(() => { const mk = (s,d,r) => JSON.stringify({route:r,status:s,duration_ms:d}); const lines=[mk(200,10,'/a'),mk(500,80,'/orders'),mk(500,90,'/orders'),mk(503,1000,'/cart')]; return solution.goldenSignals(lines, 60).topErrorRoute === '/orders'; })()",
        },
        {
          name: 'saturation is the max queue depth',
          assertion:
            "(() => { const lines=[JSON.stringify({route:'/a',status:200,duration_ms:5,queue_depth:3}),JSON.stringify({route:'/a',status:200,duration_ms:5,queue_depth:11}),JSON.stringify({route:'/a',status:200,duration_ms:5})]; return solution.goldenSignals(lines, 10).saturation === 11; })()",
        },
        {
          name: 'an empty batch is all zeroes',
          assertion:
            "(() => { const r = solution.goldenSignals([], 60); return r.total === 0 && r.errorRate === 0 && r.traffic === 0 && r.topErrorRoute === null && r.latency.p50 === 0; })()",
          hidden: true,
        },
        {
          name: 'non-object JSON counts as malformed',
          assertion:
            "(() => { const r = solution.goldenSignals(['123', '\"hello\"', 'null', JSON.stringify({route:'/a',status:200,duration_ms:1})], 1); return r.malformed === 3 && r.total === 1; })()",
          hidden: true,
        },
        {
          name: 'alphabetical tie-break on equal error counts',
          assertion:
            "(() => { const mk = (s,r) => JSON.stringify({route:r,status:s,duration_ms:1}); return solution.goldenSignals([mk(500,'/zebra'),mk(500,'/alpha')], 10).topErrorRoute === '/alpha'; })()",
          hidden: true,
        },
        {
          name: 'a missing route is bucketed as unknown',
          assertion:
            "(() => { const r = solution.goldenSignals([JSON.stringify({status:500,duration_ms:1})], 10); return r.topErrorRoute === 'unknown'; })()",
          hidden: true,
        },
        {
          name: 'a zero window yields zero traffic instead of Infinity',
          assertion:
            "(() => { const r = solution.goldenSignals([JSON.stringify({route:'/a',status:200,duration_ms:1})], 0); return r.traffic === 0; })()",
          hidden: true,
        },
      ],
      xp: 100,
    },
  ],
  project: {
    slug: 'capstone-ship-and-operate',
    title: 'Capstone — Deploy, Observe and Operate Your Full-Stack App',
    estimatedHours: 14,
    repoStarter: 'https://github.com/codeninja-track/capstone-starter',
    brief: `# Capstone — Ship It

Take the application you have been building all month and put it in production properly: containerised, deployed by a pipeline, served over HTTPS on a real domain, instrumented with metrics, logging structured JSON, alerting when it breaks, and documented well enough that a stranger could operate it.

This is the deliverable you put at the top of your CV. Grading weights *operability* as heavily as features.

## Required architecture

\`\`\`
                    Internet
                       │  HTTPS (valid cert, custom domain)
                 ┌─────▼─────┐
                 │  reverse  │  Caddy / Nginx / Traefik / cloud LB
                 │   proxy   │
                 └──┬─────┬──┘
        /           │     │           /api
  ┌─────▼─────┐          ┌▼──────────┐
  │ frontend  │          │    API    │──► /metrics ──┐
  │ (static / │          │ (Node/etc)│               │
  │  SSR)     │          └──┬─────┬──┘               │
  └───────────┘             │     │                  │
                    ┌───────▼─┐ ┌─▼──────┐    ┌──────▼─────┐
                    │ Postgres│ │ Redis  │    │ Prometheus │──► Grafana
                    └─────────┘ └────────┘    └──────┬─────┘
                                                     └──► Alertmanager
\`\`\`

Everything runs from a single \`docker compose up\` locally and from the same images in production.

## User stories

1. **As a visitor**, I load the site over HTTPS at a domain I can type, and it responds in under a second.
2. **As a user**, I can sign up, sign in, and perform the app's core create/read/update/delete flow against real persisted data.
3. **As a developer**, I open a pull request and CI runs lint, unit tests and integration tests against a real Postgres service container; a red build blocks the merge.
4. **As a developer**, merging to \`main\` builds one immutable image, pushes it to a registry tagged with the commit SHA, and deploys it — with no manual steps.
5. **As an operator**, I open a Grafana dashboard and see request rate, error rate and p95 latency for the API, plus cache hit rate and database connection count.
6. **As an on-call engineer**, I get an alert when the 5xx rate crosses my threshold, and the alert links to a runbook that tells me what to do.
7. **As an incident responder**, I can take a \`request_id\` from an error and find every log line for that request.

## Required technology

- **Containers** — a multi-stage \`Dockerfile\` per service producing a non-root, slim runtime image; \`docker-compose.yml\` wiring frontend, API, Postgres and Redis with healthchecks.
- **CI/CD** — GitHub Actions (or GitLab CI) implementing build → test → scan → package → deploy, with dependency caching and a deploy job gated on \`main\`.
- **Hosting** — anything real: a VPS, Cloud Run, ECS, Container Apps, Fly.io, Render. It must survive a reboot.
- **TLS** — a valid certificate on a custom domain (Let's Encrypt via Caddy/Traefik is the least work).
- **Observability** — Prometheus scraping the API's \`/metrics\`, a provisioned Grafana dashboard, at least one alert rule with a \`for:\` clause, and structured JSON logs.
- **Docs** — a \`README.md\` with an architecture diagram, and \`RUNBOOK.md\`.

## Acceptance criteria

- \`git clone && cp .env.example .env && docker compose up\` gives a working app on \`localhost\` with **no other steps**.
- The production URL serves valid HTTPS with no mixed-content warnings.
- A PR with a deliberately failing test cannot be merged.
- A merge to \`main\` reaches production without anyone SSH-ing anywhere, and the running image tag matches the merged commit SHA.
- Killing the API container and letting it restart causes no data loss and no manual intervention.
- \`curl https://your-domain/api/health\` returns 200 with a JSON body reporting database and cache connectivity.
- The Grafana dashboard shows non-zero data while you drive traffic with a load generator (\`k6\`, \`hey\`, \`autocannon\`).
- Deliberately breaking a dependency (stop Postgres) fires your alert within its evaluation window, and the runbook's first step actually helps.
- No secrets in the repository. \`.env.example\` documents every variable; real values live in CI secrets or the host's secret store.

## The runbook

\`RUNBOOK.md\` is graded. It must contain, per alert:

1. What the alert means, in one sentence.
2. User-visible impact.
3. The first three commands to run (with real paths and container names).
4. The two most likely causes.
5. How to roll back to the previous image tag, exactly.
6. When to escalate, and to whom.

Plus a **deploy** section (how to deploy, how to verify, how to roll back), a **restore** section (how to restore the database from a backup — and evidence you have actually tested it), and a **contacts/on-call** section.

## What "done" looks like

A URL, a repo, a green pipeline badge, a dashboard screenshot in the README, and a runbook someone else could follow at 3am. Record a two-minute walkthrough: open the app, open the pipeline, open the dashboard, break something, show the alert, roll back. That video is worth more in an interview than any bullet point.`,
    checklist: [
      'Multi-stage Dockerfile for each service, running as a non-root user, with a pinned base image',
      'docker-compose.yml runs frontend, API, Postgres and Redis with healthchecks and named volumes; the app works after a single `docker compose up`',
      'Database schema is created by versioned migrations that run automatically on deploy (not by hand-written SQL)',
      'CI workflow runs lint, unit tests and integration tests against a real Postgres service container on every pull request',
      'CI caches dependencies and finishes in under five minutes; a failing test blocks the merge via a required status check',
      'Merging to main builds one image, tags it with the commit SHA, pushes it to a registry, and deploys it with no manual steps',
      'The app is reachable on a custom domain over HTTPS with a valid, auto-renewing certificate',
      'GET /api/health returns 200 with JSON reporting database and cache connectivity, and is used as the container healthcheck',
      'The API exposes /metrics with http_requests_total (counter) and http_request_duration_seconds (histogram), labelled by route pattern, method and status',
      'Prometheus scrapes the API and at least one exporter (node_exporter or postgres_exporter), with config committed to the repo',
      'A provisioned Grafana dashboard shows rate, errors and p95 latency, plus one saturation panel, and displays real data under load',
      'At least one alert rule with a `for:` clause fires when you deliberately break a dependency, and routes to a real destination (Slack/email/PagerDuty)',
      'The application emits one-line JSON logs to stdout including request_id, route, status and duration_ms, with secrets redacted',
      'README.md contains an architecture diagram, local setup, environment variables and a dashboard screenshot; RUNBOOK.md covers alerts, deploy, rollback and database restore',
    ],
    stretchGoals: [
      'Add distributed tracing with OpenTelemetry and correlate trace_id between logs, traces and metrics (exemplars)',
      'Define an SLO with a multi-window burn-rate alert (14.4x/1h and 6x/6h) instead of a static error-rate threshold',
      'Ship logs into Elasticsearch or Loki with an index lifecycle / retention policy and a saved Kibana view keyed on request_id',
      'Replace the manual deploy step with a canary or blue-green rollout that automatically rolls back on an error-rate regression',
      'Provision the hosting, DNS, database and TLS with Terraform, planned in CI on the PR and applied on merge via OIDC',
    ],
  },
  flashcards: [
    {
      front: 'Metrics, logs, traces — which answers what?',
      back: 'A metric tells you something is wrong and since when; a trace tells you where in the call graph; a log tells you why for a specific request.',
      tags: ['observability'],
    },
    {
      front: 'What is metric cardinality and why does it matter?',
      back: 'A series is the metric name plus every label value. Unbounded labels (user_id, order_id, raw URL) create millions of series and kill Prometheus. Keep labels bounded; put identifiers in logs and traces.',
      tags: ['prometheus', 'observability'],
    },
    {
      front: 'The four golden signals',
      back: 'Latency, traffic, errors, saturation. RED (Rate/Errors/Duration) applies them to request-driven services; USE (Utilisation/Saturation/Errors) applies them to resources.',
      tags: ['observability', 'sre'],
    },
    {
      front: 'Counter vs gauge vs histogram vs summary',
      back: 'Counter: only increases, always query with rate(). Gauge: goes up and down. Histogram: bucket counters aggregatable across instances, quantile computed at query time. Summary: quantiles computed in-process and NOT aggregatable.',
      tags: ['prometheus'],
    },
    {
      front: 'Why does Prometheus pull instead of push?',
      back: 'A failed scrape is itself a signal (up == 0), targets need no outbound config or credentials, and service discovery keeps the target list current. Short-lived batch jobs are the exception and use the Pushgateway.',
      tags: ['prometheus'],
    },
    {
      front: 'Correct PromQL for fleet-wide p95 latency',
      back: 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m]))). rate() first, keep the le label when aggregating, quantile last.',
      tags: ['prometheus', 'promql'],
    },
    {
      front: 'What does `for: 5m` do on an alerting rule?',
      back: 'The expression must stay true for five continuous minutes before the alert moves from pending to firing. It is the primary anti-flapping control.',
      tags: ['prometheus', 'alerting'],
    },
    {
      front: 'What does Alertmanager add on top of Prometheus?',
      back: 'Routing to receivers, grouping (one notification for 200 failing pods), inhibition (suppress latency alerts when the service is down), silences, and repeat intervals.',
      tags: ['prometheus', 'alerting'],
    },
    {
      front: 'SLI vs SLO vs error budget',
      back: 'SLI: the measured quality number. SLO: the target over a window (99.9%/30d). Error budget: the allowed shortfall — 0.1% of 30 days ≈ 43 minutes — spent on release risk.',
      tags: ['sre', 'slo'],
    },
    {
      front: 'Why alert on burn rate rather than a raw error threshold?',
      back: 'Burn rate = observed error rate / (1 - SLO). It scales the alert to the actual budget impact, so a 30-second blip does not page while a sustained 14.4x burn does. Pair a long and a short window.',
      tags: ['sre', 'alerting'],
    },
    {
      front: 'Why `$__rate_interval` in Grafana?',
      back: 'It expands to a window covering at least four scrape intervals at the current zoom level, so rate() panels do not go blank when someone zooms in. A hard-coded [5m] breaks on short ranges.',
      tags: ['grafana', 'promql'],
    },
    {
      front: 'Filebeat → Logstash → Elasticsearch → Kibana: what does each do, and what can you skip?',
      back: 'Beats collect and enrich, Logstash parses/transforms/routes, Elasticsearch indexes and stores, Kibana searches and visualises. If the app already emits JSON, ship Filebeat straight to Elasticsearch and skip Logstash.',
      tags: ['elk', 'logging'],
    },
  ],
  resources: [
    { label: 'Prometheus — Querying basics (PromQL)', url: 'https://prometheus.io/docs/prometheus/latest/querying/basics/', kind: 'DOCS' },
    { label: 'Prometheus — Instrumentation and naming best practices', url: 'https://prometheus.io/docs/practices/naming/', kind: 'DOCS' },
    { label: 'Google SRE Workbook — Alerting on SLOs', url: 'https://sre.google/workbook/alerting-on-slos/', kind: 'ARTICLE' },
    { label: 'Grafana — Provisioning dashboards and data sources', url: 'https://grafana.com/docs/grafana/latest/administration/provisioning/', kind: 'DOCS' },
    { label: 'Elastic — Index lifecycle management', url: 'https://www.elastic.co/guide/en/elasticsearch/reference/current/index-lifecycle-management.html', kind: 'DOCS' },
  ],
};

export default day;
