import type { DaySpec } from '../types';

const day: DaySpec = {
  day: 17,
  week: 3,
  pillar: 'BACKEND',
  title: 'Auth & Security — JWT, OAuth 2.0, Hashing',
  summary: 'Prove who a user is, decide what they may do, and store credentials so a database leak is not a catastrophe.',
  estimatedMinutes: 320,
  objectives: [
    'Separate authentication (who you are) from authorisation (what you may do)',
    'Hash passwords with bcrypt or argon2 and explain why SHA-256 is the wrong tool',
    'Read a JWT byte by byte and verify it correctly, including rejecting alg: none',
    'Design an access + refresh token rotation scheme with reuse detection',
    'Choose between httpOnly cookies and localStorage using the CSRF/XSS trade-off',
    'Walk the OAuth 2.0 authorization-code + PKCE flow and know what OIDC adds',
    'Write RBAC/ABAC middleware and audit an API against the OWASP Top 10',
  ],
  technologies: ['JWT', 'OAuth', 'bcrypt', 'Express.js'],
  lessons: [
    {
      slug: 'identity-and-password-storage',
      title: 'Identity, Authorisation & How to Store a Password',
      estimatedMinutes: 80,
      body: `# Identity, Authorisation & How to Store a Password

Two words get used interchangeably in standups and they mean completely different things.

- **Authentication (AuthN)** — *who are you?* Proving identity. Password, passkey, magic link, Google login.
- **Authorisation (AuthZ)** — *what are you allowed to do?* Deciding whether this identity may perform this action on this resource.

They fail differently, they live in different layers, and they have different HTTP status codes:

| Situation | Status | Meaning |
| --- | --- | --- |
| No credentials, or bad credentials | \`401 Unauthorized\` | "I do not know who you are" (misnamed — it is really *unauthenticated*) |
| Valid credentials, insufficient rights | \`403 Forbidden\` | "I know who you are, and the answer is no" |
| Valid credentials, resource not yours | \`404 Not Found\` | Sometimes preferable — a 403 leaks that the record exists |

Authentication happens once per request at the edge. Authorisation happens **everywhere**, right next to the data. A route guard that only checks "is logged in" and then loads \`/invoices/:id\` by raw ID is the single most common vulnerability in real apps — OWASP calls it Broken Access Control, and it has been the number one item on their Top 10 since 2021.

## Never store a password

You store a **verifier**: a value that lets you check a password without being able to recover it. That means a hash — but not just any hash.

\`\`\`js
// ❌ Catastrophic. All three lines are wrong.
const hash = crypto.createHash('sha256').update(password).digest('hex');
\`\`\`

Why SHA-256 is the wrong tool:

1. **It is fast — deliberately.** SHA-256 is designed for throughput. A commodity GPU does billions of SHA-256 hashes per second. An 8-character password has a search space a rig chews through in hours.
2. **It is unsalted.** Two users with the same password get the same digest, so one crack breaks many accounts, and precomputed rainbow tables apply directly.
3. **It has no cost parameter.** You cannot make it slower next year when hardware gets faster.

Password hashing functions are *deliberately slow* and *memory-hard*. Use one of:

| Algorithm | Notes |
| --- | --- |
| **argon2id** | Current OWASP first choice. Tunable memory, time and parallelism; resists GPU and ASIC attacks. |
| **bcrypt** | Battle-tested since 1999, everywhere, trivially easy. Cost factor 12+ today. Silently truncates input at 72 bytes. |
| **scrypt** | Memory-hard, in Node's stdlib. Fine if argon2 is unavailable. |
| **PBKDF2** | Only when a compliance regime (FIPS) demands it. Weakest of the four. |

## bcrypt in practice

\`\`\`js
import bcrypt from 'bcrypt';

const COST = 12; // ~250ms on a 2024 server. Re-benchmark yearly.

export async function hashPassword(plain) {
  return bcrypt.hash(plain, COST); // salt is generated and embedded for you
}

export async function verifyPassword(plain, storedHash) {
  return bcrypt.compare(plain, storedHash); // constant-time comparison
}
\`\`\`

A stored bcrypt hash looks like this, and it is entirely self-describing:

\`\`\`
$2b$12$Xy7Q9m0Zk1sJb3v6uPQeGuKjD8Xg8w6rN0lL0dPq4bJ5c1Q2f3H1a
 |  |  |                     |
 |  |  |                     +-- 31-char hash
 |  |  +-- 22-char base64 salt (random per password)
 |  +-- cost factor (2^12 = 4096 iterations)
 +-- algorithm identifier
\`\`\`

Because the salt and cost live *inside* the string, you never store them separately, and \`bcrypt.compare\` can re-derive the hash without you telling it anything.

> **Cost factor.** Pick the highest value that keeps login under ~250ms at your traffic. Too low and offline cracking is cheap; too high and login becomes a denial-of-service amplifier — an attacker sends 500 login attempts and pins your CPU. Rate-limit login *and* keep the cost sane.

## Upgrading hashes on the fly

Cost factors age. Bump them at login, when you legitimately hold the plaintext for a few milliseconds:

\`\`\`js
export async function login(email, password) {
  const user = await db.user.findUnique({ where: { email } });

  // Always spend the time, even for unknown users, or response timing
  // tells an attacker which emails are registered.
  const stored = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, stored);
  if (!user || !ok) throw new AuthError('Invalid email or password');

  if (bcrypt.getRounds(stored) < COST) {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, COST) },
    });
  }
  return user;
}
\`\`\`

Three habits in that snippet worth stealing:

1. **One error message.** "Invalid email or password" — never "no such user". Distinct messages are a free user-enumeration oracle.
2. **Constant work.** Compare against a dummy hash for unknown emails so both paths take the same time.
3. **Transparent rehash.** Users are migrated to a stronger cost without a password reset email.

## Peppers, and the rest of the checklist

A **pepper** is a secret added to every password before hashing, stored in your KMS or env — *not* in the database. It means a pure database leak (no application secrets) yields uncrackable hashes. It is a genuine defence-in-depth win, but it complicates rotation, so treat it as a bonus rather than a substitute for a good KDF.

The rest of the credential checklist:

- **Minimum 8 characters, maximum at least 64.** No composition rules ("must contain a symbol") — NIST dropped them, they push users toward \`Password1!\`.
- **Check against a breach corpus** (Have I Been Pwned's k-anonymity range API) on signup and password change.
- **Rate-limit by IP and by account**, with exponential back-off.
- **Never log the password**, not even at debug level, not even truncated.
- **Invalidate all sessions on password change.** Otherwise the attacker who caused the reset keeps their session.
- **Support MFA** — TOTP is a 40-line implementation and stops credential stuffing dead.`,
    },
    {
      slug: 'sessions-tokens-and-jwt-anatomy',
      title: 'Sessions vs Tokens, and JWT Byte by Byte',
      estimatedMinutes: 85,
      body: `# Sessions vs Tokens, and JWT Byte by Byte

Once a user has proven who they are, you need to remember it. There are exactly two families of answers.

## Stateful sessions

The server generates an opaque random ID, stores the associated state (user ID, roles, expiry) in Redis or Postgres, and hands the ID to the browser in a cookie.

\`\`\`js
// The cookie carries no information. It is a pointer.
Set-Cookie: sid=8f2a...c91; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1209600
\`\`\`

- Revocation is a \`DEL\` — instant and total.
- The token itself leaks nothing if intercepted at rest.
- Every request costs a lookup, and your session store becomes a hard dependency.

## Stateless tokens

The server signs a payload containing the claims themselves. The server keeps nothing; verification is pure CPU.

- No store, no lookup, trivially horizontally scalable.
- **Revocation is the hard problem.** A signed token is valid until it expires, full stop.
- Claims are a snapshot. Demote a user at 10:00 and their 15-minute token still says "admin" until 10:15.

| | Session ID | JWT |
| --- | --- | --- |
| Server state | Required | None |
| Revoke now | Trivial | Needs a deny-list (i.e. state) |
| Payload visible to client | No | **Yes** — base64, not encryption |
| Cross-service verification | Shared store | Public key, no shared store |
| Size on the wire | ~32 bytes | 300–800 bytes, every request |

The honest default for a single web app is **sessions**. Reach for JWTs when you have multiple services or a third party that must verify identity without calling you.

## The three segments

A JWS-compact JWT is \`header.payload.signature\`, each segment **base64url**-encoded (\`+\` → \`-\`, \`/\` → \`_\`, padding \`=\` stripped) and joined with dots.

\`\`\`js
// header
{ "alg": "HS256", "typ": "JWT", "kid": "2026-08" }
// payload — "claims"
{ "sub": "user-1", "iss": "https://auth.codeninja.dev", "aud": "ninja-api",
  "iat": 1754380800, "exp": 1754381700, "jti": "b1f0…", "role": "author" }
// signature
HMACSHA256(base64url(header) + "." + base64url(payload), secret)
\`\`\`

Registered claims worth memorising: **iss** (issuer), **sub** (subject/user id), **aud** (audience — which API this is for), **exp** (expiry, seconds since epoch), **nbf** (not before), **iat** (issued at), **jti** (unique token id, the handle you deny-list).

> **A JWT is signed, not encrypted.** Anyone holding the token can read the payload with \`atob\`. Never put a phone number, an email, a permission you would not print on a billboard, or anything you would call PII in a JWT. If you truly need confidentiality you want JWE, which almost nobody does.

## Decoding one by hand

\`\`\`js
const base64UrlDecode = (seg) => {
  let s = seg.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return atob(s);
};

const [h, p, sig] = token.split('.');
console.log(JSON.parse(base64UrlDecode(h)));  // { alg: 'HS256' }
console.log(JSON.parse(base64UrlDecode(p)));  // { sub: 'user-1', exp: … }
\`\`\`

Note what that code does **not** do: verify anything. Decoding is not verification. Any library API named \`decode\` is a trap; the one you want is named \`verify\`.

## HS256 vs RS256

| | HS256 | RS256 / ES256 |
| --- | --- | --- |
| Crypto | HMAC-SHA256, one shared secret | RSA / ECDSA signature, private + public key |
| Who can sign | Anyone who can verify | Only the holder of the private key |
| Distribution | Secret must reach every verifier | Publish the public key (JWKS) |
| Use when | One service issues and consumes | Auth server issues, N services verify |

The moment a second service needs to verify tokens, HS256 forces you to copy your signing secret into it — and now that service can mint admin tokens. Switch to **RS256** and publish a JWKS document at \`/.well-known/jwks.json\`; verifiers fetch and cache it, matched by the \`kid\` header claim. That \`kid\` is also what makes key rotation painless: publish the new key, sign with it, keep verifying the old one until every token has expired, then drop it.

## The \`alg: none\` attack

The JWT spec includes an "unsecured" algorithm, \`none\`, with an empty signature. Naive libraries used to do this:

\`\`\`js
// ❌ the vulnerability, in one line
const verified = ALGORITHMS[header.alg].verify(data, signature, secret);
\`\`\`

An attacker takes your token, rewrites the header to \`{"alg":"none"}\`, edits \`"role":"admin"\` into the payload, drops the signature, and the library helpfully "verifies" it with a no-op. The related attack is **algorithm confusion**: take an RS256 system, change the header to \`HS256\`, and sign the token using the *public* key as the HMAC secret. If the verifier picks the algorithm from the header, it validates.

The fix is one rule: **the verifier, not the token, decides the algorithm.**

\`\`\`js
import jwt from 'jsonwebtoken';

const claims = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],           // allow-list — non-negotiable
  issuer: 'https://auth.codeninja.dev',
  audience: 'ninja-api',
  clockTolerance: 5,               // seconds of skew
});
\`\`\`

Your verification checklist, in order: signature over an **allow-listed** algorithm → \`exp\` in the future → \`nbf\` in the past → \`iss\` matches → \`aud\` matches → \`jti\` not deny-listed. Skip any one of those and the token is decoration.`,
    },
    {
      slug: 'refresh-rotation-and-token-storage',
      title: 'Refresh Rotation & Where to Put the Token',
      estimatedMinutes: 75,
      body: `# Refresh Rotation & Where to Put the Token

Stateless tokens create a dilemma. Short expiry means constant re-login; long expiry means a stolen token is valid for weeks. The standard resolution is **two tokens with different jobs**.

| | Access token | Refresh token |
| --- | --- | --- |
| Lifetime | 5–15 minutes | 7–30 days |
| Sent to | Every API request | Only \`POST /auth/refresh\` |
| Format | JWT (stateless, verified locally) | Opaque random string, **stored server-side** |
| Stolen impact | Bounded by expiry | Full account takeover until detected |

The access token being short means you never need to revoke it — you just wait. The refresh token being *stateful* is what buys back revocation. Making the refresh token a JWT throws away the entire benefit.

## Rotation with reuse detection

Every refresh call issues a *new* refresh token and invalidates the old one. Each token records the family it belongs to.

\`\`\`js
// POST /auth/refresh   { refreshToken } (usually via httpOnly cookie)
export async function refresh(req, res) {
  const presented = req.cookies.rt;
  const hash = sha256(presented); // store hashes, not the tokens themselves
  const record = await db.refreshToken.findUnique({ where: { hash } });

  if (!record) return res.status(401).json({ error: 'invalid_grant' });

  if (record.revokedAt) {
    // Someone is replaying a token we already rotated away.
    // Either the legitimate user or the thief — we cannot tell, so kill everything.
    await db.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.status(401).json({ error: 'token_reuse_detected' });
  }

  if (record.expiresAt < new Date()) return res.status(401).json({ error: 'expired' });

  await db.refreshToken.update({ where: { hash }, data: { revokedAt: new Date() } });
  const next = await issueRefreshToken(record.userId, record.familyId);

  res.cookie('rt', next, REFRESH_COOKIE);
  return res.json({ accessToken: signAccessToken(record.userId) });
}
\`\`\`

That \`revokedAt\` branch is the whole point. A stolen refresh token can be used exactly once before the thief and the victim start racing, and the first collision nukes the family and forces a re-login. Without rotation you would never find out at all.

Store the **hash** of the refresh token, for the same reason you hash passwords: your token table is a credential table.

## Where does the browser keep it?

This is the argument that never ends, so here is the shape of it.

| | \`localStorage\` | \`httpOnly\` cookie |
| --- | --- | --- |
| Readable by JS | **Yes** — any XSS steals it | No |
| Sent automatically | No, you attach it | Yes, by the browser |
| CSRF exposure | None | **Yes**, needs mitigation |
| Works cross-origin | Easy | Needs \`SameSite=None; Secure\` + CORS credentials |
| Mobile / native clients | Natural fit | Awkward |

The trade-off in one line: **localStorage trades XSS risk for CSRF safety; cookies trade CSRF risk for XSS safety.** Cookies win, because CSRF has a complete, cheap, well-understood mitigation and XSS does not. If an attacker executes JS on your origin, a token in \`localStorage\` is gone in a single line of script — and it is gone silently, with no expiry you can rely on.

\`\`\`js
res.cookie('rt', token, {
  httpOnly: true,                       // invisible to document.cookie
  secure: true,                         // HTTPS only
  sameSite: 'strict',                   // browser will not attach it cross-site
  path: '/auth/refresh',                // sent to exactly one endpoint
  maxAge: 30 * 24 * 60 * 60 * 1000,
});
\`\`\`

\`SameSite\` is your primary CSRF defence and it is one word:

- **Strict** — never sent on cross-site navigation. Perfect for a refresh cookie.
- **Lax** — sent on top-level GET navigations only. The modern browser default.
- **None** — always sent; requires \`Secure\`. Only for genuine cross-origin setups, and then you *must* add a token-based defence.

Belt and braces for state-changing routes: the **double-submit cookie** or a synchroniser token, plus an \`Origin\` header check.

\`\`\`js
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).end();
  if (req.get('X-CSRF-Token') !== req.cookies.csrf) return res.status(403).end();
  next();
});
\`\`\`

The CSRF cookie is deliberately *not* httpOnly — the app reads it and echoes it in a header. An attacker on another origin can cause the cookie to be sent but cannot read it to set the header, which is exactly the asymmetry the defence relies on.

## The pattern that works

Access token in **memory** (a module variable in your SPA — dies on refresh, which is fine), refresh token in an **httpOnly, SameSite=Strict, path-scoped** cookie. On boot, call \`/auth/refresh\` once to get an access token. On \`401\`, refresh once and retry the request; if the refresh fails, redirect to login.

\`\`\`js
let accessToken = null;

export async function apiFetch(url, init = {}) {
  const send = () => fetch(url, {
    ...init,
    credentials: 'include',
    headers: { ...init.headers, Authorization: 'Bearer ' + accessToken },
  });

  let res = await send();
  if (res.status === 401) {
    const r = await fetch('/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!r.ok) { location.href = '/login'; return res; }
    accessToken = (await r.json()).accessToken;
    res = await send();
  }
  return res;
}
\`\`\`

> Queue concurrent refreshes. Five parallel requests hitting \`401\` will fire five refresh calls, and with rotation four of them present an already-rotated token — which your reuse detection correctly reads as theft and logs the user out. Keep a single in-flight refresh promise and have everyone await it.`,
    },
    {
      slug: 'oauth-oidc-rbac-owasp',
      title: 'OAuth 2.0, OIDC, RBAC and an OWASP Pass',
      estimatedMinutes: 80,
      body: `# OAuth 2.0, OIDC, RBAC and an OWASP Pass

## What OAuth 2.0 actually is

OAuth 2.0 is a **delegated authorisation** protocol. It answers: "how does app A get permission to call API B on behalf of user U, without U handing A their password?" It is *not* a login protocol, despite everyone using it as one. The four actors:

- **Resource owner** — the user.
- **Client** — your app.
- **Authorization server** — Google, Auth0, your own identity service.
- **Resource server** — the API holding the data.

## The authorization-code flow with PKCE

This is the only flow you should use for web and mobile apps in 2026. The implicit flow is dead; the password grant is dead.

\`\`\`
1. Client generates:  verifier = random 43-128 chars
                      challenge = base64url(SHA256(verifier))

2. Browser → /authorize?response_type=code
                        &client_id=abc
                        &redirect_uri=https://app.dev/callback
                        &scope=openid profile email
                        &state=<random, CSRF guard>
                        &code_challenge=<challenge>
                        &code_challenge_method=S256

3. User authenticates and consents at the auth server.

4. Auth server → https://app.dev/callback?code=<code>&state=<same random>
   Client MUST compare state. Mismatch = abort.

5. Client → POST /token   grant_type=authorization_code
                          code=<code>
                          code_verifier=<verifier>     ← the proof
                          redirect_uri=https://app.dev/callback

6. Auth server checks SHA256(verifier) === stored challenge, returns
   { access_token, refresh_token, id_token, expires_in }
\`\`\`

**Why PKCE** (RFC 7636, "pixie"): the authorization code travels back through the browser — through a redirect, a URL bar, server logs, possibly a malicious app registered for the same custom URI scheme on a phone. Interception is realistic. PKCE binds the code to the client that started the flow: whoever redeems it must present the verifier whose hash was sent up front, and only the original client has it. Originally a mobile fix, now mandatory for **every** public client. Note that step 1's hash is over a random secret you generated — never derive it from anything predictable.

**Why \`state\`**: it is the CSRF token of the OAuth flow. Without it, an attacker can splice their own authorization code into your callback and connect your user's session to the attacker's account.

## OIDC: the login layer OAuth is missing

OpenID Connect is a thin standard layer on top of OAuth 2.0 that adds authentication. Ask for the \`openid\` scope and you get one more thing back: an **ID token**, a JWT *about the user*, meant to be consumed by the client.

\`\`\`json
{
  "iss": "https://accounts.google.com",
  "aud": "your-client-id",
  "sub": "104928372910",        // stable, unique user id — key your users on this
  "email": "ada@example.com",
  "email_verified": true,
  "nonce": "…", "iat": 1754380800, "exp": 1754384400
}
\`\`\`

The distinction that trips people up: the **access token** is for the *API* (opaque to you, do not parse it); the **ID token** is for the *client* (verify it, read it, then throw it away). Key your local user records on \`iss\` + \`sub\`, never on \`email\` — emails change hands.

OIDC also standardises discovery at \`/.well-known/openid-configuration\`, which is how a library can bootstrap every endpoint and the JWKS URL from a single issuer string.

## RBAC and ABAC in middleware

**RBAC** — permissions attach to roles, roles attach to users. Simple, auditable, coarse.
**ABAC** — decisions are a function of attributes of the subject, resource, action and environment. Flexible, expressive, harder to reason about.

Most real systems are RBAC with a few ABAC rules bolted on ("editors may edit any post; authors may edit *their own*").

\`\`\`js
const ROLES = {
  viewer: { permissions: ['post:read'] },
  author: { inherits: ['viewer'], permissions: ['post:create', 'post:update:own'] },
  editor: { inherits: ['author'], permissions: ['post:*'] },
  admin:  { inherits: ['editor'], permissions: ['*'] },
};

export const requirePermission = (action, getResource) => async (req, res, next) => {
  const resource = getResource ? await getResource(req) : null;
  if (!can(ROLES, req.user, action, resource)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  req.resource = resource; // already loaded — do not fetch it twice
  next();
};

app.patch(
  '/posts/:id',
  authenticate,
  requirePermission('post:update', (req) => db.post.findUnique({ where: { id: req.params.id } })),
  updatePost,
);
\`\`\`

Two rules that keep this honest. First, **deny by default** — a route with no guard should fail closed in your tests, not silently allow. Second, **check ownership against the loaded row**, never against a client-supplied \`ownerId\`.

## OWASP Top 10, a quick pass

| # | Risk | The one thing to do |
| --- | --- | --- |
| A01 | Broken Access Control | Authorise per object, not per route. Test that user B gets 403/404 on user A's ID. |
| A02 | Cryptographic Failures | TLS everywhere, argon2/bcrypt for passwords, no home-made crypto. |
| A03 | Injection | Parameterised queries / ORM bindings; validate input with Zod; escape on output for XSS. |
| A04 | Insecure Design | Threat-model the feature. Rate limits and quotas are design, not config. |
| A05 | Security Misconfiguration | \`helmet()\`, tight CORS allow-list, no stack traces in prod, default creds removed. |
| A06 | Vulnerable Components | \`npm audit\` in CI, Dependabot, pin and update. |
| A07 | Identification & Auth Failures | Rate-limit login, MFA, rotate refresh tokens, invalidate sessions on password change. |
| A08 | Software & Data Integrity | Verify signatures, lockfiles, never \`eval\` remote content or deserialise untrusted data. |
| A09 | Logging & Monitoring Failures | Log auth events with a correlation id; alert on 401/403 spikes. Never log tokens. |
| A10 | Server-Side Request Forgery | Allow-list outbound hosts, block link-local \`169.254.169.254\`, resolve DNS before connecting. |

Ten lines of Express that cover more of that table than any other ten:

\`\`\`js
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use('/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 10 }));
app.use((err, req, res, _next) => {
  req.log.error({ err, reqId: req.id });
  res.status(err.status ?? 500).json({ error: err.expose ? err.message : 'Internal error' });
});
\`\`\`

That last handler matters more than it looks: leaking a stack trace or a database error string to the client is how attackers map your schema.`,
    },
  ],
  quiz: [
    {
      prompt: 'A user presents a valid session but requests another tenant’s invoice. What should the API return?',
      options: [
        '401 Unauthorized, because the credentials do not cover that resource',
        '403 Forbidden (or 404 to avoid confirming the record exists)',
        '400 Bad Request, because the ID is invalid for this user',
        '200 with an empty body',
      ],
      correctIndex: 1,
      explanation:
        '401 means unauthenticated — we do not know who you are. Here we do know, and the answer is no, which is 403. Returning 404 is also defensible because a 403 confirms the record exists.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Why is `crypto.createHash("sha256")` unacceptable for password storage?',
      options: [
        'SHA-256 has known collision attacks that let attackers forge passwords',
        'It produces a digest that is too short to be secure',
        'It cannot be used with a salt under any circumstances',
        'It is extremely fast, unsalted by default, and has no tunable cost factor',
      ],
      correctIndex: 3,
      explanation:
        'SHA-256 is not broken — it is fast, which is exactly wrong for passwords. GPUs compute billions per second. Password KDFs (argon2id, bcrypt, scrypt) are deliberately slow, salted, and have a cost parameter you raise as hardware improves.',
      difficulty: 'EASY',
    },
    {
      prompt: 'Where is the salt for a bcrypt hash stored?',
      options: [
        'Inside the hash string itself, alongside the algorithm and cost factor',
        'In a separate `salt` column you must create',
        'In an environment variable shared by all users',
        'It is derived from the user ID at verification time',
      ],
      correctIndex: 0,
      explanation:
        'A bcrypt output like `$2b$12$<22-char salt><31-char hash>` is self-describing. `bcrypt.compare` reads the algorithm, cost and salt out of the stored string, which is why you never manage them yourself.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What exactly does the `alg: none` attack exploit?',
      options: [
        'A weakness in the SHA-256 compression function',
        'Base64url decoding being ambiguous for some inputs',
        'A verifier that chooses the verification algorithm from the token’s own header',
        'Expired tokens being cached by a CDN',
      ],
      correctIndex: 2,
      explanation:
        'If the library trusts `header.alg`, an attacker rewrites it to `none`, edits the claims, drops the signature, and verification becomes a no-op. The same class of bug allows RS256 to HS256 confusion. Always pass an explicit `algorithms` allow-list.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'You run one auth service and six microservices that must verify its tokens. Which signing algorithm and why?',
      options: [
        'HS256, because the shared secret is simpler to deploy',
        'RS256, so services verify with a public key and cannot mint tokens',
        'No signature at all, since the services are on a private network',
        'HS256 with a different secret per service',
      ],
      correctIndex: 1,
      explanation:
        'HS256 uses one shared secret for both signing and verifying, so every verifier could forge admin tokens. RS256 (or ES256) splits them: the auth server keeps the private key, everyone else fetches the public key from JWKS.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'What does refresh-token rotation with reuse detection buy you?',
      options: [
        'It makes access tokens unnecessary',
        'It encrypts the refresh token so it cannot be read in transit',
        'It removes the need for HTTPS on the refresh endpoint',
        'A replayed old refresh token reveals theft, letting you revoke the whole token family',
      ],
      correctIndex: 3,
      explanation:
        'Each refresh issues a new token and revokes the old one. If a revoked token is ever presented again, either the user or a thief is replaying it — you cannot tell which, so you revoke the entire family and force re-login. Without rotation, theft is undetectable.',
      difficulty: 'HARD',
    },
    {
      prompt: 'What is the core trade-off between storing a token in `localStorage` and in an `httpOnly` cookie?',
      options: [
        'localStorage is faster; cookies are slower to read',
        'localStorage is exposed to XSS but immune to CSRF; cookies are the reverse and need SameSite/CSRF tokens',
        'Cookies cannot hold JWTs because of size limits',
        'localStorage is encrypted by the browser, cookies are not',
      ],
      correctIndex: 1,
      explanation:
        'Any XSS reads localStorage in one line. An httpOnly cookie is invisible to JS but is attached automatically, which is what enables CSRF. Cookies usually win because CSRF has a complete, cheap mitigation (SameSite + a CSRF token) and XSS token theft does not.',
      difficulty: 'MEDIUM',
    },
    {
      prompt: 'In the authorization-code flow, what problem does PKCE solve that `state` does not?',
      options: [
        'It proves the client redeeming the authorization code is the client that started the flow',
        'It encrypts the ID token so the browser cannot read it',
        'It prevents the user from consenting to the wrong scopes',
        'It removes the need to validate the redirect URI',
      ],
      correctIndex: 0,
      explanation:
        '`state` is a CSRF guard tying the callback to the session that began it. PKCE addresses code interception: the code is only redeemable by presenting the verifier whose SHA-256 hash was sent with the authorize request, so a stolen code is useless.',
      difficulty: 'HARD',
    },
  ],
  problems: [
    {
      slug: 'jwt-claim-verifier',
      title: 'Verify a JWT Without a Crypto Library',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Real verification has two halves: **the signature** and **the claims**. Libraries do the first; teams routinely forget the second and ship a system that happily accepts expired tokens minted for a different audience.

Implement the claims half. There is no crypto in this sandbox — you are validating *structure and claims*, exactly the part people get wrong.

### \`base64UrlDecode(segment)\`

Convert base64url to standard base64 (\`-\` → \`+\`, \`_\` → \`/\`), re-pad with \`=\` to a multiple of 4, and decode with \`atob\`. Return the decoded string.

### \`decodeToken(token)\`

Return \`{ header, payload, signature }\`. **Throw** if the token is not a string, does not split into exactly 3 dot-separated parts, has an empty header or payload segment, or if either segment is not valid JSON. (The signature segment may be empty — that is what an \`alg: none\` token looks like, and you want to reject it on the *algorithm* rule, not the shape rule.)

### \`verifyToken(token, options)\`

\`options\` is \`{ now, issuer, audience, algorithms }\`. \`algorithms\` defaults to \`['HS256']\`. Return \`{ valid, reason, payload }\` where \`payload\` is the claims object **only when valid**, otherwise \`null\`.

Run the checks in exactly this order and return the first failure:

| Order | Condition | \`reason\` |
| --- | --- | --- |
| 1 | \`decodeToken\` throws | \`'malformed'\` |
| 2 | \`header.alg\` is not in \`algorithms\` | \`'bad_alg'\` |
| 3 | \`payload.exp\` is not a number | \`'missing_exp'\` |
| 4 | \`payload.exp <= now\` | \`'expired'\` |
| 5 | \`payload.nbf\` is a number and \`> now\` | \`'not_yet_valid'\` |
| 6 | \`issuer\` given and \`payload.iss !== issuer\` | \`'bad_issuer'\` |
| 7 | \`audience\` given and \`payload.aud\` (string **or** array) does not contain it | \`'bad_audience'\` |

On success return \`{ valid: true, reason: null, payload }\`.

### Example

\`\`\`js
verifyToken(token, { now: 1000, issuer: 'ninja', audience: 'api' });
// { valid: true, reason: null, payload: { sub: 'u1', iss: 'ninja', aud: 'api', exp: 2000 } }
\`\`\`

### Constraints

- Use only plain JS plus \`atob\`. No Node \`crypto\`, no \`Buffer\`.
- Never return claims from a token that failed a check.`,
      starterCode: `// A JWT is header.payload.signature, each segment base64url-encoded.
// atob() is available here. There is no crypto module - you are verifying
// structure and claims, not signature bytes.

function base64UrlDecode(segment) {
  // your code here
}

function decodeToken(token) {
  // return { header, payload, signature } or throw
}

function verifyToken(token, options) {
  // return { valid, reason, payload }
}

module.exports = { base64UrlDecode, decodeToken, verifyToken };`,
      solutionCode: `function base64UrlDecode(segment) {
  let s = String(segment).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return atob(s);
}

function decodeToken(token) {
  if (typeof token !== 'string') throw new Error('malformed token');
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error('malformed token');

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (err) {
    throw new Error('malformed token');
  }

  if (!header || typeof header !== 'object') throw new Error('malformed token');
  if (!payload || typeof payload !== 'object') throw new Error('malformed token');

  return { header, payload, signature: parts[2] };
}

function verifyToken(token, options) {
  const opts = options || {};
  const algorithms = opts.algorithms || ['HS256'];
  const fail = (reason) => ({ valid: false, reason, payload: null });

  let decoded;
  try {
    decoded = decodeToken(token);
  } catch (err) {
    return fail('malformed');
  }

  const header = decoded.header;
  const payload = decoded.payload;

  // The verifier decides the algorithm, never the token.
  if (!algorithms.includes(header.alg)) return fail('bad_alg');

  if (typeof payload.exp !== 'number') return fail('missing_exp');
  if (payload.exp <= opts.now) return fail('expired');
  if (typeof payload.nbf === 'number' && payload.nbf > opts.now) return fail('not_yet_valid');
  if (opts.issuer && payload.iss !== opts.issuer) return fail('bad_issuer');

  if (opts.audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(opts.audience)) return fail('bad_audience');
  }

  return { valid: true, reason: null, payload };
}

module.exports = { base64UrlDecode, decodeToken, verifyToken };`,
      hints: [
        'base64url is base64 with - and _ swapped in and padding stripped. Put the padding back before calling atob.',
        'decodeToken should throw for anything structurally wrong; verifyToken catches that and turns it into reason "malformed".',
        'Check the algorithm allow-list before you look at any claim - a token signed with "none" must never reach your expiry logic.',
        'payload.aud may be a string or an array. Normalise with Array.isArray before checking membership.',
        'Return payload: null on every failure path so a caller cannot accidentally trust unverified claims.',
      ],
      tests: [
        {
          name: 'base64UrlDecode handles a real header segment',
          assertion:
            "solution.base64UrlDecode('eyJhbGciOiJIUzI1NiJ9') === JSON.stringify({alg:'HS256'})",
        },
        {
          name: 'decodeToken splits header, payload and signature',
          assertion:
            "(() => { const d = solution.decodeToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoiYXBpIiwiZXhwIjoyMDAwfQ.c2ln'); return d.header.alg === 'HS256' && d.payload.sub === 'u1' && d.signature === 'c2ln'; })()",
        },
        {
          name: 'decodeToken throws on a token that is not three segments',
          assertion: "throws(() => solution.decodeToken('not-a-token'))",
        },
        {
          name: 'accepts a valid, in-date token',
          assertion:
            "(() => { const r = solution.verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoiYXBpIiwiZXhwIjoyMDAwfQ.c2ln', { now: 1000, issuer: 'ninja', audience: 'api' }); return r.valid === true && r.reason === null && r.payload.sub === 'u1'; })()",
        },
        {
          name: 'rejects an expired token',
          assertion:
            "solution.verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoiYXBpIiwiZXhwIjo1MDB9.c2ln', { now: 1000, issuer: 'ninja', audience: 'api' }).reason === 'expired'",
        },
        {
          name: 'rejects alg: none',
          assertion:
            "(() => { const r = solution.verifyToken('eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoiYXBpIiwiZXhwIjoyMDAwfQ.', { now: 1000, issuer: 'ninja', audience: 'api' }); return r.valid === false && r.reason === 'bad_alg' && r.payload === null; })()",
        },
        {
          name: 'rejects RS256 when only HS256 is allowed',
          assertion:
            "solution.verifyToken('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoiYXBpIiwiZXhwIjoyMDAwfQ.c2ln', { now: 1000 }).reason === 'bad_alg'",
        },
        {
          name: 'accepts RS256 when it is on the allow-list',
          assertion:
            "solution.verifyToken('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoiYXBpIiwiZXhwIjoyMDAwfQ.c2ln', { now: 1000, algorithms: ['RS256'] }).valid === true",
        },
        {
          name: 'rejects a wrong issuer',
          assertion:
            "solution.verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6ImV2aWwiLCJhdWQiOiJhcGkiLCJleHAiOjIwMDB9.c2ln', { now: 1000, issuer: 'ninja', audience: 'api' }).reason === 'bad_issuer'",
        },
        {
          name: 'rejects a wrong audience',
          assertion:
            "solution.verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoib3RoZXIiLCJleHAiOjIwMDB9.c2ln', { now: 1000, issuer: 'ninja', audience: 'api' }).reason === 'bad_audience'",
          hidden: true,
        },
        {
          name: 'accepts an array aud that contains the audience',
          assertion:
            "solution.verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjpbImFwaSIsImFkbWluIl0sImV4cCI6MjAwMH0.c2ln', { now: 1000, issuer: 'ninja', audience: 'admin' }).valid === true",
          hidden: true,
        },
        {
          name: 'rejects a token that is not valid yet (nbf)',
          assertion:
            "solution.verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoiYXBpIiwiZXhwIjoyMDAwLCJuYmYiOjUwMDB9.c2ln', { now: 1000, issuer: 'ninja', audience: 'api' }).reason === 'not_yet_valid'",
          hidden: true,
        },
        {
          name: 'rejects a token with no exp claim',
          assertion:
            "solution.verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsImlzcyI6Im5pbmphIiwiYXVkIjoiYXBpIn0.c2ln', { now: 1000, issuer: 'ninja', audience: 'api' }).reason === 'missing_exp'",
          hidden: true,
        },
        {
          name: 'reports malformed rather than throwing',
          assertion:
            "(() => { const r = solution.verifyToken('garbage', { now: 1000 }); return r.valid === false && r.reason === 'malformed'; })()",
          hidden: true,
        },
      ],
      xp: 90,
    },
    {
      slug: 'rbac-permission-checker',
      title: 'RBAC with Inheritance, Wildcards and Ownership',
      difficulty: 'MEDIUM',
      runtime: 'javascript',
      statement: `Every route guard you will ever write boils down to one function: *may this subject perform this action on this resource?* Build it.

A role map looks like this:

\`\`\`js
const ROLES = {
  viewer: { permissions: ['post:read'] },
  author: { inherits: ['viewer'], permissions: ['post:create', 'post:update:own'] },
  editor: { inherits: ['author'], permissions: ['post:*'] },
  admin:  { inherits: ['editor'], permissions: ['*'] },
};
\`\`\`

### \`resolvePermissions(roles, roleName)\`

Return the full permission set for a role — its own permissions plus everything it inherits, transitively — as a **sorted array of unique strings**. An unknown role name yields \`[]\`. The map may contain inheritance cycles; do not blow the stack.

### \`can(roles, user, action, resource)\`

\`user\` is \`{ id, roles: [...] }\`. \`action\` is a string like \`'post:update'\`. \`resource\` is \`null\` or an object with an \`ownerId\`. Return a boolean.

A permission grants an action when:

| Permission | Grants |
| --- | --- |
| \`'*'\` | everything |
| \`'post:update'\` | exactly \`post:update\` |
| \`'post:*'\` | any action starting with \`post:\` |
| \`'post:update:own'\` | \`post:update\`, but **only** when \`resource\` exists and \`resource.ownerId === user.id\` |

Return \`false\` for a missing user or a user whose \`roles\` is not an array.

### Examples

\`\`\`js
can(ROLES, { id: 'u1', roles: ['author'] }, 'post:update', { ownerId: 'u1' }); // true
can(ROLES, { id: 'u1', roles: ['author'] }, 'post:update', { ownerId: 'u2' }); // false
can(ROLES, { id: 'u9', roles: ['editor'] }, 'post:delete', { ownerId: 'u1' }); // true  (post:*)
can(ROLES, { id: 'u9', roles: ['viewer'] }, 'post:create', null);              // false
\`\`\`

### Constraints

- Roles may inherit from several parents.
- \`resolvePermissions\` must terminate on a cyclic role map.`,
      starterCode: `function resolvePermissions(roles, roleName) {
  // every permission this role has, directly or by inheritance, sorted + unique
}

function can(roles, user, action, resource) {
  // true if any of the user's permissions grants this action on this resource
}

module.exports = { resolvePermissions, can };`,
      solutionCode: `function resolvePermissions(roles, roleName, seen) {
  const visited = seen || new Set();
  if (visited.has(roleName)) return []; // cycle guard
  visited.add(roleName);

  const role = roles && roles[roleName];
  if (!role) return [];

  const out = new Set(role.permissions || []);
  for (const parent of role.inherits || []) {
    for (const perm of resolvePermissions(roles, parent, visited)) out.add(perm);
  }
  return Array.from(out).sort();
}

function grants(permission, action, isOwner) {
  if (permission === '*') return true;

  let perm = permission;
  let ownOnly = false;
  if (perm.endsWith(':own')) {
    ownOnly = true;
    perm = perm.slice(0, -4);
  }
  if (ownOnly && !isOwner) return false;

  if (perm === action) return true;
  if (perm.endsWith(':*')) return action.startsWith(perm.slice(0, -1));
  return false;
}

function can(roles, user, action, resource) {
  if (!user || !Array.isArray(user.roles)) return false;

  const isOwner = !!resource && resource.ownerId === user.id;

  const permissions = new Set();
  for (const roleName of user.roles) {
    for (const perm of resolvePermissions(roles, roleName)) permissions.add(perm);
  }

  for (const perm of permissions) {
    if (grants(perm, action, isOwner)) return true;
  }
  return false;
}

module.exports = { resolvePermissions, can };`,
      hints: [
        'Recurse over inherits with a shared Set of already-visited role names - that is both the dedupe and the cycle guard.',
        'Strip the :own suffix first, then compare. The remaining string is the action the permission really covers.',
        'For post:* strip the trailing * and use action.startsWith("post:").',
        'Ownership is computed once from the loaded resource, never from anything the client sent.',
      ],
      tests: [
        {
          name: 'resolves inherited permissions, sorted and unique',
          assertion:
            "deepEqual(solution.resolvePermissions({ a: { permissions: ['x'] }, b: { inherits: ['a'], permissions: ['y', 'x'] } }, 'b'), ['x', 'y'])",
        },
        {
          name: 'unknown role resolves to an empty list',
          assertion: "deepEqual(solution.resolvePermissions({}, 'ghost'), [])",
        },
        {
          name: 'survives a cyclic role map',
          assertion:
            "deepEqual(solution.resolvePermissions({ a: { inherits: ['b'], permissions: ['x'] }, b: { inherits: ['a'], permissions: ['y'] } }, 'a'), ['x', 'y'])",
        },
        {
          name: 'author can update their own post',
          assertion:
            "(() => { const R = { viewer: { permissions: ['post:read'] }, author: { inherits: ['viewer'], permissions: ['post:create', 'post:update:own'] } }; return solution.can(R, { id: 'u1', roles: ['author'] }, 'post:update', { ownerId: 'u1' }) === true; })()",
        },
        {
          name: 'author cannot update someone else’s post',
          assertion:
            "(() => { const R = { viewer: { permissions: ['post:read'] }, author: { inherits: ['viewer'], permissions: ['post:create', 'post:update:own'] } }; return solution.can(R, { id: 'u1', roles: ['author'] }, 'post:update', { ownerId: 'u2' }) === false; })()",
        },
        {
          name: 'inherited permission works (author can read)',
          assertion:
            "(() => { const R = { viewer: { permissions: ['post:read'] }, author: { inherits: ['viewer'], permissions: ['post:create'] } }; return solution.can(R, { id: 'u1', roles: ['author'] }, 'post:read', null) === true; })()",
        },
        {
          name: 'wildcard scope grants any post action',
          assertion:
            "(() => { const R = { editor: { permissions: ['post:*'] } }; const u = { id: 'u9', roles: ['editor'] }; return solution.can(R, u, 'post:delete', { ownerId: 'u1' }) === true && solution.can(R, u, 'billing:refund', null) === false; })()",
        },
        {
          name: 'admin wildcard grants everything',
          assertion:
            "(() => { const R = { editor: { permissions: ['post:*'] }, admin: { inherits: ['editor'], permissions: ['*'] } }; return solution.can(R, { id: 'u0', roles: ['admin'] }, 'billing:refund', null) === true; })()",
          hidden: true,
        },
        {
          name: 'viewer cannot create',
          assertion:
            "(() => { const R = { viewer: { permissions: ['post:read'] } }; return solution.can(R, { id: 'u1', roles: ['viewer'] }, 'post:create', null) === false; })()",
          hidden: true,
        },
        {
          name: 'no user means no access',
          assertion:
            "solution.can({ admin: { permissions: ['*'] } }, null, 'post:read', null) === false && solution.can({ admin: { permissions: ['*'] } }, { id: 'u1' }, 'post:read', null) === false",
          hidden: true,
        },
        {
          name: 'own-scoped permission needs a resource',
          assertion:
            "(() => { const R = { author: { permissions: ['post:update:own'] } }; return solution.can(R, { id: 'u1', roles: ['author'] }, 'post:update', null) === false; })()",
          hidden: true,
        },
      ],
      xp: 80,
    },
  ],
  flashcards: [
    {
      front: 'Authentication vs authorisation',
      back: 'AuthN = who you are (401 when it fails). AuthZ = what you may do (403 when it fails). AuthN happens once at the edge; AuthZ happens on every object access.',
      tags: ['auth', 'concepts'],
    },
    {
      front: 'Why not SHA-256 for passwords?',
      back: 'Too fast (billions/sec on a GPU), unsalted by default, and no cost parameter. Use argon2id, bcrypt or scrypt — deliberately slow and tunable.',
      tags: ['auth', 'hashing'],
    },
    {
      front: 'What does a bcrypt hash string contain?',
      back: '`$2b$<cost>$<22-char salt><31-char hash>` — algorithm, cost factor and salt are all embedded, so you store one column and nothing else.',
      tags: ['auth', 'bcrypt'],
    },
    {
      front: 'The three JWT segments',
      back: '`header.payload.signature`, each base64url. Signed, **not** encrypted — anyone can base64-decode the payload, so never put PII or secrets in it.',
      tags: ['jwt'],
    },
    {
      front: 'Registered JWT claims',
      back: 'iss (issuer), sub (subject), aud (audience), exp (expiry), nbf (not before), iat (issued at), jti (token id, used for deny-listing).',
      tags: ['jwt'],
    },
    {
      front: 'HS256 vs RS256',
      back: 'HS256: one shared secret, so every verifier can also forge. RS256: private key signs, public key (via JWKS) verifies — the right choice once more than one service consumes the token.',
      tags: ['jwt', 'crypto'],
    },
    {
      front: 'The `alg: none` attack, and its fix',
      back: 'A verifier that reads the algorithm from the token header can be handed `{"alg":"none"}` with edited claims and no signature. Fix: always pass an explicit `algorithms` allow-list.',
      tags: ['jwt', 'security'],
    },
    {
      front: 'Refresh token rotation with reuse detection',
      back: 'Each refresh issues a new token and revokes the old one. Presenting a revoked token means replay, so revoke the entire token family and force re-login.',
      tags: ['auth', 'tokens'],
    },
    {
      front: 'localStorage vs httpOnly cookie for tokens',
      back: 'localStorage: exposed to XSS, immune to CSRF. httpOnly cookie: immune to XSS reads, exposed to CSRF. Cookies win because CSRF has a complete fix (SameSite + CSRF token).',
      tags: ['auth', 'browser', 'security'],
    },
    {
      front: 'Why PKCE?',
      back: 'The authorization code travels through the browser and can be intercepted. PKCE binds it to the originating client: redemption requires the verifier whose SHA-256 hash was sent with the authorize request.',
      tags: ['oauth', 'security'],
    },
    {
      front: 'Access token vs ID token',
      back: 'Access token is for the API — treat it as opaque and never parse it. ID token (OIDC) is for the client — a JWT about the user; verify it, read `sub`, discard it.',
      tags: ['oauth', 'oidc'],
    },
    {
      front: 'OWASP A01 — Broken Access Control',
      back: 'The #1 risk. A route guard that only checks "logged in" then loads by client-supplied ID. Fix: authorise per object against the loaded row, and deny by default.',
      tags: ['owasp', 'security'],
    },
  ],
  resources: [
    { label: 'RFC 7519 — JSON Web Token', url: 'https://datatracker.ietf.org/doc/html/rfc7519', kind: 'SPEC' },
    { label: 'RFC 7636 — PKCE for OAuth Public Clients', url: 'https://datatracker.ietf.org/doc/html/rfc7636', kind: 'SPEC' },
    { label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/', kind: 'ARTICLE' },
    {
      label: 'OWASP Password Storage Cheat Sheet',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
      kind: 'ARTICLE',
    },
    { label: 'oauth.net — OAuth 2.0 overview and best practice', url: 'https://oauth.net/2/', kind: 'DOCS' },
  ],
};

export default day;
