# MCP Code Mode Demo

A reference demo that makes the following architecture explicit and easy to inspect:

- **MCP Gateway / MCP Server** as the control plane
- **Shared master OpenAPI spec** distributed by the gateway
- **Client-side filtering** of visible operations for the demo UI
- **Groq** as the LLM provider for **true Code Mode** generation
- **Cloudflare Worker isolate sandbox** for generated code execution
- **Remote RPC-style HTTP tools** called directly by sandboxed generated code

This project is intended to serve multiple purposes at once:

- architecture showcase
- CTO / stakeholder demo
- engineering spike
- starter production foundation

---

## 1. Core idea

Instead of having an agent invoke one MCP tool at a time through a runtime orchestrator, this demo makes the newer **Code Mode** path very clear:

1. The **agent** authenticates to the **MCP Gateway**.
2. The **gateway** returns a **master spec package** plus policy metadata.
3. The **agent** reduces that capability surface and sends the relevant part to **Groq**.
4. **Groq** generates **TypeScript code**.
5. The generated code is executed inside a **Cloudflare Worker isolate sandbox**.
6. That sandboxed code calls the **remote RPC-style HTTP tools directly**.
7. Remote tools validate scoped tokens and request schemas before executing.

This keeps MCP visible as the control plane while moving runtime execution into generated code.

---

## 2. Target stack

- **Monorepo:** pnpm + Turborepo
- **Gateway:** Cloudflare Workers + Hono + TypeScript
- **Remote tools:** Cloudflare Workers + Hono + TypeScript
- **Agent UI:** Next.js + TypeScript
- **LLM provider:** Groq
- **Spec format:** OpenAPI
- **Validation:** Zod
- **JWT / auth:** jose
- **Sandbox model:** Cloudflare Worker isolate using Dynamic Worker Loading target architecture

> Important: Dynamic Worker Loading is the target runtime model. Local development should include a fallback executor path in case hosted beta access is not available yet.

---

## 3. Monorepo layout

```text
mcp-code-mode-demo/
  apps/
    mcp-gateway/
    remote-tools-worker/
    agent-web/
  packages/
    shared-types/
    shared-schemas/
    shared-openapi/
    shared-auth/
    shared-ui/
  turbo.json
  pnpm-workspace.yaml
  package.json
```

### App responsibilities

#### `apps/mcp-gateway`
Control plane for:
- agent authentication
- master spec distribution
- policy metadata distribution
- short-lived tool token minting
- audit logging

#### `apps/remote-tools-worker`
Independent RPC-style HTTP tool surface for:
- `POST /rpc/customer.lookup`
- `POST /rpc/order.getLatestByCustomer`
- `POST /rpc/report.salesSummary`
- other demo procedures

Responsibilities:
- validate gateway-issued JWTs
- enforce scope per procedure
- validate request schema
- return strict typed JSON responses

#### `apps/agent-web`
Demo UI that shows:
- gateway session creation
- master spec retrieval
- client-side visible operation filtering
- Groq prompt package / reduced capability surface
- generated TypeScript code
- sandbox execution trace
- remote tool calls and results
- denial / failure scenarios

---

## 4. Canonical architecture sequence

**Agent authenticates to Gateway -> Gateway returns master spec package and policy context -> Agent sends reduced capability surface to Groq -> Groq generates TypeScript -> Sandbox validates and executes code in isolated Worker -> Sandbox gets short-lived tool token from Gateway -> Sandbox calls remote RPC tools directly -> Remote tools verify token and schema -> Sandbox validates responses -> Agent shows trace and result.**

---

## 5. Five-boundary flow contract

## Boundary 1 — Agent -> MCP Gateway

### Purpose
The agent authenticates and requests the master capability/spec context.

### Request contract
The agent sends:

- `agent_id`
- `agent_type`
- `agent_session_id`
- `requested_capability_set`
- `client_version`
- `trace_id`
- `nonce`
- bearer token or signed session credential

Example:

```json
{
  "agent_id": "agent-sales-assistant",
  "agent_type": "interactive-ui-agent",
  "agent_session_id": "sess_01HXYZ...",
  "requested_capability_set": "default",
  "client_version": "0.1.0",
  "trace_id": "trace_9d3d...",
  "nonce": "n_28ab..."
}
```

### Required security checks
The gateway must verify:

- agent authentication
- token validity
- token audience
- token expiry
- nonce freshness or replay protection
- allowed agent identity
- allowed environment

### Required validation checks
The gateway validates:

- request body schema
- required headers
- trace ID format
- session ID format
- capability-set name format

### Guardrails
The gateway must reject if:

- agent is unknown
- session token is expired
- requested capability set is invalid
- request tries to escalate capability scope

### Output
An authenticated, traceable gateway session for spec retrieval.

---

## Boundary 2 — MCP Gateway -> Agent

### Purpose
The gateway returns the master spec package plus policy metadata the agent can use for client-side filtering and downstream code-mode generation.

### Response contract
The gateway returns:

