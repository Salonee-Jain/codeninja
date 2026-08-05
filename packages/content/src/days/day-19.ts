import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 19,
  week: 3,
  pillar: 'BACKEND',
  title: 'NestJS — DI, Modules, Guards & Testing',
  summary: 'Structure, an IoC container and a real testing story on top of Node — and the price you pay for them.',
  estimatedMinutes: 330,
  objectives: [
    'Explain what NestJS adds on top of Express or Fastify, and what that structure costs you',
    'Wire providers through the IoC container with class, value and factory providers and custom tokens',
    'Choose between DEFAULT, REQUEST and TRANSIENT scopes and predict how scope bubbles up a dependency chain',
    'Design a module graph with imports, providers and exports, and know why a provider is private by default',
    'Validate request bodies with class-validator DTOs or a Zod pipe, and justify the choice',
    'Recite the request lifecycle in order and place middleware, guards, interceptors, pipes and filters in it',
    'Load configuration with @nestjs/config and wire TypeORM or Prisma through an async factory',
    'Write unit tests with Test.createTestingModule and mocked providers, plus an e2e test with supertest',
  ],
  technologies: ['NestJS', 'TypeScript', 'Node.js'],
  lessons: [
    {
      slug: 'why-nestjs',
      title: 'What Nest Buys You, and What It Costs',
      estimatedMinutes: 75,
      body: `# What Nest Buys You, and What It Costs

Express is a router with a middleware chain. That is its whole opinion. For a 200-line service that is a feature: nothing is in your way. For a 40,000-line service with eleven contributors it is a problem, because *every team invents its own layering*, and that layering is enforced by nothing but code review and hope.

NestJS is the opposite trade. It is a framework — Angular's architecture ported to the server — that ships an inversion-of-control container, a module system, a decorator-driven routing layer and a first-class testing story. You write less plumbing and more domain code, in exchange for learning a large amount of framework.

## Nest is not a server

This is the first thing people get wrong. Nest does not implement HTTP. It sits on an **adapter**, and the default adapter is Express:

\`\`\`ts
// main.ts — Express (default)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(3000);
}
bootstrap();
\`\`\`

Swap in Fastify and almost nothing else changes:

\`\`\`ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ logger: true }),
);
await app.listen(3000, '0.0.0.0');
\`\`\`

So "Nest vs Fastify" is a category error — Nest *runs on* Fastify. The real question is whether you want a framework at all. The catch is that any code reaching for the raw \`@Res()\` object, and any third-party middleware that assumes Express, has to be revisited when you switch adapters. Keep handlers adapter-agnostic (return values, do not touch \`res\`) and the swap is genuinely a one-line change.

## The comparison, honestly

| | Express | Fastify | NestJS |
| --- | --- | --- | --- |
| **Structure** | none; you invent it | none; plugins give encapsulation | enforced: modules, controllers, providers |
| **DI** | none — manual wiring, or a container you choose | none — plugin scope instead | built-in IoC container, constructor injection |
| **Testing** | roll your own; import the app and stub with module mocks | \`app.inject()\` for fast HTTP-less tests | \`Test.createTestingModule\` swaps any provider by token |
| **Boilerplate** | lowest | low | highest: modules, DTOs, decorators, barrel files |
| **Best team size** | 1–3, or a small internal service | 1–5, perf-sensitive services | 4+, or any codebase expected to outlive its authors |
| **Perf ceiling** | baseline | roughly 2–3x Express on trivial routes | its adapter's, minus a small per-request DI cost |

The row that decides it in practice is **team size**. Nest's real value is that a new hire can open any Nest repo in the world and already know where the code lives. That consistency is worth money at four engineers and worth nothing at one.

## What it actually costs

**Indirection.** A request enters a route you never wrote a call site for, passes through decorators that read metadata you cannot see, and lands in a class whose dependencies were constructed by a container. When it breaks, the stack trace goes through five \`node_modules\` frames first. You must be willing to read the framework.

**Build configuration.** Decorator metadata is not free. Nest needs:

\`\`\`json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2021",
    "strict": true
  }
}
\`\`\`

\`emitDecoratorMetadata\` is what lets Nest read a constructor parameter's *type* at runtime and resolve it. That is TypeScript-specific reflection: it does not exist in plain JavaScript, it requires \`reflect-metadata\`, and it is why swapping in a bundler that strips types without the matching decorator plugin produces the famously unhelpful \`Nest can't resolve dependencies of the FooService (?)\`.

**Startup and size.** Nest builds the entire module graph at boot. That is tens of milliseconds and a heavier dependency tree — fine for a long-lived container, worth measuring for a cold-started serverless function.

**Ceremony.** A single endpoint in Express is four lines. In Nest it is a controller, a service, a DTO and a module entry. That ceremony pays off at endpoint fifty, not endpoint one.

## The shape of a Nest app

\`\`\`ts
// tasks/tasks.controller.ts
import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  findAll() {
    return this.tasks.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tasks.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasks.create(dto);
  }
}
\`\`\`

Note what is missing: no \`req\`, no \`res\`, no \`next\`, no manual status codes, no try/catch. The handler returns a value and Nest serialises it. Throw a \`NotFoundException\` and it becomes a 404 with a JSON body. That is the whole pitch — the HTTP layer becomes declarative, and the class becomes something you can unit test with \`new TasksController(fakeService)\`.

> Rule of thumb: reach for Express when the service is small and its shape is obvious. Reach for Nest when you already know the codebase will grow a dozen modules and be maintained by people who did not write it.`,
    },
    {
      slug: 'ioc-container-and-modules',
      title: 'The IoC Container: Providers, Tokens, Scopes & Modules',
      estimatedMinutes: 90,
      body: `# The IoC Container: Providers, Tokens, Scopes & Modules

Inversion of control is one sentence: **a class declares what it needs and something else supplies it.** Everything else is mechanics.

\`\`\`ts
// Without DI: the service decides what it depends on, forever.
export class TasksService {
  private repo = new PostgresTaskRepository(process.env.DATABASE_URL!);
}

// With DI: the service declares a need. A container satisfies it.
@Injectable()
export class TasksService {
  constructor(private readonly repo: TaskRepository) {}
}
\`\`\`

The second version can be unit tested with \`new TasksService(fakeRepo)\` and never opens a socket. That is the entire payoff.

## How Nest resolves a constructor

\`@Injectable()\` does not "register" anything. It marks the class so TypeScript emits \`design:paramtypes\` metadata for its constructor. At boot Nest reads that array of types and, for each one, looks up a **provider** whose token matches. The token for a class is the class itself.

## The provider forms

\`\`\`ts
@Module({
  providers: [
    // 1. shorthand for { provide: TasksService, useClass: TasksService }
    TasksService,

    // 2. useClass — swap the implementation behind an abstract token
    { provide: TaskRepository, useClass: PostgresTaskRepository },

    // 3. useValue — a constant, a config object, a test double
    { provide: 'CLOCK', useValue: { now: () => new Date() } },

    // 4. useFactory — computed, and may itself have dependencies
    {
      provide: 'DB_POOL',
      useFactory: (config: ConfigService) =>
        new Pool({ connectionString: config.getOrThrow('DATABASE_URL') }),
      inject: [ConfigService],
    },

    // 5. useExisting — an alias to an already-registered provider
    { provide: 'LegacyLogger', useExisting: AppLogger },
  ],
})
export class TasksModule {}
\`\`\`

## Tokens that are not classes

Interfaces vanish at compile time, so \`constructor(private repo: ITaskRepository)\` cannot work — there is no runtime value to look up. Use an explicit token and \`@Inject\`:

\`\`\`ts
export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');

@Injectable()
export class TasksService {
  constructor(@Inject(TASK_REPOSITORY) private readonly repo: TaskRepository) {}
}
\`\`\`

Prefer a \`Symbol\` or an exported \`const\` over a bare string. Two libraries both using \`'CONFIG'\` will silently collide; two Symbols never will.

## Scopes, and how they bubble

| Scope | Instances | Use when |
| --- | --- | --- |
| \`Scope.DEFAULT\` | one per application (singleton) | almost always |
| \`Scope.REQUEST\` | one per incoming request | you need per-request state: tenant, request id |
| \`Scope.TRANSIENT\` | a fresh one for every consumer | stateful helpers, e.g. a logger bound to its owner |

\`\`\`ts
@Injectable({ scope: Scope.REQUEST })
export class RequestContext {
  constructor(@Inject(REQUEST) private readonly req: Request) {}
  get tenantId() {
    return this.req.headers['x-tenant-id'] as string;
  }
}
\`\`\`

The gotcha that costs people a day: **scope bubbles upward.** If \`TasksService\` injects a REQUEST-scoped provider, \`TasksService\` becomes request-scoped too, and so does every controller that injects it. You have just moved from constructing that subtree once at boot to constructing it on every request. Measure before you sprinkle \`Scope.REQUEST\` around; \`AsyncLocalStorage\` is often the cheaper answer.

The mirror-image gotcha: injecting a TRANSIENT provider into a singleton gives you exactly **one** instance — the one created when the singleton was built. "Transient" means a new instance per *consumer*, not per *call*.

## Circular dependencies

If \`UsersService\` needs \`TasksService\` and \`TasksService\` needs \`UsersService\`, one of them is \`undefined\` at construction time. Nest offers \`forwardRef\` on both sides:

\`\`\`ts
@Injectable()
export class TasksService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
  ) {}
}
\`\`\`

Modules need the same treatment: \`imports: [forwardRef(() => UsersModule)]\`. But treat \`forwardRef\` as a smell, not a solution. A cycle almost always means a third concept is hiding inside one of the two classes — extract it into a module both can depend on, or move the interaction to an event.

## Modules and the visibility graph

A module has four lists, and their meanings are not symmetrical:

\`\`\`ts
@Module({
  imports: [TypeOrmModule.forFeature([Task]), UsersModule],
  controllers: [TasksController],
  providers: [
    TasksService,
    { provide: TASK_REPOSITORY, useClass: TypeOrmTaskRepository },
  ],
  exports: [TasksService],
})
export class TasksModule {}
\`\`\`

- **\`providers\`** — instantiable inside *this* module only. This is the part people miss: **a provider is private by default.**
- **\`exports\`** — the subset of providers other modules may see after importing this one. You may also re-export an imported module, which forwards *its* exports.
- **\`imports\`** — makes another module's exports visible here. Imports are not transitive: if A imports B and B imports C, A sees C's providers only if B re-exports C.
- **\`controllers\`** — route classes. Never exported; they are endpoints, not dependencies.

Those rules are the source of the most common Nest error message, \`Nest can't resolve dependencies of X\`. Nine times out of ten the provider exists but is missing from the *exports* array of the module you imported.

\`@Global()\` puts a module's exports in scope everywhere once it has been imported a single time, which is right for a config or logger module and wrong for anything domain-shaped.

## Dynamic modules

A module that needs configuration exposes a static method returning a module definition:

\`\`\`ts
@Module({})
export class StorageModule {
  static register(options: StorageOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        { provide: STORAGE_OPTIONS, useValue: options },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}

// consumer
@Module({ imports: [StorageModule.register({ bucket: 'uploads' })] })
export class AppModule {}
\`\`\`

The convention is \`forRoot\` for once-per-app configuration, \`forFeature\` for per-module registration, and a \`forRootAsync({ useFactory, inject })\` variant for when the options must themselves come from the container.`,
    },
    {
      slug: 'controllers-dtos-and-lifecycle',
      title: 'Controllers, DTOs and the Request Lifecycle',
      estimatedMinutes: 90,
      body: `# Controllers, DTOs and the Request Lifecycle

## Decorators are metadata, not behaviour

\`@Get(':id')\` does not register a route when the file is imported. It attaches metadata to the class method. At boot, Nest walks every controller in the module graph, reads that metadata, and builds the router. This is worth internalising because it explains every "my route 404s" bug: the controller is not in a \`controllers\` array of a module that is actually reachable from \`AppModule\`.

\`\`\`ts
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  findAll(@Query() query: ListTasksDto) {
    return this.tasks.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tasks.findOne(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateTaskDto, @Headers('x-request-id') requestId?: string) {
    return this.tasks.create(dto, requestId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasks.remove(id);
  }
}
\`\`\`

Route matching is order-dependent within a controller: declare \`@Get('search')\` **before** \`@Get(':id')\` or \`search\` is swallowed as an id.

> The moment you inject \`@Res()\` you take over the response and Nest stops serialising your return value — and you lose adapter portability. Use \`@Res({ passthrough: true })\` if you only need to set a cookie or a header.

## DTOs with class-validator

A DTO is a class, not an interface, because it must survive to runtime for the validator to read its decorators.

\`\`\`ts
import { IsString, IsInt, IsOptional, IsIn, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  @Length(1, 120)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsIn(['low', 'normal', 'high'])
  priority!: 'low' | 'normal' | 'high';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId?: number;
}
\`\`\`

\`\`\`ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // strip properties with no decorator
    forbidNonWhitelisted: true, // 400 if the client sent extras
    transform: true,            // produce a real CreateTaskDto instance
    transformOptions: { enableImplicitConversion: false },
  }),
);
\`\`\`

\`whitelist: true\` is a security control, not a nicety — without it a body containing \`{"role":"admin"}\` reaches your service, and any code that later spreads the DTO into an entity has just been mass-assigned. \`@Type(() => Number)\` is required for query and param values because everything arriving in a URL is a string; leave it off and \`@IsInt()\` fails on \`"3"\`.

## The Zod alternative

class-validator ties validation to classes and to decorator metadata. Zod keeps the schema as a value, gives you \`z.infer\` for free, and lets you share the exact same schema with the browser. The bridge is a ten-line pipe:

\`\`\`ts
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    return result.data;
  }
}
\`\`\`

\`\`\`ts
export const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  priority: z.enum(['low', 'normal', 'high']),
  projectId: z.coerce.number().int().positive().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

@Post()
@UsePipes(new ZodValidationPipe(createTaskSchema))
create(@Body() dto: CreateTaskInput) {
  return this.tasks.create(dto);
}
\`\`\`

| | class-validator | Zod |
| --- | --- | --- |
| Source of truth | a decorated class | a schema value |
| Types | hand-written on the class | inferred with \`z.infer\` |
| Share with the browser | awkward — the decorators come too | trivial, it is a plain module |
| Nest integration | built into \`ValidationPipe\` | one custom pipe |
| Transforms and coercion | class-transformer, separately | \`.transform()\` and \`z.coerce\`, same object |

Pick one and use it everywhere. Two validation systems in one codebase is how you end up with an endpoint validated twice and another validated zero times.

## The request lifecycle, in order

This is the single most useful thing to memorise about Nest:

1. **Middleware** — global first, then module-bound (\`configure(consumer)\`).
2. **Guards** — global, then controller, then route.
3. **Interceptors** — pre-handler half: global, controller, route.
4. **Pipes** — global, controller, route, then per-parameter pipes.
5. **The handler**, and the services it calls.
6. **Interceptors** — post-handler half, unwinding in reverse: route, controller, global.
7. **Exception filters** — route, then controller, then global, if anything above threw.
8. Response.

Two consequences fall straight out of that ordering:

- **Guards run before pipes.** So a guard sees the *raw, unvalidated* body. Never authorise on \`req.body.userId\`; authorise on the verified token.
- **A filter catches anything thrown by a guard, pipe, interceptor or handler.** One global filter is enough to guarantee you never leak a stack trace.

\`\`\`ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return !!user && required.includes(user.role);
  }
}
\`\`\`

\`\`\`ts
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    return next.handle().pipe(map((data) => ({ data, tookMs: Date.now() - started })));
  }
}
\`\`\`

\`\`\`ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    res.status(status).json({
      error: {
        code: status,
        message:
          exception instanceof HttpException
            ? exception.getResponse()
            : 'Internal server error',
      },
    });
  }
}
\`\`\`

## Middleware vs interceptors

They look similar and are not.

| | Middleware | Interceptor |
| --- | --- | --- |
| Runs | before guards, before routing is resolved | after guards, wrapped around the handler |
| Sees | raw \`req\` / \`res\` / \`next\` | the \`ExecutionContext\` — the class and method about to run |
| Can see the return value | no | **yes** — it wraps the handler's stream |
| Can be injected with providers | yes, if it is a class | yes |
| Adapter-specific | yes — it *is* Express or Fastify middleware | no |

Use middleware for things that are genuinely about the transport: raw-body capture for webhook signature checks, \`helmet\`, request-id assignment. Use interceptors for anything that needs to know which handler ran or wants to touch the response: envelope shaping, caching, timeouts (\`timeout(5000)\`), audit logging.`,
    },
    {
      slug: 'config-persistence-and-testing',
      title: 'Configuration, Persistence & Testing',
      estimatedMinutes: 75,
      body: `# Configuration, Persistence & Testing

## Configuration you cannot boot without

\`process.env.DATABASE_URL!\` scattered through twenty files is how you find out in production that a variable is missing. \`@nestjs/config\` centralises it and, more importantly, lets you **fail at boot**.

\`\`\`ts
// config/app.config.ts
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: { url: process.env.DATABASE_URL },
  jwt: { secret: process.env.JWT_SECRET, ttl: process.env.JWT_TTL ?? '15m' },
});
\`\`\`

\`\`\`ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig],
      validate: (raw) => envSchema.parse(raw),
    }),
  ],
})
export class AppModule {}
\`\`\`

If \`JWT_SECRET\` is missing the process exits during \`NestFactory.create\`, with a message naming the variable. That is worth more than any amount of defensive coding downstream.

\`\`\`ts
@Injectable()
export class TokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('jwt.secret');
  }
}
\`\`\`

Prefer \`getOrThrow\` over \`get\` — \`get\` returns \`undefined\`, and you will happily sign tokens with it.

## Persistence: TypeORM

The pattern that matters is \`forRootAsync\`, so the connection is built *from the container* rather than from \`process.env\` directly:

\`\`\`ts
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('database.url'),
        autoLoadEntities: true,
        synchronize: false, // never true outside a scratch database
        migrationsRun: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
\`\`\`

\`\`\`ts
@Module({
  imports: [TypeOrmModule.forFeature([Task])],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private readonly repo: Repository<Task>) {}

  findAll(projectId: number) {
    return this.repo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
\`\`\`

\`forFeature\` registers repository providers *for that module only* — another module that wants \`Repository<Task>\` must call \`forFeature([Task])\` itself, or import a module that exports a service wrapping it. The second is usually the better design.

## Persistence: Prisma

Prisma has no official Nest module, and does not need one. The whole integration is a provider with two lifecycle hooks:

\`\`\`ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
\`\`\`

\`\`\`ts
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(projectId: number) {
    return this.prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
\`\`\`

| | TypeORM | Prisma |
| --- | --- | --- |
| Schema source | decorated entity classes | \`schema.prisma\` |
| Types | you write them | fully generated |
| Nest fit | official \`@nestjs/typeorm\` module | a plain provider |
| Repository pattern | built in | you write a thin service |
| Migrations | generated from an entity diff | generated from a schema diff |

Either is fine. What is not fine is calling the ORM from a controller.

## Testing: the reason for all of this

\`Test.createTestingModule\` builds a real container in which you can replace *any* provider by its token. That is the payoff for every decorator you wrote.

\`\`\`ts
describe('TasksService', () => {
  let service: TasksService;
  const repo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TasksService, { provide: getRepositoryToken(Task), useValue: repo }],
    }).compile();

    service = moduleRef.get(TasksService);
    jest.resetAllMocks();
  });

  it('throws NotFoundException for a missing task', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(42)).rejects.toBeInstanceOf(NotFoundException);
  });
});
\`\`\`

For a service with no framework dependencies you do not even need the testing module — \`new TasksService(fakeRepo)\` is faster and just as honest. Use \`createTestingModule\` when you want the real graph, and \`overrideProvider\` when you want the real graph *minus one thing*:

\`\`\`ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(MailService)
  .useValue({ send: jest.fn() })
  .overrideGuard(JwtAuthGuard)
  .useValue({ canActivate: () => true })
  .compile();
\`\`\`

\`overrideGuard\` is how you test an authorised route without minting a token in every test.

## e2e with supertest

\`\`\`ts
describe('Tasks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ send: async () => {} })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /tasks rejects an empty title with 400', () => {
    return request(app.getHttpServer())
      .post('/tasks')
      .send({ title: '', priority: 'low' })
      .expect(400);
  });

  it('POST /tasks creates a task', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'Write tests', priority: 'high' })
      .expect(201);

    expect(res.body).toMatchObject({ title: 'Write tests', priority: 'high' });
  });
});
\`\`\`

Two traps here. First, global pipes and filters registered in \`main.ts\` are **not** applied by \`createNestApplication()\` — re-register them in the test, or move them to \`APP_PIPE\` / \`APP_FILTER\` providers so the container owns them and both paths get them. Second, \`await app.close()\` is mandatory; without it the database pool keeps the Node process alive and your CI job hangs at 100% passing.`,
    },
  ],
  quiz: [
    {
      prompt: 'What does `emitDecoratorMetadata: true` actually enable in a NestJS project?',
      options: [
        'It makes decorators run at compile time instead of runtime',
        'It emits `design:paramtypes` metadata so Nest can read a constructor parameter type at runtime and resolve a provider for it',
        'It registers every decorated class as a global provider',
        'It is required only for class-validator, not for dependency injection',
      ],
      correctIndex: 1,
      explanation:
        'TypeScript emits reflection metadata for decorated declarations. Nest reads `design:paramtypes` to learn which class each constructor argument expects. Without it, or without a matching bundler plugin, you get "Nest can not resolve dependencies of X (?)".',
      difficulty: 'MEDIUM',
    },
    {
      prompt:
        '`TasksService` is listed in `TasksModule.providers` but not in its `exports`. `ReportsModule` imports `TasksModule` and injects `TasksService`. What happens?',
      options: [
        'It works — importing a module exposes all of its providers',
        'It works, but the service is a separate instance in each module',
        'Boot fails: Nest cannot resolve the dependency',
        'It works only if `TasksModule` is marked `@Global()`',
      ],
      correctIndex: 2,
      explanation:
        'Providers are private to their module. `imports` exposes only what the imported module lists in `exports`. This is the most common Nest wiring error, and the fix is to add the provider to `exports`.',
      difficulty: 'EASY',
    },
    {
      prompt:
        'A DEFAULT-scoped `TasksService` injects a TRANSIENT-scoped `Logger`. How many `Logger` instances does that service see over the application lifetime?',
      options: [
        'One per request',
        'One per method call on the service',
        'Exactly one, created when the singleton was constructed',
        'None — a transient provider cannot be injected into a singleton',
      ],
      correctIndex: 2,
      explanation:
        'TRANSIENT means a fresh instance per consumer, not per call. The singleton is built once at boot, so it receives one Logger and keeps it. Per-request instances require `Scope.REQUEST`, which then bubbles up and makes the consumer request-scoped too.',
      difficulty: 'HARD',
    },
    {
      prompt: 'In the Nest request lifecycle, which runs first: a guard or a validation pipe?',
      options: [
        'The pipe, so the guard can authorise against a validated body',
        'The guard, so it only ever sees the raw unvalidated request',
        'They run concurrently',
        'It depends on whether they are bound globally or per route',
      ],
      correctIndex: 1,
      explanation:
        'Order is middleware, guards, interceptors (pre), pipes, handler, interceptors (post), filters. Because guards run first they only ever see raw input, which is why authorisation must come from the verified token rather than from a body field.',
      difficulty: 'MEDIUM',
    },
    {
      prompt:
        'Why can you not write `constructor(private repo: ITaskRepository)` where `ITaskRepository` is a TypeScript interface?',
      options: [
        'Interfaces are allowed only on abstract classes in Nest',
        'Nest requires all injected types to extend a base class',
        'The interface must be decorated with `@Injectable()` first',
        'Interfaces are erased at compile time, so there is no runtime value to use as an injection token',
      ],
      correctIndex: 3,
      explanation:
        'DI tokens are runtime values. An interface produces no JavaScript at all. Use an abstract class, a `Symbol` or an exported const as the token and inject it with `@Inject(TOKEN)`.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does `ValidationPipe({ whitelist: true })` do, and why does it matter for security?',
      options: [
        'It rejects any request that fails validation with a 422 instead of a 400',
        'It strips properties that have no validation decorator, so unexpected fields such as `role` never reach your service',
        'It allows only requests from IP addresses on an allow-list',
        'It caches validated DTOs so repeat requests skip validation',
      ],
      correctIndex: 1,
      explanation:
        'Without `whitelist`, undeclared properties survive on the DTO object and can be spread into an entity — classic mass assignment. Add `forbidNonWhitelisted: true` to reject such requests outright rather than silently dropping the fields.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'Which task is an interceptor suited to but middleware is not?',
      options: [
        'Wrapping every successful response in a `{ data, meta }` envelope',
        'Capturing the raw request body for webhook signature verification',
        'Setting security headers with helmet',
        'Assigning an `x-request-id` before any routing happens',
      ],
      correctIndex: 0,
      explanation:
        'Middleware runs before routing is resolved and has no access to the handler return value. Interceptors wrap the handler, so they can transform what it returns, time it, cache it or apply a timeout. The other three are transport-level concerns and belong in middleware.',
      difficulty: 'EASY',
    },
    {
      prompt:
        'In a Nest e2e test you call `moduleRef.createNestApplication()` and your "400 on invalid body" test fails with a 201. What is the most likely cause?',
      options: [
        'Supertest cannot send invalid JSON bodies',
        '`Test.createTestingModule` disables pipes by design',
        'The global `ValidationPipe` was registered in `main.ts`, which the test never runs, so it is not applied',
        'The DTO must be re-imported inside the test file',
      ],
      correctIndex: 2,
      explanation:
        '`main.ts` is not executed by the testing module. Anything registered there — global pipes, filters, interceptors, prefixes — must be re-registered on the test application, or moved into `APP_PIPE` / `APP_FILTER` providers so the container owns them and both paths get them.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'nest-module-visibility',
      title: 'Which Providers Can This Module See?',
      difficulty: 'EASY',
      runtime: 'javascript',
      statement: `Nest modules are an encapsulation boundary. A provider is private to its module unless it is listed in \`exports\`, and \`imports\` are **not** transitive — a module only sees what the modules it imports explicitly export.

Implement \`resolveVisible(modules, name)\`, returning the sorted, de-duplicated list of provider tokens visible inside module \`name\`.

\`modules\` is an array of \`{ name, providers, imports, exports }\`. Any of the three lists may be omitted.

Rules:

1. A module always sees its own \`providers\`.
2. For each module \`I\` in its \`imports\`, it also sees the **exported set** of \`I\`.
3. The exported set of \`I\` is built from \`I.exports\`, entry by entry:
   - if the entry is one of \`I.providers\`, it contributes that token;
   - else if the entry is the name of another module, it contributes that module's exported set (a re-export);
   - else throw \`Error("cannot export " + entry + " from " + I.name)\`.
4. Referencing a module name that does not exist throws \`Error("unknown module: " + name)\`.
5. Module graphs may contain cycles. Your resolver must terminate.

\`\`\`js
const modules = [
  { name: 'ConfigModule', providers: ['ConfigService'], exports: ['ConfigService'] },
  { name: 'DbModule', imports: ['ConfigModule'], providers: ['Pool', 'Migrator'], exports: ['Pool'] },
  { name: 'TasksModule', imports: ['DbModule'], providers: ['TasksService'], exports: ['TasksService'] },
];

resolveVisible(modules, 'TasksModule');
// ['Pool', 'TasksService'] — no Migrator (not exported), no ConfigService (not transitive)
\`\`\`

Return a new array each call, sorted with the default string ordering.`,
      starterCode: `function resolveVisible(modules, name) {
  // your code here
}

module.exports = { resolveVisible };`,
      solutionCode: `function resolveVisible(modules, name) {
  const byName = new Map(modules.map((m) => [m.name, m]));

  const get = (n) => {
    const mod = byName.get(n);
    if (!mod) throw new Error('unknown module: ' + n);
    return mod;
  };

  const exportedSet = (n, seen) => {
    const out = new Set();
    if (seen.has(n)) return out;
    seen.add(n);

    const mod = get(n);
    const providers = mod.providers || [];

    for (const entry of mod.exports || []) {
      if (providers.includes(entry)) {
        out.add(entry);
      } else if (byName.has(entry)) {
        for (const token of exportedSet(entry, seen)) out.add(token);
      } else {
        throw new Error('cannot export ' + entry + ' from ' + mod.name);
      }
    }
    return out;
  };

  const root = get(name);
  const visible = new Set(root.providers || []);
  for (const imported of root.imports || []) {
    for (const token of exportedSet(imported, new Set())) visible.add(token);
  }

  return Array.from(visible).sort();
}

module.exports = { resolveVisible };`,
      hints: [
        'Build a Map from module name to module first — you will look modules up many times.',
        'Write a helper returning the exported *set* of a module. The answer is own providers plus the exported set of every import.',
        'A re-export is just recursion: the entry names a module, so union in that module exported set.',
        'Carry a `seen` Set through the recursion so a cycle terminates instead of overflowing the stack.',
      ],
      tests: [
        {
          name: 'a module sees its own providers',
          assertion:
            "deepEqual(solution.resolveVisible([{ name: 'A', providers: ['b', 'a'] }], 'A'), ['a','b'])",
        },
        {
          name: 'an import contributes only exported providers',
          assertion:
            "deepEqual(solution.resolveVisible([{ name: 'Db', providers: ['Pool','Migrator'], exports: ['Pool'] }, { name: 'Tasks', imports: ['Db'], providers: ['TasksService'] }], 'Tasks'), ['Pool','TasksService'])",
        },
        {
          name: 'imports are not transitive',
          assertion:
            "deepEqual(solution.resolveVisible([{ name: 'Config', providers: ['ConfigService'], exports: ['ConfigService'] }, { name: 'Db', imports: ['Config'], providers: ['Pool'], exports: ['Pool'] }, { name: 'Tasks', imports: ['Db'], providers: ['TasksService'], exports: ['TasksService'] }], 'Tasks'), ['Pool','TasksService'])",
        },
        {
          name: 're-exporting a module forwards its exports',
          assertion:
            "deepEqual(solution.resolveVisible([{ name: 'Config', providers: ['ConfigService'], exports: ['ConfigService'] }, { name: 'Core', imports: ['Config'], providers: ['Logger'], exports: ['Config','Logger'] }, { name: 'App', imports: ['Core'], providers: ['AppService'] }], 'App'), ['AppService','ConfigService','Logger'])",
        },
        {
          name: 'result is de-duplicated and sorted',
          assertion:
            "deepEqual(solution.resolveVisible([{ name: 'A', providers: ['x'], exports: ['x'] }, { name: 'B', providers: ['x','y'], exports: ['x','y'] }, { name: 'C', imports: ['A','B'], providers: ['z'] }], 'C'), ['x','y','z'])",
        },
        {
          name: 'unknown module throws',
          assertion:
            "(() => { try { solution.resolveVisible([{ name: 'A', imports: ['Nope'] }], 'A'); return false; } catch (e) { return e.message === 'unknown module: Nope'; } })()",
        },
        {
          name: 'exporting something that is neither a provider nor a module throws',
          assertion:
            "(() => { try { solution.resolveVisible([{ name: 'A', providers: ['a'], exports: ['ghost'] }, { name: 'B', imports: ['A'] }], 'B'); return false; } catch (e) { return e.message === 'cannot export ghost from A'; } })()",
          hidden: true,
        },
        {
          name: 'a cyclic module graph terminates',
          assertion:
            "deepEqual(solution.resolveVisible([{ name: 'A', imports: ['B'], providers: ['a'], exports: ['B','a'] }, { name: 'B', imports: ['A'], providers: ['b'], exports: ['A','b'] }], 'A'), ['a','b'])",
          hidden: true,
        },
      ],
      xp: 50,
    },
    {
      slug: 'nest-ioc-container',
      title: 'Build the IoC Container',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Strip the decorators off Nest's injector and what is left is a registry that knows how to build objects and their dependencies. Build it.

Implement \`createContainer()\`, returning an object with:

- \`register(token, factory, deps = [], scope = 'singleton')\` — record a provider. \`factory\` is called with the **resolved dependency instances, in order**. \`scope\` is \`'singleton'\` or \`'transient'\`. Returns the container so calls chain.
- \`registerValue(token, value)\` — the \`useValue\` form. Always singleton. Chainable.
- \`resolve(token)\` — return an instance.
  - \`'singleton'\`: built at most once; resolving twice returns the identical object.
  - \`'transient'\`: a fresh instance on every \`resolve\` call.
- Tokens may be strings **or** symbols.

Errors:

- resolving an unregistered token throws \`Error("unknown provider: " + String(token))\`
- a dependency cycle throws \`Error("circular dependency: " + String(token))\`, naming the token whose resolution was re-entered, rather than blowing the stack

\`\`\`js
const c = createContainer();
c.registerValue('CONFIG', { url: 'postgres://local' })
 .register('repo', (config) => ({ url: config.url, find: () => 'row' }), ['CONFIG'])
 .register('service', (repo) => ({ get: () => repo.find() }), ['repo']);

c.resolve('service').get();              // 'row'
c.resolve('repo') === c.resolve('repo'); // true
\`\`\`

> Note the real-world behaviour you are modelling: a transient provider injected into a singleton is built **once**, when the singleton is built. Transient means per consumer, not per call.`,
      starterCode: `function createContainer() {
  // your code here
}

module.exports = { createContainer };`,
      solutionCode: `function createContainer() {
  const providers = new Map();
  const singletons = new Map();
  const resolving = new Set();

  const container = {
    register(token, factory, deps = [], scope = 'singleton') {
      providers.set(token, { factory, deps, scope });
      return container;
    },

    registerValue(token, value) {
      providers.set(token, { factory: () => value, deps: [], scope: 'singleton' });
      return container;
    },

    resolve(token) {
      const provider = providers.get(token);
      if (!provider) throw new Error('unknown provider: ' + String(token));

      if (provider.scope === 'singleton' && singletons.has(token)) {
        return singletons.get(token);
      }
      if (resolving.has(token)) {
        throw new Error('circular dependency: ' + String(token));
      }

      resolving.add(token);
      try {
        const args = provider.deps.map((dep) => container.resolve(dep));
        const instance = provider.factory(...args);
        if (provider.scope === 'singleton') singletons.set(token, instance);
        return instance;
      } finally {
        resolving.delete(token);
      }
    },
  };

  return container;
}

module.exports = { createContainer };`,
      hints: [
        'Keep three structures: the provider registry, the cache of built singletons, and the set of tokens currently being resolved.',
        'Order matters inside resolve: registry lookup, then the singleton cache, then the in-progress cycle check.',
        'Resolve every dependency recursively first, then spread the results into the factory call.',
        'Only cache the instance when the scope is singleton — a transient provider must reach the factory every time.',
        'Use try/finally so the in-progress marker is cleared even when a factory throws.',
      ],
      tests: [
        {
          name: 'resolves a provider with no dependencies',
          assertion:
            "(() => { const c = solution.createContainer(); c.register('config', () => ({ url: 'x' })); return c.resolve('config').url === 'x'; })()",
        },
        {
          name: 'injects dependencies in declared order',
          assertion:
            "(() => { const c = solution.createContainer(); c.register('a', () => 1); c.register('b', () => 2); c.register('diff', (a, b) => a - b, ['a','b']); return c.resolve('diff') === -1; })()",
        },
        {
          name: 'resolves a three-level chain',
          assertion:
            "(() => { const c = solution.createContainer(); c.register('config', () => ({ url: 'pg' })); c.register('repo', (cfg) => ({ find: () => cfg.url }), ['config']); c.register('service', (r) => ({ get: () => r.find() }), ['repo']); return c.resolve('service').get() === 'pg'; })()",
        },
        {
          name: 'singleton providers are built once',
          assertion:
            "(() => { const c = solution.createContainer(); let n = 0; c.register('repo', () => ({ id: ++n })); return c.resolve('repo') === c.resolve('repo') && n === 1; })()",
        },
        {
          name: 'transient providers are built on every resolve',
          assertion:
            "(() => { const c = solution.createContainer(); let n = 0; c.register('logger', () => ({ id: ++n }), [], 'transient'); const a = c.resolve('logger'), b = c.resolve('logger'); return a !== b && a.id === 1 && b.id === 2 && n === 2; })()",
        },
        {
          name: 'a transient injected into a singleton is built once',
          assertion:
            "(() => { const c = solution.createContainer(); let n = 0; c.register('logger', () => ({ id: ++n }), [], 'transient'); c.register('svc', (l) => ({ logger: l }), ['logger']); return c.resolve('svc').logger === c.resolve('svc').logger && n === 1; })()",
          hidden: true,
        },
        {
          name: 'registerValue works and is chainable',
          assertion:
            "(() => { const c = solution.createContainer(); const same = c.registerValue('CONFIG', { url: 'u' }).register('repo', (cfg) => cfg.url, ['CONFIG']); return same.resolve('repo') === 'u' && c.resolve('CONFIG') === c.resolve('CONFIG'); })()",
        },
        {
          name: 'symbol tokens are supported',
          assertion:
            "(() => { const T = Symbol('TASK_REPO'); const c = solution.createContainer(); c.registerValue(T, { find: () => 7 }); c.register('svc', (r) => r.find(), [T]); return c.resolve('svc') === 7; })()",
        },
        {
          name: 'unknown provider throws a named error',
          assertion:
            "(() => { const c = solution.createContainer(); try { c.resolve('nope'); return false; } catch (e) { return e.message === 'unknown provider: nope'; } })()",
        },
        {
          name: 'a cycle is reported instead of overflowing the stack',
          assertion:
            "(() => { const c = solution.createContainer(); c.register('a', (b) => b, ['b']); c.register('b', (a) => a, ['a']); try { c.resolve('a'); return false; } catch (e) { return e.message === 'circular dependency: a'; } })()",
          hidden: true,
        },
      ],
      xp: 75,
    },
    {
      slug: 'nest-request-lifecycle',
      title: 'Compose the Request Lifecycle',
      difficulty: 'HARD',
      runtime: 'javascript',
      statement: `Nest's request lifecycle is a fixed composition: **guards → interceptors (pre) → pipes → handler → interceptors (post, reversed) → exception filters**. Build it.

Implement \`createPipeline({ guards, interceptors, pipes, handler, filters })\`, returning an async function \`handle(ctx)\`.

\`ctx\` is a plain object; treat \`ctx.body\` as the request payload. Every key except \`handler\` is optional.

Execution rules, in order:

1. **Guards** — each is \`(ctx) => boolean | Promise<boolean>\`, run in array order. The first one to return a falsy value short-circuits everything: throw an \`Error\` whose \`message\` is \`'Forbidden'\` and whose \`status\` property is \`403\`. No later guard, no interceptor, no pipe and not the handler may run.
2. **Interceptors** — each is \`(ctx, next) => any\`, entered in array order. Calling \`next()\` returns a promise for everything downstream; whatever the interceptor returns becomes the result seen by the interceptor *above* it. So the post-handler halves unwind in reverse order.
3. **Pipes** — each is \`(value, ctx) => any\`, applied left to right, threading the return value. The final value is written back to \`ctx.body\` before the handler runs.
4. **Handler** — \`(ctx) => any\`. Its resolved value is the result.
5. On success, \`handle\` resolves to \`{ status: 200, body: result }\`.
6. **Filters** — if *anything* above throws or rejects, try each filter in order as \`(err, ctx) => response | undefined\`. The first filter returning something other than \`undefined\` becomes the resolved value of \`handle\`. If every filter declines, re-throw the original error.

Every stage may be async; await all of them.

\`\`\`js
const handle = createPipeline({
  guards: [(ctx) => !!ctx.user],
  interceptors: [async (ctx, next) => ({ data: await next() })],
  pipes: [(body) => ({ ...body, title: body.title.trim() })],
  handler: (ctx) => ({ id: 1, ...ctx.body }),
  filters: [(err) => (err.status === 403 ? { status: 403, body: 'Forbidden' } : undefined)],
});

await handle({ user: { id: 1 }, body: { title: '  hi  ' } });
// { status: 200, body: { data: { id: 1, title: 'hi' } } }

await handle({ user: null, body: {} });
// { status: 403, body: 'Forbidden' }
\`\`\``,
      starterCode: `function createPipeline(config) {
  // return an async function handle(ctx) { ... }
}

module.exports = { createPipeline };`,
      solutionCode: `function createPipeline(config) {
  const {
    guards = [],
    interceptors = [],
    pipes = [],
    handler,
    filters = [],
  } = config;

  return async function handle(ctx) {
    try {
      for (const guard of guards) {
        const allowed = await guard(ctx);
        if (!allowed) {
          const err = new Error('Forbidden');
          err.status = 403;
          throw err;
        }
      }

      const runPipesAndHandler = async () => {
        let value = ctx.body;
        for (const pipe of pipes) value = await pipe(value, ctx);
        ctx.body = value;
        return await handler(ctx);
      };

      const chain = interceptors.reduceRight(
        (next, interceptor) => () => interceptor(ctx, next),
        runPipesAndHandler,
      );

      const result = await chain();
      return { status: 200, body: result };
    } catch (err) {
      for (const filter of filters) {
        const response = await filter(err, ctx);
        if (response !== undefined) return response;
      }
      throw err;
    }
  };
}

module.exports = { createPipeline };`,
      hints: [
        'Wrap the whole happy path in one try/catch — the catch block is the exception-filter stage, and it must also cover guards and pipes.',
        'Guards are a plain loop, and the falsy check must happen before any interceptor runs.',
        'Build the interceptor chain with reduceRight over a "run pipes then handler" function: each step wraps the one below it, so calling the outermost runs them top-down and unwinds bottom-up.',
        'Thread the pipe value with `value = await pipe(value, ctx)`, then assign it to ctx.body before calling the handler.',
        'A filter that returns undefined has declined the error — keep going, and re-throw if every filter declines.',
      ],
      tests: [
        {
          name: 'runs the handler and wraps the result',
          assertion:
            "(async () => { const h = solution.createPipeline({ handler: (ctx) => ctx.body.n * 2 }); return deepEqual(await h({ body: { n: 21 } }), { status: 200, body: 42 }); })()",
        },
        {
          name: 'pipes thread left to right and land on ctx.body',
          assertion:
            "(async () => { const h = solution.createPipeline({ pipes: [(v) => v + 1, (v) => v * 10], handler: (ctx) => ctx.body }); return deepEqual(await h({ body: 1 }), { status: 200, body: 20 }); })()",
        },
        {
          name: 'a failing guard short-circuits to the 403 filter',
          assertion:
            "(async () => { const seen = []; const h = solution.createPipeline({ guards: [() => false, () => { seen.push('g2'); return true; }], pipes: [(v) => { seen.push('pipe'); return v; }], handler: () => { seen.push('handler'); return 'x'; }, filters: [(e) => (e.status === 403 ? { status: 403, body: e.message } : undefined)] }); const res = await h({ body: 1 }); return deepEqual(res, { status: 403, body: 'Forbidden' }) && seen.length === 0; })()",
        },
        {
          name: 'stages run in the documented order',
          assertion:
            "(async () => { const log = []; const h = solution.createPipeline({ guards: [() => { log.push('guard'); return true; }], interceptors: [async (c, next) => { log.push('i1:before'); const r = await next(); log.push('i1:after'); return r; }, async (c, next) => { log.push('i2:before'); const r = await next(); log.push('i2:after'); return r; }], pipes: [(v) => { log.push('pipe'); return v; }], handler: () => { log.push('handler'); return 1; } }); await h({ body: 0 }); return deepEqual(log, ['guard','i1:before','i2:before','pipe','handler','i2:after','i1:after']); })()",
        },
        {
          name: 'an interceptor can transform the handler result',
          assertion:
            "(async () => { const h = solution.createPipeline({ interceptors: [async (c, next) => ({ data: await next() })], handler: () => ({ id: 7 }) }); return deepEqual(await h({ body: null }), { status: 200, body: { data: { id: 7 } } }); })()",
        },
        {
          name: 'a throwing pipe is caught by a filter and the handler never runs',
          assertion:
            "(async () => { let ran = false; const h = solution.createPipeline({ pipes: [() => { const e = new Error('Bad Request'); e.status = 400; throw e; }], handler: () => { ran = true; return 1; }, filters: [(e) => ({ status: e.status, body: e.message })] }); const res = await h({ body: {} }); return deepEqual(res, { status: 400, body: 'Bad Request' }) && ran === false; })()",
        },
        {
          name: 'the first filter that returns a value wins',
          assertion:
            "(async () => { const h = solution.createPipeline({ handler: () => { throw new Error('boom'); }, filters: [(e) => (e.message === 'other' ? { status: 1 } : undefined), () => ({ status: 500, body: 'caught' }), () => ({ status: 999 })] }); return deepEqual(await h({}), { status: 500, body: 'caught' }); })()",
        },
        {
          name: 'an unhandled error is re-thrown',
          assertion:
            "(async () => { const h = solution.createPipeline({ handler: () => { throw new Error('boom'); }, filters: [() => undefined] }); try { await h({}); return false; } catch (e) { return e.message === 'boom'; } })()",
          hidden: true,
        },
        {
          name: 'async guards, pipes and handlers are awaited',
          assertion:
            "(async () => { const h = solution.createPipeline({ guards: [async () => true], pipes: [async (v) => v + 1], handler: async (ctx) => ctx.body + 1 }); return deepEqual(await h({ body: 1 }), { status: 200, body: 3 }); })()",
          hidden: true,
        },
        {
          name: 'works with no guards, interceptors, pipes or filters',
          assertion:
            "(async () => { const h = solution.createPipeline({ handler: () => 'ok' }); return deepEqual(await h({}), { status: 200, body: 'ok' }); })()",
        },
      ],
      xp: 100,
    },
  ],
  flashcards: [
    {
      front: 'What is the default HTTP adapter under NestJS, and what is the alternative?',
      back: 'Express by default. `new FastifyAdapter()` from `@nestjs/platform-fastify` swaps it. Handlers that return values stay portable; anything touching `@Res()` does not.',
      tags: ['nestjs', 'architecture'],
    },
    {
      front: 'Why does Nest need `emitDecoratorMetadata`?',
      back: 'It emits `design:paramtypes`, the runtime list of constructor parameter types. Nest reads it to find one provider per argument. Without it you get "Nest can not resolve dependencies of X (?)".',
      tags: ['nestjs', 'typescript', 'di'],
    },
    {
      front: 'The custom provider forms',
      back: '`useClass` (swap an implementation), `useValue` (constant or test double), `useFactory` plus `inject` (computed, may have its own deps), `useExisting` (alias to another provider).',
      tags: ['nestjs', 'di'],
    },
    {
      front: 'Why can a TypeScript interface not be an injection token?',
      back: 'Interfaces are erased at compile time, so there is no runtime value to key the container on. Use an abstract class, a Symbol or an exported const plus `@Inject(TOKEN)`.',
      tags: ['nestjs', 'di', 'typescript'],
    },
    {
      front: 'DEFAULT vs REQUEST vs TRANSIENT scope',
      back: 'DEFAULT = one per app. REQUEST = one per incoming request, and the scope bubbles up to every consumer. TRANSIENT = one per consumer, not per call.',
      tags: ['nestjs', 'di', 'scopes'],
    },
    {
      front: 'A provider exists but Nest says it cannot be resolved. First thing to check?',
      back: 'The `exports` array of the module that owns it. Providers are private to their module, and `imports` are not transitive.',
      tags: ['nestjs', 'modules'],
    },
    {
      front: 'The Nest request lifecycle, in order',
      back: 'Middleware, guards, interceptors (pre), pipes, handler, interceptors (post, reversed), exception filters, response.',
      tags: ['nestjs', 'lifecycle'],
    },
    {
      front: 'Why must authorisation never read `req.body.userId`?',
      back: 'Guards run before pipes, so a guard only ever sees the raw unvalidated body. Authorise from the verified token instead.',
      tags: ['nestjs', 'security', 'guards'],
    },
    {
      front: 'Middleware or interceptor for response shaping?',
      back: 'Interceptor. Middleware runs before routing and never sees the handler or its return value; an interceptor wraps the handler and can transform, cache or time the result.',
      tags: ['nestjs', 'lifecycle'],
    },
    {
      front: 'What does `ValidationPipe({ whitelist: true })` protect against?',
      back: 'Mass assignment. Properties with no validation decorator are stripped from the DTO. Add `forbidNonWhitelisted: true` to reject the request instead of silently dropping them.',
      tags: ['nestjs', 'validation', 'security'],
    },
    {
      front: 'How do you use Zod instead of class-validator in Nest?',
      back: 'Write a `ZodValidationPipe implements PipeTransform` that calls `schema.safeParse(value)` and throws `BadRequestException` on failure. You then get `z.infer` types and a schema shareable with the browser.',
      tags: ['nestjs', 'zod', 'validation'],
    },
    {
      front: 'Your Nest e2e test gets 201 where you expected 400. Why?',
      back: 'Global pipes and filters registered in `main.ts` are not applied by `createNestApplication()`. Re-register them in the test, or move them to `APP_PIPE` / `APP_FILTER` providers.',
      tags: ['nestjs', 'testing'],
    },
  ],
  resources: [
    { label: 'NestJS — Official documentation', url: 'https://docs.nestjs.com/', kind: 'DOCS' },
    { label: 'NestJS — Custom providers', url: 'https://docs.nestjs.com/fundamentals/custom-providers', kind: 'DOCS' },
    { label: 'NestJS — Injection scopes', url: 'https://docs.nestjs.com/fundamentals/injection-scopes', kind: 'DOCS' },
    { label: 'NestJS — Request lifecycle', url: 'https://docs.nestjs.com/faq/request-lifecycle', kind: 'DOCS' },
    { label: 'NestJS — Testing', url: 'https://docs.nestjs.com/fundamentals/testing', kind: 'DOCS' },
  ],
};

export default day;
