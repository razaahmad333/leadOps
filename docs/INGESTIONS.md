# LeadOps Ingestion Guide

This guide shows how to push inbound data into HikmahOne LeadOps using `curl` or scripts.

## Base URL

For local development:

```bash
API_BASE="http://localhost:3000/v1"
```

## Tenant Resolution (Important)

All ingestion requests run in a tenant context.

- `DEPLOYMENT_MODE=single`: no tenant header required; API uses `SINGLE_TENANT_ID`.
- `DEPLOYMENT_MODE=multi`: send `x-tenant-id` (tenant UUID or slug) unless you use subdomain routing.

Example (multi-tenant mode):

```bash
TENANT_ID="demo-lab"
# or TENANT_ID="0e51afec-c11d-4858-aee3-d7fc1930fcb6"
```

## Channel Support Matrix

| Channel | Status | Endpoint | Auth |
|---|---|---|---|
| Website Form | Implemented | `POST /v1/intake/website` | Public |
| WhatsApp Inbound | Scaffolded (no public webhook endpoint yet) | Use `POST /v1/leads` for now | Bearer token |
| Calls/Call Center | Implemented via generic lead API | `POST /v1/leads` | Bearer token |
| Walk-in/Manual Imports | Implemented via generic lead API | `POST /v1/leads` | Bearer token |

## 1) Website Form Ingestion (Public)

Endpoint:

```text
POST /v1/intake/website
```

Payload:

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

- First time: `{ "created": true, "leadId": "<uuid>" }`
- Duplicate `providerMessageId`: `{ "created": false }` (idempotent skip)

Notes:

- Rate limit applies on this public endpoint: `20 requests / minute / IP`.
- `providerMessageId` is optional but recommended for idempotency.

## 2) Authenticated Ingestion (WhatsApp / Calls / Scripts)

Use `POST /v1/leads` as the generic ingestion route for channels that are not yet exposed as public webhooks.

### Step A: Login and get token

```bash
TOKEN=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "email": "owner+lab@local.test",
    "password": "Password123!"
  }' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
```

In single-tenant mode, remove `-H "x-tenant-id: $TENANT_ID"`.

### Step B: Create lead/enquiry from channel payload

Endpoint:

```text
POST /v1/leads
```

Minimum required:

- `name`
- `nextFollowUpAt` (ISO datetime)

#### Example: WhatsApp ingestion via generic lead API

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
    "nextFollowUpAt": "2026-02-27T05:30:00.000Z",
    "intakeData": {
      "providerMessageId": "wa-msg-10001",
      "channel": "whatsapp",
      "source": "whatsapp",
      "testOrPackage": "Diabetes Package",
      "homeCollection": true,
      "pincode": "560001"
    }
  }'
```

#### Example: Call center ingestion

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
    "nextFollowUpAt": "2026-02-27T06:00:00.000Z",
    "intakeData": {
      "agentId": "agent-07",
      "callId": "twilio-CA12345",
      "testOrPackage": "LFT",
      "homeCollection": false,
      "preferredSlot": "2026-02-27T08:30:00.000Z",
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
const EMAIL = process.env.EMAIL ?? 'owner+lab@local.test';
const PASSWORD = process.env.PASSWORD ?? 'Password123!';

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const json = await res.json();
  return json.accessToken;
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

- `400 Validation failed`: payload shape/date invalid.
- `401 Invalid email or password`: wrong creds for resolved tenant.
- `404 Tenant not found`: missing/wrong `x-tenant-id` in multi mode.
- `429 Rate limit exceeded`: too many public website intake requests.

## Current Limitations

- No public WhatsApp webhook endpoint yet (adapter scaffolding exists only).
- No dedicated Calls endpoint yet; use generic `/v1/leads` ingestion.
- Outbound WhatsApp adapter is scaffold-only in v1.