- `spec_version`
- `spec_hash`
- `issued_at`
- `expires_at`
- `master_openapi_spec`
- `operation_policy_index`
- `agent_policy_context`
- `token_exchange_endpoint`
- `allowed_remote_hosts`
- `execution_constraints`

Example:

```json
{
  "spec_version": "2026-03-10.1",
  "spec_hash": "sha256:2d2f...",
  "issued_at": "2026-03-10T07:15:00Z",
  "expires_at": "2026-03-10T07:30:00Z",
  "master_openapi_spec": { "...": "..." },
  "operation_policy_index": {
    "customer.lookup": {
      "scope": "customer:read",
      "risk_tier": "low",
      "auth_mode": "gateway-minted-jwt"
    },
    "report.salesSummary": {
      "scope": "report:read",
      "risk_tier": "high",
      "auth_mode": "gateway-minted-jwt"
    }
  },
  "agent_policy_context": {
    "agent_id": "agent-sales-assistant",
    "client_visible_scopes": ["customer:read", "order:read"]
  },
  "token_exchange_endpoint": "/tokens/tool-access",
  "allowed_remote_hosts": ["remote-tools.example.workers.dev"],
  "execution_constraints": {
    "max_calls": 5,
    "timeout_ms": 8000
  }
}
```

### Required gateway checks before sending
- authenticated agent
- response bound to authenticated session
- policy metadata aligned to agent role
- versioned and hashable spec package

### Required agent checks on receipt
- OpenAPI document structure
- spec hash presence
- policy metadata completeness
- expiry time
- allowed host list
- execution constraints presence

### Authorization logic
This boundary does **not** authorize direct tool execution yet. It only exposes what exists and what may be attempted.

### Required OpenAPI metadata
Each operation should include:

- `x-tool-name`
- `x-procedure-name`
- `x-scope`
- `x-risk-tier`
- `x-auth-mode`
- `x-idempotency`
- `x-llm-exposure`
- `x-response-schema-id`

---

## Boundary 3 — Agent -> Groq

### Purpose
The agent sends the user task plus a reduced relevant capability surface to Groq so the model can generate TypeScript code.

### Request contract
The agent sends:

- system prompt for code-mode behavior
- user task
- reduced operation list derived from the master spec
- strict code-generation constraints
- runtime execution contract
- token exchange instructions
- JSON schemas or typed summaries of request/response bodies

Example:

```json
{
  "task": "Find customer by email and fetch latest order summary",
  "available_operations": [
    {
      "name": "customer.lookup",
      "method": "POST",
      "url": "https://remote-tools.example.workers.dev/rpc/customer.lookup",
      "scope": "customer:read",
      "request_schema": { "...": "..." },
      "response_schema": { "...": "..." }
    },
    {
      "name": "order.getLatestByCustomer",
      "method": "POST",
      "url": "https://remote-tools.example.workers.dev/rpc/order.getLatestByCustomer",
      "scope": "order:read",
      "request_schema": { "...": "..." },
      "response_schema": { "...": "..." }
    }
  ],
  "constraints": {
    "language": "typescript",
    "no_external_hosts": true,
    "allowed_hosts": ["remote-tools.example.workers.dev", "gateway.example.workers.dev"],
    "must_request_tool_token": true,
    "max_calls": 5,
    "timeout_ms": 8000
  }
}
```

### Security checks before calling Groq
Do not send:

- secret signing keys
- raw gateway credentials
- unrestricted master spec if not needed
- irrelevant operations
- internal-only policy material the model does not need

### Validation checks
- reduced operation list is non-empty
- every operation has request/response schema
- allowed hosts list exists
- token exchange endpoint exists
- constraints are explicit

### Prompt guardrails
The prompt package must require:

- TypeScript only
- no arbitrary networking
- fetch only approved hosts
- obtain short-lived token from gateway before tool call
- return structured output object
- no calls outside provided operations

### Expected output from Groq
Prefer a JSON-wrapped structure:

```json
{
  "language": "typescript",
  "code": "export default async function run(ctx) { ... }",
  "declared_operations": ["customer.lookup", "order.getLatestByCustomer"]
}
```

---

## Boundary 4 — Groq output -> Sandbox Worker

### Purpose
The agent passes generated code into the Worker-isolate executor for validation and execution.

### Execution input contract
The sandbox receives:

- `execution_id`
- `trace_id`
- generated TypeScript code
- execution context object
- approved remote host allowlist
- token exchange URL
- max-call budget
- timeout budget
- operation registry snapshot
- response validators

Example:

```json
{
  "execution_id": "exec_01HXYZ...",
  "trace_id": "trace_9d3d...",
  "code": "export default async function run(ctx) { ... }",
  "context": {
    "gateway_base_url": "https://gateway.example.workers.dev",
    "token_exchange_path": "/tokens/tool-access",
    "allowed_hosts": ["remote-tools.example.workers.dev"],
    "max_calls": 5,
    "timeout_ms": 8000,
    "visible_operations": ["customer.lookup", "order.getLatestByCustomer"]
  }
}
```

### Mandatory pre-execution checks
- code presence check
- code length limit
- AST/static validation
- banned construct scan
- endpoint allowlist enforcement
- allowed-operation verification
- timeout and call-budget injection

