# Integration Guide (Front-end)

Este documento é a referência oficial para integrar o front-end com o serviço de autenticação deste projeto.

Objetivo: usar sessão baseada em cookie HttpOnly para refresh token **e access token**, com PKCE para login por email/senha e login social (Google, GitHub e Microsoft), sem depender de `localStorage` para tokens.

## 1) Regras obrigatórias do front

1. Sempre envie `credentials: 'include'` em chamadas para:
   - `POST /auth/token`
   - `POST /auth/logout`
  - endpoints protegidos da API (ex.: `GET /users/me`, `PATCH /users/me`)
2. Nunca dependa de `localStorage` para `refresh_token` ou `access_token`.
  - ambos podem ser usados por cookie HttpOnly.
3. Para login social, sempre inicie com:
   - `GET /auth/google?...`
   - `GET /auth/github?...`
   - `GET /auth/microsoft?...`
   incluindo `redirect_uri`, `client_id`, `code_challenge`, `code_challenge_method=S256`.
4. O `code_verifier` do PKCE precisa sobreviver ao redirect do provider.
  - Use `sessionStorage` (recomendado) ou cookie não-HttpOnly próprio do front.
5. O `redirect_uri` precisa:
   - ser URL válida (`http`/`https`),
   - estar cadastrado no `OAuthClient.redirectUris` do `client_id`,
   - ter origem permitida em `CORS_ORIGIN` do auth server.

## 1.1) Deploy com auth/api em subdomínios diferentes

Se seu auth estiver em `auth.pscodium.dev` e sua API em `api.pscodium.dev`, configure no auth server:

- `COOKIE_DOMAIN=.pscodium.dev`
- `COOKIE_SAME_SITE=lax` (ou `none` se seu cenário realmente for cross-site)
- `BASE_URL=https://auth.pscodium.dev`
- `CORS_ORIGIN` incluindo explicitamente a origem do front (ex.: `https://app.pscodium.dev`)

Sem `COOKIE_DOMAIN` compartilhado, o cookie fica host-only em `auth.pscodium.dev` e não é enviado para `api.pscodium.dev`.

---

## 2) Fluxo de login por email/senha (Authorization Code + PKCE)

### 2.1 Gerar PKCE

```ts
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(hash);
}

function randomVerifier(length = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export async function createPkcePair() {
  const verifier = randomVerifier(64);
  const challenge = await sha256(verifier);
  return { verifier, challenge, method: 'S256' as const };
}
```

### 2.2 Login e recebimento do `code`

```ts
const AUTH_BASE_URL = 'http://localhost:3000';
const CLIENT_ID = 'electron-app';
const FRONT_CALLBACK_URL = 'http://localhost:14000/callback';

export async function loginWithPassword(email: string, password: string) {
  const pkce = await createPkcePair();

  const response = await fetch(`${AUTH_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      client_id: CLIENT_ID,
      redirect_uri: FRONT_CALLBACK_URL,
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const { code } = await response.json();
  return exchangeAuthorizationCode(code, pkce.verifier);
}
```

### 2.3 Troca de `code` por tokens

```ts
export async function exchangeAuthorizationCode(code: string, codeVerifier: string) {
  const response = await fetch(`${AUTH_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: FRONT_CALLBACK_URL,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${body}`);
  }

  return response.json();
  // resposta inclui access_token e, quando aplicável, refresh_token.
  // backend também envia access_token e refresh_token em cookies HttpOnly.
}
```

---

## 3) Fluxo de login social (Google/GitHub/Microsoft)

## Importante

O backend guarda contexto do redirect social em cookie HttpOnly temporário (`/auth`, 10 minutos):
- `google-social-redirect-uri`
- `github-social-redirect-uri`
- `microsoft-social-redirect-uri`

Além disso, o plugin OAuth guarda cookies de state/verifier do provider.

Se o front iniciar o fluxo de forma incorreta (sem query params obrigatórios, em contexto que perde cookies, ou sem persistir `code_verifier` entre redirects), o callback social quebra.

### 3.1 Iniciar social login corretamente

```ts
function buildSocialStartUrl(
  provider: 'google' | 'github' | 'microsoft',
  codeChallenge: string
) {
  const url = new URL(`${AUTH_BASE_URL}/auth/${provider}`);
  url.searchParams.set('redirect_uri', FRONT_CALLBACK_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function startSocialLogin(provider: 'google' | 'github' | 'microsoft') {
  const pkce = await createPkcePair();

  // Necessário para sobreviver ao redirect sem usar localStorage
  sessionStorage.setItem('pending_social_code_verifier', pkce.verifier);

  const socialStartUrl = buildSocialStartUrl(provider, pkce.challenge);

  // Web SPA:
  window.location.assign(socialStartUrl);

  // Electron: shell.openExternal(socialStartUrl)
}
```

### 3.2 Processar callback do front e trocar `code`

```ts
export async function handleFrontCallback(callbackUrl: string) {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');

  if (!code) {
    throw new Error('Missing code in callback URL');
  }

  const codeVerifier = sessionStorage.getItem('pending_social_code_verifier');
  if (!codeVerifier) {
    throw new Error('Missing PKCE code verifier (social redirect lost state)');
  }

  const tokens = await exchangeAuthorizationCode(code, codeVerifier);

  sessionStorage.removeItem('pending_social_code_verifier');

  return tokens;
}
```

---

## 4) Refresh token (cookie HttpOnly)

```ts
export async function refreshSession() {
  const response = await fetch(`${AUTH_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID
    })
  });

  if (!response.ok) {
    throw new Error(`Refresh failed: ${response.status}`);
  }

  return response.json();
}
```

Observações:
- `refresh_token` no body é opcional; se omitido, backend lê do cookie `refresh_token`.
- Sem `credentials: 'include'`, o cookie não é enviado e o refresh falha.

### 4.1 Chamar API protegida sem guardar token em storage

Com o backend atual, o acesso autenticado pode usar cookie HttpOnly (`access_token`) automaticamente.

```ts
export async function getCurrentUser() {
  const response = await fetch(`${AUTH_BASE_URL}/users/me`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Get me failed: ${response.status}`);
  }

  return response.json();
}
```

```ts
export async function updateCurrentUser(payload: {
  fullName?: string;
  email?: string;
  docType?: 'CPF' | 'CNPJ';
  document?: string;
}) {
  const response = await fetch(`${AUTH_BASE_URL}/users/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Update me failed: ${response.status}`);
  }

  return response.json();
}
```

Observação:
- `Authorization: Bearer` continua suportado para compatibilidade, mas para segurança no front o recomendado é cookie HttpOnly + `credentials: 'include'`.
- Em arquitetura multi-subdomínio, o cookie só chega na API de dados se `Domain` estiver configurado para o domínio pai (ex.: `.pscodium.dev`).

---

## 5) Logout

```ts
export async function logout() {
  const response = await fetch(`${AUTH_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ client_id: CLIENT_ID })
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Logout failed: ${response.status}`);
  }
}
```

---

## 6) Causa comum do problema no social após remover localStorage

Se email/senha funciona e social não, normalmente é um destes pontos:

1. `code_verifier` social foi perdido no redirect.
   - Correção: guardar temporariamente em `sessionStorage` até a troca de token.
2. Social start foi chamado sem `redirect_uri`, `client_id`, `code_challenge`.
   - Correção: usar sempre URL de início com os 4 parâmetros.
3. `POST /auth/token` sem `credentials: 'include'`.
   - Correção: incluir sempre para receber/enviar cookie HttpOnly.
4. `redirect_uri` inválido para o cliente ou origem fora de `CORS_ORIGIN`.
   - Correção: alinhar DB (`OAuthClient.redirectUris`) e env (`CORS_ORIGIN`).
5. Início e callback em contextos de browser diferentes.
   - Correção: manter fluxo no mesmo contexto de cookies (ou tratar handshake no app quando usar browser externo).
6. Chamadas à API protegida sem `credentials: 'include'`.
  - Correção: incluir `credentials` para enviar `access_token` cookie.
7. Cookie criado como host-only em `auth.<dominio>`.
  - Correção: configurar `COOKIE_DOMAIN=.<dominio>` no serviço de auth.

---

## 7) Contrato de endpoints (resumo)

### `POST /auth/login`
Body:
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "client_id": "electron-app",
  "redirect_uri": "http://localhost:14000/callback",
  "code_challenge": "...",
  "code_challenge_method": "S256"
}
```
Resposta:
```json
{
  "code": "<authorization_code>",
  "expires_in": 600
}
```

