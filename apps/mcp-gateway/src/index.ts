import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  AgentLoginRequestSchema,
  ErrorResponseSchema,
  ToolAccessTokenRequestSchema,
} from '@repo/shared-schemas';
import {
  signAgentSessionToken,
  signToolAccessToken,
  verifyAgentSessionToken,
} from '@repo/shared-auth';
import { buildMasterOpenApiSpec } from '@repo/shared-openapi';

type Bindings = {
  REMOTE_TOOLS_BASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

function buildTraceId(): string {
  return `trace_${crypto.randomUUID()}`;
}

function jsonError(code: string, message: string, trace_id?: string, status: number = 400) {
  return new Response(
    JSON.stringify(
      ErrorResponseSchema.parse({
        ok: false,
        error: { code, message },
        trace_id,
      }),
    ),
    {
      status,
      headers: {
        'content-type': 'application/json',
      },
    },
  );
}

app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'mcp-gateway',
  });
});

app.post('/auth/agent/login', zValidator('json', AgentLoginRequestSchema), async (c) => {
  const body = c.req.valid('json');

  const token = await signAgentSessionToken({
    sub: body.agent_id,
    aud: 'mcp-gateway',
    agent_type: body.agent_type,
    session_id: body.agent_session_id,
    env: 'dev',
    trace_id: body.trace_id,
  });

  return c.json({
    ok: true,
    agent_session_token: token,
    expires_in_seconds: 900,
    issued_at: new Date().toISOString(),
    trace_id: body.trace_id,
  });
});

app.get('/specs/master', async (c) => {
  const traceId = c.req.header('x-trace-id') ?? buildTraceId();
  const authHeader = c.req.header('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('UNAUTHORIZED', 'Missing bearer token', traceId, 401);
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const verified = await verifyAgentSessionToken(token);
    const agentId = String(verified.payload.sub);

    const remoteToolsBaseUrl = c.env.REMOTE_TOOLS_BASE_URL || 'http://127.0.0.1:8788';
    const masterSpec = buildMasterOpenApiSpec({
      remoteToolsBaseUrl,
    });
    const specText = JSON.stringify(masterSpec);
    const specHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(specText));
    const specHashArray = Array.from(new Uint8Array(specHashBuffer));
    const specHash = `sha256:${specHashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;

    return c.json({
      ok: true,
      spec_version: '2026-03-10.1',
      spec_hash: specHash,
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      master_openapi_spec: masterSpec,
      operation_policy_index: {
        'customer.lookup': {
          scope: 'customer:read',
          risk_tier: 'low',
          auth_mode: 'gateway-minted-jwt',
        },
        'order.getLatestByCustomer': {
          scope: 'order:read',
          risk_tier: 'low',
          auth_mode: 'gateway-minted-jwt',
        },
        'report.salesSummary': {
          scope: 'report:read',
          risk_tier: 'high',
          auth_mode: 'gateway-minted-jwt',
        },
      },
      agent_policy_context: {
        agent_id: agentId,
        client_visible_scopes: ['customer:read', 'order:read'],
      },
      token_exchange_endpoint: '/tokens/tool-access',
      allowed_remote_hosts: [new URL(remoteToolsBaseUrl).host],
      execution_constraints: {
        max_calls: 5,
        timeout_ms: 8000,
      },
      trace_id: traceId,
    });
  } catch {
    return jsonError('UNAUTHORIZED', 'Invalid or expired agent session token', traceId, 401);
  }
});

app.post('/tokens/tool-access', zValidator('json', ToolAccessTokenRequestSchema), async (c) => {
  const traceId = c.req.header('x-trace-id') ?? buildTraceId();
  const authHeader = c.req.header('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('UNAUTHORIZED', 'Missing bearer token', traceId, 401);
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    await verifyAgentSessionToken(token);
  } catch {
    return jsonError('UNAUTHORIZED', 'Invalid or expired agent session token', traceId, 401);
  }

  const body = c.req.valid('json');

  const allowedOperationToScope: Record<string, string> = {
    'customer.lookup': 'customer:read',
    'order.getLatestByCustomer': 'order:read',
    'report.salesSummary': 'report:read',
  };

  const requestedScopes = body.requested_operations
    .map((operation) => allowedOperationToScope[operation])
    .filter(Boolean);

  const visibleScopes = new Set(['customer:read', 'order:read']);

  const approvedScopes = requestedScopes.filter((scope) => visibleScopes.has(scope));

  if (approvedScopes.length === 0) {
    return jsonError(
      'FORBIDDEN',
      'No approved scopes for requested operations',
      body.trace_id,
      403,
    );
  }

  const toolToken = await signToolAccessToken({
    sub: body.agent_id,
    aud: 'remote-tools-worker',
    scope: approvedScopes,
    execution_id: body.execution_id,
    trace_id: body.trace_id,
  });

  return c.json({
    ok: true,
    tool_access_token: toolToken,
    expires_in_seconds: 300,
    scope: approvedScopes,
    audience: 'remote-tools-worker',
    trace_id: body.trace_id,
  });
});

app.get('/', (c) => {
  return c.text('mcp-gateway is running');
});

export default app;
