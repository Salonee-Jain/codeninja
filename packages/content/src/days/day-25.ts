import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 25,
  week: 4,
  pillar: 'BACKEND',
  title: 'Beyond JavaScript — Python & Go for Backend',
  summary: 'One day over the fence: the two other runtimes you will actually meet, and what each one wins.',
  estimatedMinutes: 330,
  objectives: [
    'Name the workloads Python and Go genuinely win, and when to stay in TypeScript',
    'Set up an isolated Python project and read modern typed Python fluently',
    'Explain WSGI vs ASGI, the GIL, and the blocking-call-in-async trap',
    'Build a FastAPI service with Pydantic models, dependency injection and free OpenAPI',
    'Navigate a Django project: models, migrations, the ORM, DRF and the admin',
    'Write concurrent Go with goroutines, channels and explicit error handling',
    'Serve HTTP from Go with net/http and Gin, and ship it as a single static binary',
    'Compare Node/TypeScript, Python and Go on concurrency, typing, startup and deploy',
  ],
  technologies: ['Python', 'FastAPI', 'Django', 'Go'],
  lessons: [
    {
      slug: 'why-python-and-go',
      title: 'Why Read Python and Go — and Python Essentials for a JS Developer',
      estimatedMinutes: 75,
      body: `# Why Read Python and Go — and Python Essentials for a JS Developer

Almost every day of this track is JavaScript and TypeScript, and that is deliberate. Today is the exception. You are not switching stacks — you are learning to **read** two languages you will meet whether you like it or not, and to recognise the situations where reaching for them is the correct engineering call.

## The jobs each one actually wins

**Python wins where the ecosystem already lives.** Every serious machine-learning library, every data pipeline framework, every scientific and numerical tool has its canonical implementation in Python. If your product touches embeddings, model inference, scraping, ETL or notebooks, the Python service is not a preference — it is where the library you need exists. Python also wins **admin-heavy products**: Django ships an auto-generated back office that would be several weeks of work in any JavaScript stack.

**Go wins where the deploy artefact matters.** \`go build\` emits one static binary with no interpreter, no runtime and no \`node_modules\`. That is why the infrastructure you use every day — Docker, Kubernetes, Terraform, Prometheus, Traefik, etcd — is written in Go. It is also the natural answer for CPU-bound work, for proxies and gateways handling tens of thousands of concurrent connections, for CLIs you hand to other teams, and for anything scale-to-zero where a 5 ms cold start beats a 50 ms one.

**Stay in TypeScript** for I/O-heavy product APIs, for anything the frontend team touches, and for anywhere sharing types end to end beats every other consideration. Which is most of what you build.

There is a third reason to spend a day here: you will inherit these services. The data team's FastAPI endpoint will break and you will be the one reading the traceback. Fluent reading is cheap; fluent writing is not, and today only buys you the first.

## Isolate first, always

Python installs packages **globally by default**, and two projects wanting different versions of the same library is a guaranteed afternoon lost. A virtual environment is a directory with its own interpreter and \`site-packages\` — the rough equivalent of a local \`node_modules\`.

\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
python -m pip install --upgrade pip

pip install "fastapi>=0.110" "uvicorn[standard]"
pip freeze > requirements.txt    # exact pins, committed

deactivate
\`\`\`

\`requirements.txt\` is roughly \`package-lock.json\`, except \`pip freeze\` flattens direct and transitive dependencies into one undifferentiated list. Modern practice keeps *direct* dependencies in \`pyproject.toml\` (a \`[project]\` table with \`dependencies = [...]\`) and compiles a fully pinned lock from it:

\`\`\`bash
uv pip compile pyproject.toml -o requirements.txt   # resolved + hashed
uv pip sync requirements.txt                        # exactly this, nothing else
\`\`\`

> \`.venv/\` never goes in git. \`requirements.txt\` always does. Every command in the next two lessons assumes an activated environment.

## Type hints are not optional any more

Python is dynamically typed at runtime, but annotations are load-bearing in modern frameworks — Pydantic and FastAPI **read them at import time** to build validators and OpenAPI schemas. A missing annotation is a missing feature, in a way that has no TypeScript equivalent.

\`\`\`python
from datetime import datetime

def summarise(title: str, tags: list[str], published: datetime | None = None) -> str:
    when = published.isoformat() if published else "draft"
    return f"{title} [{', '.join(tags)}] {when}"
\`\`\`

Note \`list[str]\` and \`X | None\` — builtin generics and the union operator, both standard from 3.10, and the direct analogues of \`string[]\` and \`X | null\`. Older code uses \`List[str]\` and \`Optional[X]\` from \`typing\`; they mean the same thing. Run \`mypy\` or \`pyright\` in CI and the annotations start catching bugs instead of merely describing them.

## WSGI vs ASGI

This is the single most important architectural fact about Python web apps, and it has no counterpart in Node because Node only ever had one model.

**WSGI** (2003) is a synchronous contract: one callable, one request, one thread, blocking I/O.

\`\`\`python
def application(environ, start_response):
    start_response("200 OK", [("Content-Type", "text/plain")])
    return [b"hello"]
\`\`\`

While that handler waits on the database, its worker **can do nothing else**. Concurrency comes from running many workers or threads: \`gunicorn app:application --workers 9\`. Simple, robust, memory-hungry — each worker is a full interpreter.

**ASGI** (2018) is the async successor. Three arguments, and the app can await:

\`\`\`python
async def app(scope, receive, send):
    await send({"type": "http.response.start", "status": 200,
                "headers": [(b"content-type", b"text/plain")]})
    await send({"type": "http.response.body", "body": b"hello"})
\`\`\`

One process, one event loop, thousands of concurrent connections — exactly the Node model. And because \`scope\` carries a \`type\` (\`http\`, \`websocket\`, \`lifespan\`), ASGI expresses things WSGI structurally cannot: WebSockets, server-sent events, long-lived streams, startup/shutdown hooks.

| | WSGI | ASGI |
| --- | --- | --- |
| Handler | \`def\` | \`async def\` (or \`def\`, run in a threadpool) |
| Concurrency | processes / threads | event loop; WebSockets and lifespan events too |
| Servers | gunicorn, uWSGI | uvicorn, hypercorn, daphne |
| Frameworks | Django (classic), Flask | FastAPI, Starlette, Django (ASGI mode) |
| Best at | blocking DB drivers, CPU-ish work | high-concurrency I/O, fan-out to other services |

### The trap that catches everyone

**One blocking call inside an async handler stalls the entire event loop** — every other in-flight request on that worker, not just this one. If you have ever blocked Node's loop with a synchronous \`JSON.parse\` of a 200 MB file, you already understand the failure mode.

\`\`\`python
import asyncio, time
import httpx

@app.get("/bad")
async def bad():
    time.sleep(2)                     # blocks the whole loop for 2s
    return {"ok": True}

@app.get("/good")
async def good():
    await asyncio.sleep(2)            # yields
    async with httpx.AsyncClient() as client:
        r = await client.get(URL)     # async client
    return r.json()

@app.get("/legacy")
def legacy():                          # plain def: FastAPI runs it in a threadpool
    return requests.get(URL).json()
\`\`\`

The rule: **if a function is \`async def\`, everything it calls must be awaitable or genuinely fast.** If you must use a blocking library, either declare the handler as a plain \`def\` (FastAPI moves it to a worker thread automatically) or push it out with \`await asyncio.to_thread(blocking_fn, arg)\`.

Django supports async views on ASGI too, but its ORM is fundamentally synchronous; you call it from a sync view, or via \`sync_to_async\` and the \`a\`-prefixed methods (\`await Post.objects.aget(pk=1)\`). Mixing carelessly raises \`SynchronousOnlyOperation\`, which is Django doing you a favour.

## And the GIL

CPython's Global Interpreter Lock means one thread executes Python bytecode at a time per process. It does **not** affect I/O concurrency — the lock is released around socket and file waits, which is why both threads and async work fine for web serving. It does mean CPU-bound work (image resizing, big JSON transforms) needs a separate process: \`multiprocessing\`, or a task queue like Celery or RQ. Do not try to solve a CPU problem with more threads. The parallel in Node is exact: \`worker_threads\` or a queue, never a tighter loop.`,
    },
    {
      slug: 'fastapi',
      title: 'FastAPI — The Express (and Nest) You Already Know, in Python',
      estimatedMinutes: 85,
      body: `# FastAPI — The Express (and Nest) You Already Know, in Python

FastAPI is Starlette (ASGI) plus Pydantic (validation) plus a dependency injection system. If you have written Express with Zod, or NestJS with DTOs and providers, you already know the shape of every idea in this lesson. Its central twist: **your type hints are the specification.** From one annotated function it derives request parsing, validation, serialisation, documentation and editor autocomplete.

| What you write in Express / NestJS | The FastAPI equivalent |
| --- | --- |
| \`app.get('/posts/:id', handler)\` | \`@app.get("/posts/{post_id}")\` |
| a Zod schema plus \`safeParse\` | a Pydantic \`BaseModel\` — validated before your function runs |
| a Nest DTO plus \`ValidationPipe\` | the annotated parameter itself |
| a Nest provider plus constructor injection | \`Depends(...)\` |
| \`res.status(201).json(post)\` | \`status_code=201\` and \`return post\` |
| a serialiser to strip \`passwordHash\` | \`response_model\` |
| \`swagger-jsdoc\` / \`@nestjs/swagger\` | \`/docs\` and \`/openapi.json\`, free |
| \`express-async-handler\` | nothing: \`async def\` is native |

## Path operations

\`\`\`python
from fastapi import FastAPI, HTTPException, Query, status
from pydantic import BaseModel, Field, EmailStr

app = FastAPI(title="Ninja API", version="1.0.0")


class PostIn(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    body: str
    tags: list[str] = []


class PostOut(PostIn):
    id: int
    author_email: EmailStr


@app.get("/posts", response_model=list[PostOut])
def list_posts(
    published: bool | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return repo.list(published=published, limit=limit, offset=offset)


@app.get("/posts/{post_id}", response_model=PostOut)
def get_post(post_id: int):                       # path param, coerced to int
    post = repo.get(post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@app.post("/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostIn):                 # body, validated by Pydantic
    return repo.create(payload)
\`\`\`

FastAPI infers the source of each parameter from its type and position: a name matching a \`{placeholder}\` is a **path** param, a scalar is a **query** param, a Pydantic model is the **body**. Send \`/posts/abc\` and you get a 422 with a precise error before your function is entered — the thing you would have written a Zod middleware for.

\`response_model\` is not documentation — it **filters the response**. Return a full ORM object with a \`hashed_password\` field and, as long as \`PostOut\` does not declare it, it is stripped. That turns accidental leaks into a schema question rather than a discipline question.

## Pydantic does the validating

\`\`\`python
from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class Signup(BaseModel):
    model_config = ConfigDict(from_attributes=True)   # serialise ORM rows directly

    email: EmailStr
    password: str = Field(min_length=8)
    password_confirm: str

    @field_validator("password")
    @classmethod
    def not_weak(cls, v: str) -> str:
        if v.isdigit():
            raise ValueError("Password cannot be all digits")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError("Passwords do not match")
        return self
\`\`\`

\`field_validator\` is per field, \`model_validator(mode="after")\` runs once every field has passed — the same split as Zod's \`.refine()\` on a field versus on the whole object. Pydantic v2's core is compiled Rust, so this is fast enough to sit in the hot path.

## Dependency injection

\`Depends\` is FastAPI's best idea, and it is Nest's provider system with none of the decorators. A dependency is any callable; FastAPI resolves it, caches it **per request**, and injects the result.

\`\`\`python
from typing import Annotated
from fastapi import Depends


def get_db():
    db = SessionLocal()
    try:
        yield db                      # everything after yield runs after the response
    finally:
        db.close()


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    user = decode_and_load(db, token)
    if user is None:
        raise HTTPException(401, "Invalid credentials", headers={"WWW-Authenticate": "Bearer"})
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


@app.get("/me")
def me(user: CurrentUser):
    return user


@app.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: int, user: CurrentUser, db: Annotated[Session, Depends(get_db)]):
    ...
\`\`\`

Three properties make this more than syntax sugar:

1. **Sub-dependencies.** \`get_current_user\` itself depends on \`get_db\`. FastAPI builds the whole graph.
2. **Per-request caching.** \`get_db\` appears twice in \`delete_post\`'s graph and is called **once** — you get one session, not two.
3. **Overridable in tests.** \`app.dependency_overrides[get_db] = lambda: test_session\` swaps the real database for a fixture with no monkey-patching.

Dependencies that only guard (\`Depends(require_admin)\` with no return value) go in the decorator: \`@app.get("/admin", dependencies=[Depends(require_admin)])\` — the direct analogue of a Nest guard or an Express middleware.

## Async and background tasks

\`\`\`python
import asyncio
import httpx
from fastapi import BackgroundTasks


@app.get("/dashboard")
async def dashboard(user: CurrentUser):
    async with httpx.AsyncClient() as client:
        billing, usage = await asyncio.gather(
            client.get(f"{BILLING}/customers/{user.id}"),
            client.get(f"{METRICS}/usage/{user.id}"),
        )
    return {"billing": billing.json(), "usage": usage.json()}


@app.post("/posts/{post_id}/publish", status_code=202)
def publish(post_id: int, tasks: BackgroundTasks):
    post = repo.publish(post_id)
    tasks.add_task(send_notification_emails, post.id)   # runs after the response is sent
    return {"status": "publishing"}
\`\`\`

\`asyncio.gather\` is \`Promise.all\`: two fan-out calls that took 300 ms sequentially take 150 ms. \`BackgroundTasks\` is for short, fire-and-forget work in the same process — if it must survive a restart or take more than a second or two, use Celery, RQ or Arq, exactly as you would reach for BullMQ in Node.

## Free OpenAPI

Every app serves \`/docs\` (Swagger UI), \`/redoc\` and \`/openapi.json\`, generated from your annotations and always in sync with the code. Point \`openapi-typescript\` at that URL and your TypeScript frontend gets typed client types from the same source of truth — which is, in practice, the strongest argument for FastAPI when a Python service has to sit inside a TypeScript organisation.

Reach for FastAPI when you are building an API rather than a website, when the workload is I/O fan-out, when you are serving ML models (the ecosystem lives in Python), or when you want an OpenAPI contract without maintaining one by hand. Reach for the next lesson's framework when you want a website with a back office.`,
    },
    {
      slug: 'django-in-one-lesson',
      title: 'Django in One Lesson — Models, Migrations, DRF and the Admin',
      estimatedMinutes: 85,
      body: `# Django in One Lesson — Models, Migrations, DRF and the Admin

Django's pitch is *batteries included*: ORM, migrations, auth, admin, sessions, CSRF, forms, templates, i18n and a management CLI, in one coherent box. You trade flexibility for not writing any of it. Nothing in the Node ecosystem is comparable in scope, which is why Django keeps winning briefs that a JavaScript stack would lose.

## Project and app layout

\`\`\`bash
django-admin startproject config .    # the trailing dot avoids a nested folder
python manage.py startapp blog
\`\`\`

\`\`\`
manage.py            # the CLI entry point
config/
  settings.py        # one module, everything configurable
  urls.py            # root URLconf
  wsgi.py  asgi.py   # the two server entry points
blog/
  models.py  views.py  urls.py  admin.py  apps.py
  migrations/
\`\`\`

A **project** is the deployable; an **app** is a reusable feature module — \`blog\`, \`billing\`, \`accounts\`. Every app must be listed in \`INSTALLED_APPS\` or Django will not see its models, migrations or admin registrations.

## Models are the source of truth

\`\`\`python
# blog/models.py
from django.conf import settings
from django.db import models


class Post(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DR", "Draft"
        PUBLISHED = "PB", "Published"

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    body = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    tags = models.ManyToManyField("Tag", blank=True, related_name="posts")
    status = models.CharField(max_length=2, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self) -> str:
        return self.title
\`\`\`

\`on_delete\` is required and it is a real decision: \`CASCADE\` (delete the posts), \`PROTECT\` (refuse to delete the author), \`SET_NULL\` (orphan them, needs \`null=True\`). \`related_name\` is what gives you the reverse accessor \`user.posts.all()\`.

## Migrations

\`\`\`bash
python manage.py makemigrations blog    # diff models vs migration history -> a file
python manage.py sqlmigrate blog 0002   # show the SQL. Read it before you run it.
python manage.py migrate                # apply
python manage.py migrate blog 0001      # roll back to a specific migration
\`\`\`

Migrations are **generated, reviewed and committed** Python files — the same contract as \`prisma migrate\` or \`drizzle-kit generate\`, with the same two production rules. Never edit an applied migration; write a new one. And when adding a non-nullable column to a populated table, do it in three steps — add nullable, backfill in a \`RunPython\` data migration, then make it non-null — or the deploy locks the table and fails.

## QuerySets are lazy, and that is where N+1 lives

\`\`\`python
posts = Post.objects.filter(status=Post.Status.PUBLISHED)   # no SQL yet
posts = posts.exclude(author__is_active=False)              # still no SQL
for p in posts[:10]:                                        # NOW it runs
    print(p.title, p.author.email)                          # ...and 10 more queries
\`\`\`

That loop is 11 queries — Day 23's N+1, in a different spelling. The fix is explicit prefetching:

\`\`\`python
Post.objects.select_related("author")            # SQL JOIN, for FK / OneToOne
Post.objects.prefetch_related("tags")            # 2nd query + Python join, for M2M / reverse FK
Post.objects.only("id", "title")                 # narrow the SELECT
Post.objects.annotate(comment_count=models.Count("comments"))  # aggregate in SQL
\`\`\`

\`select_related\` for "one thing", \`prefetch_related\` for "many things". Install \`django-debug-toolbar\` in development; watching the query count on a page is the fastest way to learn the difference.

## The admin, in six lines

\`\`\`python
# blog/admin.py
from django.contrib import admin
from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("title", "body")
    prepopulated_fields = {"slug": ("title",)}
    list_select_related = ("author",)   # the admin has N+1 too
\`\`\`

Run \`python manage.py createsuperuser\` and you have a production-grade CRUD back office over every model, with search, filters, permissions and an audit log of changes. This is the single feature that most often decides "Django or Node", and it is why the answer is sometimes Django. Treat it as an internal staff tool — it is not a customer-facing UI.

## DRF: serializers, viewsets, routers

Django's own views render HTML. **Django REST Framework** adds the JSON API layer: serialisation, authentication, permissions, pagination, throttling and a browsable API.

\`\`\`python
class PostSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = Post
        fields = ["id", "title", "slug", "body", "status", "author_email", "created_at"]
        read_only_fields = ["id", "slug", "created_at"]

    def validate_title(self, value: str) -> str:
        if len(value.strip()) < 5:
            raise serializers.ValidationError("Title must be at least 5 characters.")
        return value.strip()
\`\`\`

Two habits worth forming now. Use explicit \`fields = [...]\` rather than \`__all__\` — \`__all__\` silently exposes any column a future migration adds, including \`is_staff\` or \`internal_notes\`, and if it is writable a client can set it. And use \`read_only_fields\` for anything the client must not control; a writable \`author\` is a mass-assignment vulnerability where any user can post as anyone. Inject trusted values at save time: \`serializer.save(author=request.user)\`.

\`\`\`python
class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def get_queryset(self):
        qs = Post.objects.select_related("author").prefetch_related("tags")
        if not self.request.user.is_staff:
            qs = qs.filter(status=Post.Status.PUBLISHED)
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, slug=None):
        post = self.get_object()            # runs object permissions
        post.status = Post.Status.PUBLISHED
        post.save(update_fields=["status"])
        return Response(self.get_serializer(post).data)
\`\`\`

\`get_queryset\` is the correct place for row-level scoping, because **every** action goes through it — \`retrieve\` on someone else's draft returns 404 rather than leaking it. Scoping in \`list\` only is the classic Broken Access Control bug.

\`\`\`python
router = DefaultRouter()
router.register(r"posts", PostViewSet, basename="post")
urlpatterns = [path("admin/", admin.site.urls), path("api/", include(router.urls))]
\`\`\`

That produces \`GET/POST /api/posts/\`, \`GET/PUT/PATCH/DELETE /api/posts/{slug}/\` and \`POST /api/posts/{slug}/publish/\`. Note the trailing slashes — Django's convention, and \`APPEND_SLASH\` will 301-redirect clients that omit them, which silently turns a POST body into a GET. Tell your frontend team.

Finally, set defaults globally and deny by default: \`"DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"]\` plus a \`DEFAULT_PAGINATION_CLASS\` on day one, because an unpaginated list endpoint is a table scan waiting for your first ten thousand rows. And never ship with \`DEBUG = True\`: it leaks your settings, your SQL and your stack traces on every error page, and it is the most common Django security incident there is.

## When Django beats a JS stack

The domain is relational, staff need a back office on day one, you need auth, roles and permissions immediately, and the shape of the product is content plus workflow rather than realtime interaction. Pair it with \`drf-spectacular\` and you get the OpenAPI schema FastAPI gives you for free. Where Django loses is async-heavy I/O fan-out, anything realtime, and teams who would rather share types with the frontend than learn a second ecosystem.`,
    },
    {
      slug: 'go-for-backend',
      title: 'Go — Goroutines, Channels, net/http, Gin and One Binary',
      estimatedMinutes: 85,
      body: `# Go — Goroutines, Channels, net/http, Gin and One Binary

Go was designed at Google to make network servers boring. Small language, fast compiler, one binary out the other end.

## Structs and interfaces

Go has no classes and no inheritance. You have structs for data and interfaces for behaviour, and interfaces are satisfied **implicitly** — there is no \`implements\` keyword. If you have used TypeScript's structural typing, this will feel familiar; the difference is that Go checks it at compile time with no escape hatch.

\`\`\`go
type Task struct {
    ID    int    \`json:"id"\`
    Title string \`json:"title"\`
    Done  bool   \`json:"done"\`
}

// The consumer defines the interface it needs.
type TaskStore interface {
    List(ctx context.Context) ([]Task, error)
    Add(ctx context.Context, t Task) (Task, error)
}

type MemoryStore struct {
    mu    sync.Mutex
    tasks []Task
}

func (s *MemoryStore) Add(ctx context.Context, t Task) (Task, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    t.ID = len(s.tasks) + 1
    s.tasks = append(s.tasks, t)
    return t, nil
}
\`\`\`

\`*MemoryStore\` satisfies \`TaskStore\` simply by having the right methods. The convention that follows is "accept interfaces, return structs": the **package that uses** an interface declares it, and keeps it small.

## Errors are values

There are no exceptions. Functions return \`(result, error)\` and you check it, every time.

\`\`\`go
func loadConfig(path string) (Config, error) {
    b, err := os.ReadFile(path)
    if err != nil {
        return Config{}, fmt.Errorf("read config %s: %w", path, err)
    }
    var c Config
    if err := json.Unmarshal(b, &c); err != nil {
        return Config{}, fmt.Errorf("parse config: %w", err)
    }
    return c, nil
}

// %w wraps, so callers can walk the chain:
if errors.Is(err, os.ErrNotExist) { /* ... */ }
\`\`\`

The verbosity is the point: every failure path is visible in the code you read, not hidden in a stack unwind. Use \`%w\` rather than \`%v\` when you wrap — \`%v\` keeps the message text but throws away the cause, so \`errors.Is\` stops working.

## Goroutines and channels

A **goroutine** is a function scheduled onto an OS thread by the Go runtime. It starts at ~2 KB of stack and grows on demand, so hundreds of thousands are routine — this is the part with no Node equivalent at all.

\`\`\`go
go doWork()   // that is the entire syntax
\`\`\`

Coordinating them is done with **channels**, typed pipes with a happens-before guarantee:

\`\`\`go
package main

import (
    "fmt"
    "sync"
)

func worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for j := range jobs {          // ranges until the channel is closed
        results <- j * j
    }
}

func main() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)
    var wg sync.WaitGroup

    for w := 1; w <= 3; w++ {      // a fixed worker pool
        wg.Add(1)
        go worker(w, jobs, results, &wg)
    }

    for i := 1; i <= 9; i++ { jobs <- i }
    close(jobs)                     // tells the workers no more input is coming

    wg.Wait()
    close(results)

    sum := 0
    for r := range results { sum += r }
    fmt.Println(sum)                // 285
}
\`\`\`

Note the directional types: \`<-chan int\` is receive-only, \`chan<- int\` is send-only, and the compiler enforces the direction. \`select\` multiplexes channels and is how you implement timeouts:

\`\`\`go
select {
case res := <-work:
    return res, nil
case <-ctx.Done():
    return nil, ctx.Err()          // cancelled or deadline exceeded
}
\`\`\`

> Rules that save you: **the sender closes the channel, never the receiver**; sending on a closed channel panics; receiving from a closed channel returns the zero value immediately, which is exactly what terminates a \`for range\`. An unbuffered channel blocks the sender until a receiver is ready — that is a feature. Run your tests with \`go test -race\`.

Today's middle problem models this pattern in JavaScript: a fixed pool of workers pulling from a shared job channel with a bounded number in flight. Writing it is the fastest way to feel what the Go version is doing.

## net/http is a real server

\`\`\`go
mux := http.NewServeMux()
mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
})

srv := &http.Server{Addr: ":8080", Handler: mux,
    ReadHeaderTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second}
log.Fatal(srv.ListenAndServe())
\`\`\`

Since Go 1.22 the standard mux understands \`"GET /tasks/{id}"\` with \`r.PathValue("id")\`, which removes most of the reason to add a router at all. **Always set timeouts** — the zero value means "wait forever", and that is how a slow client exhausts your file descriptors.

## Gin when you want batteries

\`\`\`go
r := gin.Default()               // Logger + Recovery middleware
r.Use(func(c *gin.Context) { c.Set("requestID", uuid.NewString()); c.Next() })

api := r.Group("/api")
api.POST("/tasks", func(c *gin.Context) {
    var body struct {
        Title string \`json:"title" binding:"required,max=200"\`
    }
    if err := c.ShouldBindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    t, _ := store.Add(c.Request.Context(), Task{Title: body.Title})
    c.JSON(http.StatusCreated, t)
})

r.Run(":8080")
\`\`\`

\`binding:"required,max=200"\` runs go-playground/validator — the Zod of this ecosystem. Note that \`c.JSON\` does **not** end the handler: forgetting the \`return\` after it is the single most common Gin bug, because the handler keeps executing and you write two responses.

## The deploy story

\`\`\`bash
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server
\`\`\`

That produces one static binary with no runtime and no interpreter. The container becomes:

\`\`\`dockerfile
FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=build /server /server
ENTRYPOINT ["/server"]
\`\`\`

A ~15 MB image with a tiny attack surface that starts in milliseconds. This, more than the language itself, is why Go dominates infrastructure tooling.

## Choosing between the three

| | Node.js / TypeScript | Python | Go |
| --- | --- | --- | --- |
| **Runtime model** | single-threaded event loop, V8 JIT | interpreted CPython, one bytecode thread per process (GIL) | compiled to a static native binary |
| **Concurrency** | async I/O on one loop; \`worker_threads\` for CPU | \`asyncio\` or threads (GIL-bound); processes for CPU | goroutines + channels on an M:N scheduler |
| **Typing** | dynamic; TypeScript is compile-time only and erased at runtime | dynamic; hints unenforced unless something like Pydantic reads them | static and structural, enforced by the compiler |
| **Startup time** | ~50 ms | ~50 ms, much more once you import a big ML stack | ~5 ms |
| **Deploy artefact** | source or a bundle, plus \`node_modules\` and a runtime | source, a virtualenv and an interpreter | one static binary, \`FROM scratch\` works |
| **Best-fit workload** | I/O-heavy APIs, realtime, BFFs, shared-language teams | data pipelines, ML serving, scripting, admin-heavy products | infrastructure, proxies, CLIs, high-concurrency low-latency services |

Decide from the constraints, not the language. If the work is mostly waiting on other systems, all three are fast enough. If it is CPU-bound, Go is the obvious answer and the other two need a queue or a worker process. If the library you need lives in one ecosystem, that decides it. And a team fluent in TypeScript will ship a better Node service than a mediocre Go one — familiarity beats benchmark charts in almost every real project. Two languages is a strategy; five is an accident, because every extra runtime is another CI pipeline, base image, scanning story and on-call runbook.

Notice, finally, how much of this course transfers unchanged. Layered architecture — handler, service, repository — is the same in Express, NestJS, FastAPI, Django and Go. The N+1 query problem is identical in Prisma, Drizzle, the Django ORM and any Go query builder, and the fix is always an explicit eager load. Dependency injection is a Nest provider, a FastAPI \`Depends\`, or in Go simply "pass it into the constructor". Learn those once and the syntax becomes a weekend's work.`,
    },
  ],
  quiz: [
    {
      prompt: 'What is the practical difference between WSGI and ASGI?',
      options: [
        'ASGI is a faster serialisation format for JSON responses',
        'WSGI is synchronous and one-request-per-worker; ASGI is async and supports WebSockets and lifespan events',
        'WSGI supports HTTP/2 while ASGI does not',
        'They are interchangeable names for the same specification',
      ],
      correctIndex: 1,
      explanation:
        'WSGI is a blocking `application(environ, start_response)` callable, so concurrency comes from more processes or threads. ASGI is `async def app(scope, receive, send)`, runs on an event loop, and its `scope["type"]` lets it carry websocket and lifespan events too.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Inside an `async def` FastAPI endpoint you call `time.sleep(2)`. What happens?',
      options: [
        'Only that request waits two seconds',
        'FastAPI automatically moves the call to a thread',
        'The event loop is blocked, stalling every other request on that worker',
        'The request is rejected with a 500 error',
      ],
      correctIndex: 2,
      explanation:
        'A blocking call in async code holds the event loop, so all concurrent requests on that process stall — the same failure as blocking Node’s loop. Use `await asyncio.sleep`, an async client such as httpx, `asyncio.to_thread`, or declare the handler as a plain `def` so FastAPI uses its threadpool.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does FastAPI’s `response_model` actually do at runtime?',
      options: [
        'Only documents the response shape in OpenAPI',
        'Validates and filters the returned object, dropping any field not declared on the model',
        'Caches the response for subsequent requests',
        'Converts the response to XML if requested',
      ],
      correctIndex: 1,
      explanation:
        'The return value is validated and serialised through the model, so undeclared fields such as `hashed_password` never leave the process. It documents the endpoint as a side effect, but the filtering is the real security value.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Two dependencies in one FastAPI endpoint’s graph both depend on `get_db`. How many times is `get_db` called for that request?',
      options: [
        'Once — dependency results are cached per request',
        'Twice, once per dependent',
        'Once per worker process, at startup',
        'It depends on whether the endpoint is async',
      ],
      correctIndex: 0,
      explanation:
        'FastAPI resolves the dependency graph and caches each dependency’s result for the duration of the request, so you get exactly one database session. Pass `Depends(fn, use_cache=False)` on the rare occasion you want a fresh one.',
      difficulty: 'HARD',
    },
    {
      prompt: 'When should you use `prefetch_related` instead of `select_related` in Django?',
      options: [
        'When following a ForeignKey to a single related row',
        'When you only need a subset of columns',
        'When the queryset must be evaluated lazily',
        'When following a many-to-many or reverse foreign key to many rows',
      ],
      correctIndex: 3,
      explanation:
        '`select_related` performs a SQL JOIN and works for single-valued relations (FK, OneToOne). `prefetch_related` issues a second query and joins in Python, which is what multi-valued relations (M2M, reverse FK) need.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'A DRF viewset must only ever expose rows belonging to the current tenant. Where does that filter belong?',
      options: [
        'In the `list` action only',
        'In the serializer’s `validate` method',
        'In `get_queryset`, so every action is scoped',
        'In a frontend query parameter',
      ],
      correctIndex: 2,
      explanation:
        'Every action — retrieve, update, destroy and the custom ones — resolves objects through `get_queryset`. Filtering there means another tenant’s ID returns 404 instead of leaking. Scoping `list` alone is the textbook Broken Access Control bug.',
      difficulty: 'HARD',
    },
    {
      prompt: 'In Go, which statement about channels is correct?',
      options: [
        'The receiver should close the channel when it is done reading',
        'The sender closes the channel; sending on a closed channel panics, and receiving from one returns the zero value immediately',
        'Closing a channel is optional and has no observable effect on `range`',
        'Buffered channels never block the sender',
      ],
      correctIndex: 1,
      explanation:
        'Closing is the sender’s job because only the sender knows there is no more data. `for range` over a channel terminates exactly when the channel is closed, and a buffered channel still blocks once its buffer is full.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What makes Go attractive for containerised deployment specifically?',
      options: [
        '`CGO_ENABLED=0 go build` produces a single static binary that runs on a distroless/scratch base image with no runtime installed',
        'Go containers get priority scheduling in Kubernetes',
        'Go images are automatically multi-architecture',
        'Go does not need a Dockerfile',
      ],
      correctIndex: 0,
      explanation:
        'No interpreter, no virtualenv, no node_modules layer — a statically linked binary copied into a distroless image gives you a tiny attack surface, a small image and millisecond startup, which matters most for scale-to-zero and sidecars.',
      difficulty: 'EASY',
    },
  ],
  problems: [
    {
      slug: 'pagination-param-validator-py',
      title: 'Pagination Parameter Validator (Python)',
      difficulty: 'MEDIUM',
      runtime: 'remote',
      language: 'python',
      statement: `Every list endpoint you will ever write starts with the same job: take untrusted query-string values, coerce them, bound them, and turn them into an offset. FastAPI's \`Query(ge=1, le=100)\` and DRF's pagination classes both do exactly this — write it by hand once so you know what they are doing.

Read a **single line** from standard input: a raw query string such as \`page=3&limit=10\`. Print exactly one line.

### Rules

Defaults: \`page = 1\`, \`limit = 20\`. Unknown keys are ignored. A duplicated key takes its **last** value.

Validate in this order and print the **first** failure:

| Order | Condition | Output |
| --- | --- | --- |
| 1 | \`page\` is not an integer | \`error:page must be an integer\` |
| 2 | \`page < 1\` | \`error:page must be >= 1\` |
| 3 | \`limit\` is not an integer | \`error:limit must be an integer\` |
| 4 | \`limit < 1\` or \`limit > 100\` | \`error:limit must be between 1 and 100\` |

On success print:

\`\`\`
offset=<(page - 1) * limit> limit=<limit>
\`\`\`

### Examples

| stdin | stdout |
| --- | --- |
| \`page=3&limit=10\` | \`offset=20 limit=10\` |
| \`page=1\` | \`offset=0 limit=20\` |
| \`limit=200\` | \`error:limit must be between 1 and 100\` |
| \`page=abc\` | \`error:page must be an integer\` |
| \`page=0&limit=50\` | \`error:page must be >= 1\` |

### Constraints

- Standard library only.
- Print nothing else — no prompts, no trailing text.`,
      starterCode: `import sys


def parse_query(raw: str) -> dict[str, str]:
    """Split "a=1&b=2" into {"a": "1", "b": "2"}. Last value wins."""
    # your code here
    return {}


def main() -> None:
    raw = sys.stdin.read().strip()
    params = parse_query(raw)
    # validate page, then limit, then print the offset line
    print("offset=0 limit=20")


main()`,
      solutionCode: `import sys


def parse_query(raw: str) -> dict[str, str]:
    params: dict[str, str] = {}
    for part in raw.split("&"):
        if not part or "=" not in part:
            continue
        key, value = part.split("=", 1)
        params[key.strip()] = value.strip()
    return params


def main() -> None:
    raw = sys.stdin.read().strip()
    params = parse_query(raw)

    try:
        page = int(params.get("page", "1"))
    except ValueError:
        print("error:page must be an integer")
        return

    if page < 1:
        print("error:page must be >= 1")
        return

    try:
        limit = int(params.get("limit", "20"))
    except ValueError:
        print("error:limit must be an integer")
        return

    if limit < 1 or limit > 100:
        print("error:limit must be between 1 and 100")
        return

    print(f"offset={(page - 1) * limit} limit={limit}")


main()`,
      hints: [
        'sys.stdin.read().strip() gives you the whole line; split it on & and then on the first = only.',
        'int("abc") raises ValueError - that try/except is the entire type-coercion story.',
        'Validate page fully (type, then range) before you look at limit, or the wrong message comes out first.',
        'offset is (page - 1) * limit, so page 1 always starts at 0.',
      ],
      tests: [
        { name: 'page=3&limit=10', assertion: 'offset=20 limit=10' },
        { name: 'page=1', assertion: 'offset=0 limit=20' },
        { name: 'limit=5', assertion: 'offset=0 limit=5' },
        { name: 'limit=100&page=2', assertion: 'offset=100 limit=100' },
        { name: 'page=abc', assertion: 'error:page must be an integer' },
        { name: 'page=0&limit=50', assertion: 'error:page must be >= 1' },
        { name: 'limit=200', assertion: 'error:limit must be between 1 and 100' },
        { name: 'limit=0', assertion: 'error:limit must be between 1 and 100', hidden: true },
        { name: 'limit=ten', assertion: 'error:limit must be an integer', hidden: true },
        { name: 'sort=title&page=2&limit=15', assertion: 'offset=15 limit=15', hidden: true },
      ],
      xp: 80,
    },
    {
      slug: 'worker-pool-channel',
      title: 'Worker Pool with a Channel (Go, in JavaScript)',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Model Go's worker-pool pattern — a \`jobs\` channel, N goroutines, a \`results\` channel — with async JavaScript. This one runs everywhere, so the day still works with no remote executor configured.

Implement \`workerPool(jobs, concurrency, handler)\`:

- \`jobs\` is an array of inputs; \`handler\` is an \`async\` function called with \`(job, index)\`.
- At most \`concurrency\` handlers may be in flight at any moment (this is the fixed pool of goroutines, and the backpressure a bounded channel gives you).
- Resolves with an array of results **in input order**, regardless of completion order.
- If a handler rejects, the returned promise rejects with that error.
- An empty \`jobs\` array resolves to \`[]\` without calling \`handler\`.

Also export \`trackConcurrency(handler)\` returning \`{ wrapped, peak }\`, where \`wrapped\` is a handler that records the maximum number of simultaneous in-flight calls in \`peak.value\`.

\`\`\`js
const { wrapped, peak } = trackConcurrency(async (n) => n * n);
const out = await workerPool([1,2,3,4,5,6,7,8,9], 3, wrapped);
// out        -> [1,4,9,16,25,36,49,64,81]
// peak.value -> at most 3
\`\`\``,
      starterCode: `async function workerPool(jobs, concurrency, handler) {
  // your code here
}

function trackConcurrency(handler) {
  // return { wrapped, peak }
}

module.exports = { workerPool, trackConcurrency };`,
      solutionCode: `async function workerPool(jobs, concurrency, handler) {
  const results = new Array(jobs.length);
  if (jobs.length === 0) return results;

  const limit = Math.max(1, Math.min(concurrency, jobs.length));
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;              // pull the next job off the "channel"
      if (i >= jobs.length) return;  // channel drained
      results[i] = await handler(jobs[i], i);
    }
  }

  const workers = [];
  for (let w = 0; w < limit; w++) workers.push(worker());
  await Promise.all(workers);        // the WaitGroup
  return results;
}

function trackConcurrency(handler) {
  const peak = { value: 0 };
  let inFlight = 0;

  const wrapped = async (...args) => {
    inFlight++;
    if (inFlight > peak.value) peak.value = inFlight;
    try {
      return await handler(...args);
    } finally {
      inFlight--;
    }
  };

  return { wrapped, peak };
}

module.exports = { workerPool, trackConcurrency };`,
      hints: [
        'A shared cursor `next` that each worker increments is the equivalent of receiving from a jobs channel.',
        'Start exactly `concurrency` worker loops and await Promise.all on them — that is the WaitGroup.',
        'Write into results[i] using the index you pulled, so completion order never affects output order.',
        'Promise.all rejects as soon as any worker throws, which gives you the error behaviour for free.',
      ],
      tests: [
        {
          name: 'returns results in input order',
          assertion:
            "await (async () => { const out = await solution.workerPool([1,2,3,4,5], 2, async (n) => n * 2); return deepEqual(out, [2,4,6,8,10]); })()",
        },
        {
          name: 'empty input resolves to []',
          assertion:
            "await (async () => { let called = 0; const out = await solution.workerPool([], 3, async () => { called++; }); return deepEqual(out, []) && called === 0; })()",
        },
        {
          name: 'order holds when later jobs finish first',
          assertion:
            "await (async () => { const delays = [30, 5, 20, 1]; const out = await solution.workerPool(delays, 4, async (d, i) => { await new Promise(r => setTimeout(r, d)); return i; }); return deepEqual(out, [0,1,2,3]); })()",
        },
        {
          name: 'never exceeds the concurrency limit',
          assertion:
            "await (async () => { const { wrapped, peak } = solution.trackConcurrency(async (n) => { await new Promise(r => setTimeout(r, 5)); return n; }); await solution.workerPool([1,2,3,4,5,6,7,8,9], 3, wrapped); return peak.value <= 3 && peak.value > 1; })()",
        },
        {
          name: 'handler index argument is correct',
          assertion:
            "await (async () => { const out = await solution.workerPool(['a','b','c'], 2, async (v, i) => v + i); return deepEqual(out, ['a0','b1','c2']); })()",
          hidden: true,
        },
        {
          name: 'a rejecting handler rejects the pool',
          assertion:
            "await (async () => { try { await solution.workerPool([1,2,3], 2, async (n) => { if (n === 2) throw new Error('boom'); return n; }); return false; } catch (e) { return e.message === 'boom'; } })()",
          hidden: true,
        },
      ],
      xp: 90,
    },
    {
      slug: 'go-sum-squares',
      title: 'Go: Sum of Squares via a Channel',
      difficulty: 'EASY',
      runtime: 'remote',
      language: 'go',
      statement: `Write a Go program that reads a single line of space-separated integers from stdin, squares each one **in a goroutine**, collects the squares through a channel, and prints the total.

Input: \`1 2 3 4\`
Output: \`30\`

Requirements:

- Use \`bufio\` (or \`fmt.Scan\`) to read the line.
- Fan the work out over goroutines and collect via a channel — do not just loop and add.
- Print the sum followed by a newline, nothing else.`,
      starterCode: `package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\\n')
	fields := strings.Fields(line)
	_ = fields
	_ = strconv.Atoi
	_ = fmt.Println
	// your code here
}`,
      solutionCode: `package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\\n')
	fields := strings.Fields(line)

	results := make(chan int, len(fields))
	var wg sync.WaitGroup

	for _, f := range fields {
		n, err := strconv.Atoi(f)
		if err != nil {
			continue
		}
		wg.Add(1)
		go func(v int) {
			defer wg.Done()
			results <- v * v
		}(n)
	}

	wg.Wait()
	close(results)

	sum := 0
	for r := range results {
		sum += r
	}
	fmt.Println(sum)
}`,
      hints: [
        'strings.Fields splits on any run of whitespace and drops empty tokens.',
        'Buffer the results channel with len(fields) so no goroutine blocks before you start reading.',
        'Use a sync.WaitGroup, then close the channel after Wait() so `for range` terminates.',
        'Pass the value into the goroutine as a parameter rather than capturing the loop variable.',
      ],
      tests: [
        { name: '1 2 3 4', assertion: '30' },
        { name: '5', assertion: '25' },
        { name: '10 -3 2', assertion: '113' },
        { name: '0 0 0', assertion: '0', hidden: true },
      ],
      xp: 50,
    },
  ],
  flashcards: [
    {
      front: 'How do you isolate a Python project’s dependencies?',
      back: '`python3 -m venv .venv` then `source .venv/bin/activate`. Commit `requirements.txt` (or a compiled lock from `pyproject.toml`); never commit `.venv/`.',
      tags: ['python', 'tooling'],
    },
    {
      front: 'WSGI vs ASGI',
      back: 'WSGI: `application(environ, start_response)`, synchronous, concurrency from processes/threads. ASGI: `async def app(scope, receive, send)`, event loop, supports WebSockets and lifespan events.',
      tags: ['python', 'architecture'],
    },
    {
      front: 'What breaks if you call a blocking function in an `async def` handler?',
      back: 'The whole event loop stalls, so every concurrent request on that worker waits. Use an async client, `asyncio.to_thread`, or declare the handler as a plain `def` so FastAPI uses its threadpool.',
      tags: ['python', 'async'],
    },
    {
      front: 'What does the GIL actually restrict?',
      back: 'One thread runs Python bytecode at a time per process. I/O is unaffected — the lock is released around socket and file waits. CPU-bound work needs `multiprocessing` or a task queue, never more threads.',
      tags: ['python', 'concurrency'],
    },
    {
      front: 'What does FastAPI’s `response_model` do?',
      back: 'Validates and *filters* the returned object — undeclared fields such as `hashed_password` are stripped before the response is sent — and documents the endpoint in OpenAPI.',
      tags: ['fastapi', 'security'],
    },
    {
      front: 'Three things `Depends` gives you',
      back: 'Sub-dependency graphs resolved automatically, per-request caching (one DB session no matter how many dependents), and `app.dependency_overrides` for tests.',
      tags: ['fastapi', 'di'],
    },
    {
      front: 'The Django migration workflow',
      back: '`makemigrations` diffs models against history into a committed file, `sqlmigrate` shows the SQL, `migrate` applies it. Never edit an applied migration — add a new one.',
      tags: ['django', 'migrations'],
    },
    {
      front: '`select_related` vs `prefetch_related`',
      back: '`select_related` = SQL JOIN for single-valued relations (FK, OneToOne). `prefetch_related` = second query joined in Python for multi-valued relations (M2M, reverse FK).',
      tags: ['django', 'orm', 'performance'],
    },
    {
      front: 'Why avoid `fields = "__all__"` in a DRF serializer?',
      back: 'Any column added later is silently exposed and possibly writable. Enumerate `fields` and lock down the rest with `read_only_fields`.',
      tags: ['django', 'drf', 'security'],
    },
    {
      front: 'Where does row-level scoping belong in a DRF ViewSet?',
      back: 'In `get_queryset`. Every action (retrieve, update, destroy, custom `@action`) resolves objects through it, so out-of-scope IDs return 404 instead of leaking.',
      tags: ['django', 'drf', 'security'],
    },
    {
      front: 'Who closes a Go channel, and what happens after?',
      back: 'The sender closes it. Sending on a closed channel panics; receiving returns the zero value immediately, which is what terminates `for x := range ch`.',
      tags: ['go', 'concurrency'],
    },
    {
      front: 'Why is Go the default for containers and CLIs?',
      back: '`CGO_ENABLED=0 go build` emits a single static binary. Copy it into distroless or scratch: ~15 MB image, no runtime, millisecond startup. Also `%w` in `fmt.Errorf` keeps error chains inspectable with `errors.Is`/`errors.As`.',
      tags: ['go', 'devops', 'errors'],
    },
  ],
  resources: [
    { label: 'FastAPI — Tutorial & User Guide', url: 'https://fastapi.tiangolo.com/tutorial/', kind: 'DOCS' },
    { label: 'Django documentation', url: 'https://docs.djangoproject.com/en/stable/', kind: 'DOCS' },
    { label: 'Django REST Framework', url: 'https://www.django-rest-framework.org/', kind: 'DOCS' },
    { label: 'A Tour of Go', url: 'https://go.dev/tour/', kind: 'DOCS' },
    { label: 'Effective Go', url: 'https://go.dev/doc/effective_go', kind: 'ARTICLE' },
  ],
};

export default day;