### `GET /auth/{provider}`
Query obrigatória para fluxo de código interno:
- `redirect_uri`
- `client_id`
- `code_challenge`
- `code_challenge_method=S256`

### `POST /auth/token`
Body (`authorization_code`):
```json
{
  "grant_type": "authorization_code",
  "code": "<authorization_code>",
  "redirect_uri": "http://localhost:14000/callback",
  "client_id": "electron-app",
  "code_verifier": "..."
}
```

Body (`refresh_token`):
```json
{
  "grant_type": "refresh_token",
  "client_id": "electron-app"
}
```

Observação:
- A resposta também pode incluir tokens no JSON por compatibilidade, mas o front seguro não precisa persisti-los em storage.

### `POST /auth/logout`
Body:
```json
{
  "client_id": "electron-app"
}
```

---

## 8) Setup mínimo de banco

Antes de testar, garanta clientes OAuth cadastrados:

```sql
INSERT INTO "OAuthClient" (id, name, "isPublic", "redirectUris", "createdAt", "updatedAt")
VALUES (
  'electron-app',
  'Electron App',
  true,
  ARRAY['http://localhost:14000/callback'],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "OAuthClient" (id, name, "isPublic", "redirectUris", "accessTokenExpiresIn", "refreshTokenExpiresIn", "createdAt", "updatedAt")
VALUES (
  'social_oauth',
  'Social OAuth',
  true,
  ARRAY[]::TEXT[],
  600,
  2592000,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

---

## 9) Checklist rápido para o front

- Implementou PKCE (`verifier` + `challenge S256`).
- Em social login, guardou `code_verifier` até voltar do callback.
- Chama `/auth/{provider}` com query completa obrigatória.
- Usa `credentials: 'include'` em `/auth/token`, `/auth/logout` e endpoints protegidos.
- Não depende de `localStorage` para refresh token nem access token.
- `redirect_uri` está cadastrado e permitido.

## 10) Checklist rápido de produção (subdomínios)

- Auth em HTTPS com `BASE_URL` correto.
- `Set-Cookie` do `access_token` com `Domain=.pscodium.dev`, `Path=/`, `HttpOnly`, `Secure`.
- `Set-Cookie` do `refresh_token` com `Domain=.pscodium.dev`, `Path=/auth`, `HttpOnly`, `Secure`.
- Front usa `credentials: 'include'` em todas as chamadas autenticadas.
- `api.pscodium.dev` responde CORS com `Access-Control-Allow-Credentials: true` e `Access-Control-Allow-Origin` explícito.
