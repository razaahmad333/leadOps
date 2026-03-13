# LeadOps Ingestion Guide

This guide shows how to push inbound data into HikmahOne LeadOps with `curl` or scripts.

## Base URL

```bash
API_BASE="http://localhost:3000/v1"
```

## Tenant Resolution (Important)

Ingestion requests must resolve tenant context.

- `DEPLOYMENT_MODE=single`: tenant context is fixed by API config (`SINGLE_TENANT_ID` or first tenant fallback).
- `DEPLOYMENT_MODE=multi`: resolve via subdomain, `x-tenant-id`, or tenant-scoped bearer token.

Example tenant signal for local multi-tenant mode:

```bash
TENANT_ID="demo-lab"
# or tenant UUID
```

## Channel Support Matrix

| Channel | Status | Endpoint | Auth |
|---|---|---|---|
| Website Form | Implemented | `POST /v1/intake/website` | Public |
| WhatsApp Inbound | Scaffolded (no public webhook endpoint yet) | Use `POST /v1/leads` | Bearer token |
| Calls/Call Center | Implemented via generic lead API | `POST /v1/leads` | Bearer token |
| Walk-in/Manual Imports | Implemented via generic lead API | `POST /v1/leads` | Bearer token |

## 1) Website Form Ingestion (Public)

Endpoint:

```text
POST /v1/intake/website
```

Payload example:

```json
{
  "fullName": "Mariam Siddiqui",
  "phone": "+919876543210",
  "email": "mariam@example.com",
  "message": "Need CBC and thyroid package",
  "sourcePage": "/packages/thyroid",
  "providerMessageId": "web-evt-20260226-0001"
}
```

`curl` (single-tenant mode):

```bash
curl -X POST "$API_BASE/intake/website" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Mariam Siddiqui",
    "phone": "+919876543210",
    "email": "mariam@example.com",
    "message": "Need CBC and thyroid package",
    "sourcePage": "/packages/thyroid",
    "providerMessageId": "web-evt-20260226-0001"
  }'
```

`curl` (multi-tenant mode):

```bash
curl -X POST "$API_BASE/intake/website" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "fullName": "Mariam Siddiqui",
    "phone": "+919876543210",
    "email": "mariam@example.com",
    "message": "Need CBC and thyroid package",
    "sourcePage": "/packages/thyroid",
    "providerMessageId": "web-evt-20260226-0001"
  }'
```

Expected response:
- First delivery: `{ "created": true, "leadId": "<uuid>" }`
- Duplicate `providerMessageId`: `{ "created": false }`

Notes:
- Public intake endpoint is rate-limited (`20 req/min/IP`).
- `providerMessageId` is optional but strongly recommended for idempotency.

## 2) Authenticated Ingestion (`POST /v1/leads`)

Use generic lead creation for channels without public webhook endpoints.

### Step A: Login

Global login endpoint does not require tenant context.

```bash
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@local.test",
    "password": "Password123!"
  }')
```

Use an account that has membership in the tenant you plan to ingest into.

If the account has one active membership (for example `admin@local.test` in local seed), response is:
- `{ "kind": "authenticated", "accessToken": "...", ... }`

If the account has multiple memberships (for example `owner@local.test`), response is:
- `{ "kind": "tenant_selection_required", "selectionToken": "...", "tenants": [...] }`

In that case, call tenant selection:

```bash
SELECT_RESPONSE=$(curl -s -X POST "$API_BASE/auth/select-tenant" \
  -H "Content-Type: application/json" \
  -d "{
    \"selectionToken\": \"<selectionToken>\",
    \"tenantId\": \"$TENANT_ID\"
  }")
```

### Step B: Extract access token

```bash
TOKEN=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
# If tenant selection was required, extract from SELECT_RESPONSE instead.
```

### Step C: Create lead from channel payload

Endpoint:

```text
POST /v1/leads
```

Minimum required:
- `name`
- `nextFollowUpAt` (ISO datetime)

WhatsApp-style payload:

```bash
curl -X POST "$API_BASE/leads" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "name": "WhatsApp +919876543210",
    "phone": "+919876543210",
    "source": "whatsapp",
    "stageKey": "ENQUIRY_RECEIVED",
    "note": "User asked for full body checkup package",
    "nextFollowUpAt": "2026-03-13T11:30:00.000Z",
    "intakeData": {
      "providerMessageId": "wa-msg-10001",
      "channel": "whatsapp",
      "testOrPackage": "Diabetes Package",
      "homeCollection": true,
      "pincode": "560001"
    }
  }'
```

Call-center payload:

```bash
curl -X POST "$API_BASE/leads" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "name": "Ayesha Khan",
    "phone": "+919900001111",
    "source": "call",
    "stageKey": "ENQUIRY_RECEIVED",
    "note": "Incoming call: requested fasting sugar and lipid profile",
    "nextFollowUpAt": "2026-03-13T12:00:00.000Z",
    "intakeData": {
      "agentId": "agent-07",
      "callId": "twilio-CA12345",
      "testOrPackage": "LFT",
      "homeCollection": false,
      "preferredSlot": "2026-03-13T14:30:00.000Z",
      "pincode": "560048",
      "source": "call"
    }
  }'
```

## 3) Example Node Script (Batch Push)

Create `scripts/push-intake.mjs`:

```js
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/v1';
const TENANT_ID = process.env.TENANT_ID ?? 'demo-lab';
const IDENTIFIER = process.env.IDENTIFIER ?? 'admin@local.test';
const PASSWORD = process.env.PASSWORD ?? 'Password123!';

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} failed ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function login() {
  const login = await post('/auth/login', { identifier: IDENTIFIER, password: PASSWORD });
  if (login.kind === 'authenticated') {
    return login.accessToken;
  }
  if (login.kind === 'tenant_selection_required') {
    const selected = await post('/auth/select-tenant', {
      selectionToken: login.selectionToken,
      tenantId: TENANT_ID,
    });
    return selected.accessToken;
  }
  throw new Error(`Unexpected auth response kind: ${login.kind}`);
}

async function pushLead(token, payload) {
  const res = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`push failed ${res.status}: ${text}`);
  return JSON.parse(text);
}

const sample = [
  {
    name: 'Batch Import 1',
    phone: '+911111111111',
    source: 'call',
    stageKey: 'ENQUIRY_RECEIVED',
    nextFollowUpAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    intakeData: { source: 'call', agentId: 'agent-01' },
  },
  {
    name: 'Batch Import 2',
    phone: '+922222222222',
    source: 'whatsapp',
    stageKey: 'ENQUIRY_RECEIVED',
    nextFollowUpAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    intakeData: { source: 'whatsapp', providerMessageId: 'wa-batch-2' },
  },
];

const token = await login();
for (const payload of sample) {
  const created = await pushLead(token, payload);
  console.log('created', created.id);
}
```

Run:

```bash
node scripts/push-intake.mjs
```

## Error Handling Checklist

- `400 Validation failed`: payload shape or datetime invalid.
- `401 Invalid email, mobile number, or password`: bad login credentials.
- `401 Tenant access not found for this account`: wrong tenant selected for account.
- `404 Tenant not found`: invalid tenant signal in multi-tenant mode.
- `429 Rate limit exceeded`: public website intake throttled.

## Current Limitations

- No public WhatsApp webhook endpoint yet (adapter scaffolding exists only).
- No dedicated Calls endpoint yet; use generic `/v1/leads`.
- Outbound WhatsApp adapter is scaffold-only in v1.