### Minimum banned constructs
Reject code attempting:

- dynamic import
- `eval`
- `Function(...)`
- arbitrary URL construction to unapproved hosts
- filesystem access
- environment variable access
- subprocess semantics
- obviously unbounded loops

### Runtime guardrails
The sandbox runtime must enforce:

- hard timeout
- max remote call count
- outbound fetch host allowlist
- body size limits
- response size limits
- deterministic structured logging
- trace propagation

### Token handling rule
Generated code must never receive a long-lived secret. It can only exchange for a short-lived scoped tool token.

### Execution output contract
```json
{
  "execution_id": "exec_01HXYZ...",
  "status": "success",
  "tool_calls": [
    { "operation": "customer.lookup", "status": 200 },
    { "operation": "order.getLatestByCustomer", "status": 200 }
  ],
  "result": {
    "customer_id": "cust_123",
    "latest_order_id": "ord_999",
    "summary": "..."
  },
  "validation_failures": [],
  "policy_failures": []
}
```

---

## Boundary 5 — Sandbox Worker -> Remote Tools

### Purpose
Sandboxed generated code calls remote RPC-style HTTP tool endpoints directly.

### Request contract
Each tool call should include:

- `POST /rpc/<procedure>`
- short-lived bearer token issued by gateway
- `x-trace-id`
- `x-execution-id`
- typed JSON body
- optional idempotency key if needed

Example:

```http
POST /rpc/customer.lookup
Authorization: Bearer <short-lived-scoped-jwt>
Content-Type: application/json
x-trace-id: trace_9d3d...
x-execution-id: exec_01HXYZ...
```

```json
{
  "email": "user@example.com"
}
```

### Required remote-tool security checks
- JWT signature
- token expiry
- token audience
- permitted scope
- execution binding if included
- allowed procedure for token
- trace headers

### Required validation checks
- request body schema
- field formats
- required fields
- request size
- content type

### Response contract
```json
{
  "ok": true,
  "data": {
    "customer_id": "cust_123",
    "email": "user@example.com"
  },
  "meta": {
    "procedure": "customer.lookup",
    "trace_id": "trace_9d3d..."
  }
}
```

### Response validation
The sandbox validates the response against the associated procedure response schema before trusting it.

### Guardrails
Remote tools must reject if:

- token scope does not match procedure
- request body fails schema
- procedure is disabled
- rate limit is exceeded
- caller attempts undeclared side effects

---

## 6. Token model

### Agent session token
Used between agent and gateway.

Claims:
- `sub`: agent ID
- `aud`: gateway
- `agent_type`
- `session_id`
- `env`
- `exp`

### Tool access token
Minted by gateway and used by sandbox-generated code against remote tools.

Claims:
- `sub`: agent ID
- `aud`: remote-tools-worker
- `scope`: allowed scopes / procedures
- `execution_id`
- `trace_id`
- `iat`
- `exp`

Short TTL only.

---

## 7. Canonical policy split

### Gateway owns
- agent auth
- spec distribution
- policy metadata
- short-lived tool token minting
- audit logging

### Agent owns
- client-side filtering for demo display
- prompt assembly for Groq
- code submission to sandbox
- user-visible trace UI

### Sandbox owns
- static code validation
- runtime isolation
- outbound host enforcement
- execution logs
- response validation

### Remote tools own
- token verification
- request schema validation
- business logic
- strict typed response

---

## 8. Canonical failure matrix

### Boundary 1 failures
- invalid agent token
- expired session
- malformed request

### Boundary 2 failures
- invalid spec hash
- missing policy metadata
- expired spec package

### Boundary 3 failures
- no relevant operations
- model returns non-code output
- model references undeclared operation

### Boundary 4 failures
- static validation failed
- banned construct detected
- timeout exceeded
- unapproved host fetch attempted
- resource limit exceeded

### Boundary 5 failures
- invalid JWT
- insufficient scope
- payload schema mismatch
- rate limit exceeded

---

## 9. Demo scenarios

Implement only these three first:

### Scenario 1 — simple single call
Prompt: `Find customer by email`

### Scenario 2 — chained calls
Prompt: `Find the customer, then get the latest order, then summarize it`

### Scenario 3 — guarded failure
Prompt: `Call admin-only sales report and export all raw records`

The third scenario is mandatory. A demo without rejection paths is weak.

---

## 10. Immediate implementation plan

### Step 1
Create the GitHub repo and initialize the monorepo.

### Step 2
Set up workspace tooling:
- pnpm workspace
- turbo
- TypeScript base config
- shared lint / formatting config

### Step 3
Create the three apps:
- `mcp-gateway`
- `remote-tools-worker`
- `agent-web`

### Step 4
Create shared packages:
- `shared-types`
- `shared-schemas`
- `shared-openapi`
- `shared-auth`

### Step 5
Implement the gateway skeleton first.

---

## 11. What this README is for

This README is the architectural source of truth for the first implementation pass. It exists to prevent the project from drifting into vague “tool calling” language.

This demo is about **Code Mode with MCP kept explicit**.

