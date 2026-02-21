# Integration Guide

## Front-end (Electron/Client)

### 1. Generate PKCE and Login

```javascript
import crypto from 'crypto';

// Generate PKCE
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// Login
async function login(email, password) {
  const pkce = generatePKCE();
  
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      client_id: 'electron-app',
      redirect_uri: 'http://localhost:14000/callback',
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256'
    })
  });
  
  const { code } = await response.json();
  
  // Exchange code for tokens
  return exchangeCode(code, pkce.verifier);
}

async function exchangeCode(code, verifier) {
  const response = await fetch('http://localhost:3000/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'http://localhost:14000/callback',
      client_id: 'electron-app',
      code_verifier: verifier
    })
  });
  
  const tokens = await response.json();
  // { access_token, refresh_token, expires_in, token_type }
  
  // Store tokens (e.g., localStorage, secure storage)
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
  
  return tokens;
}
```

### 2. Use Access Token in API Requests

```javascript
async function callAPI() {
  const accessToken = localStorage.getItem('access_token');
  
  const response = await fetch('https://api.example.com/data', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  return response.json();
}
```

### 3. Refresh Token When Expired

```javascript
async function refreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  
  const response = await fetch('http://localhost:3000/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'electron-app'
    })
  });
  
  const tokens = await response.json();
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
  
  return tokens;
}
```

### 4. Logout

```javascript
async function logout() {
  const refreshToken = localStorage.getItem('refresh_token');
  
  await fetch('http://localhost:3000/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: 'electron-app'
    })
  });
  
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}
```

---

## Back-end (API/Resource Server)

### Validate JWT Using JWKS

```javascript
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('http://localhost:3000/.well-known/jwks.json'));

async function validateAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'http://localhost:3000',
      audience: 'api://default'
    });
    
    return {
      userId: payload.sub,
      roles: payload.roles,
      clientId: payload.client_id
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// Express Middleware
export async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  const token = auth.slice('Bearer '.length);
  
  try {
    req.user = await validateAccessToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Usage
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ 
    message: 'OK', 
    userId: req.user.userId, 
    roles: req.user.roles 
  });
});
```

### Fastify Plugin

```javascript
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('http://localhost:3000/.well-known/jwks.json'));

async function validateAccessToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'http://localhost:3000',
    audience: 'api://default'
  });
  
  return {
    userId: payload.sub,
    roles: payload.roles,
    clientId: payload.client_id
  };
}

// Fastify Decorator
app.decorateRequest('user', null);

app.addHook('onRequest', async (request, reply) => {
  const auth = request.headers.authorization;
  
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'unauthorized' });
    return;
  }
  
  const token = auth.slice('Bearer '.length);
  
  try {
    request.user = await validateAccessToken(token);
  } catch (error) {
    reply.code(401).send({ error: 'invalid_token' });
  }
});

// Usage
app.get('/protected', async (request, reply) => {
  reply.send({ 
    message: 'OK', 
    userId: request.user.userId, 
    roles: request.user.roles 
  });
});
```

---

## Authentication Flow Summary

1. **Front-end**: Generate PKCE → Login → Receive authorization code
2. **Front-end**: Exchange code with verifier → Receive access + refresh tokens
3. **Front-end**: Send `Authorization: Bearer <access_token>` in API requests
4. **Back-end**: Validate JWT using JWKS from auth service
5. **Front-end**: Refresh token when access token expires (10 minutes)

---

## cURL Examples

### Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Doe","email":"user@example.com","password":"StrongPass123"}'
```

### Login (returns authorization code)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"user@example.com",
    "password":"StrongPass123",
    "client_id":"electron-app",
    "redirect_uri":"http://localhost:14000/callback",
    "code_challenge":"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    "code_challenge_method":"S256",
    "state":"abc123"
  }'
```

### Token Exchange (authorization_code + PKCE)

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type":"authorization_code",
    "code":"<AUTH_CODE>",
    "redirect_uri":"http://localhost:14000/callback",
    "client_id":"electron-app",
    "code_verifier":"<CODE_VERIFIER>"
  }'
```

### Refresh Token Rotation

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type":"refresh_token",
    "refresh_token":"<REFRESH_TOKEN>",
    "client_id":"electron-app"
  }'
```

### Logout (revoke refresh token)

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token":"<REFRESH_TOKEN>",
    "client_id":"electron-app"
  }'
```

### Update Current User

```bash
curl -X PATCH http://localhost:3000/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "fullName":"Jane Doe Silva",
    "email":"new-user@example.com",
    "docType":"CPF",
    "document":"11144477735"
  }'
```

### Get Current User

```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### JWKS

```bash
curl http://localhost:3000/.well-known/jwks.json
```

---

## Setup Required

Before testing, create an OAuth client in the database:

```sql
INSERT INTO "OAuthClient" (id, name, "isPublic", "redirectUris", "createdAt")
VALUES (
  'electron-app',
  'Electron App',
  true,
  ARRAY['http://localhost:14000/callback'],
  NOW()
);
```

Or use Prisma Studio:

```bash
npx prisma studio
```
