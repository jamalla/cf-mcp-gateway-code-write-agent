const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_BASE_URL || 'http://127.0.0.1:8787';

export async function loginAgent() {
  const traceId = `trace_${crypto.randomUUID()}`;

  const response = await fetch(`${GATEWAY_BASE_URL}/auth/agent/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: 'agent-sales-assistant',
      agent_type: 'interactive-ui-agent',
      agent_session_id: `sess_${crypto.randomUUID()}`,
      requested_capability_set: 'default',
      client_version: '0.1.0',
      trace_id: traceId,
      nonce: `nonce_${crypto.randomUUID()}`,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Agent login failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    agentId: 'agent-sales-assistant',
    agentSessionToken: data.agent_session_token as string,
    traceId: data.trace_id as string,
  };
}

export async function fetchMasterSpec(agentSessionToken: string, traceId: string) {
  const response = await fetch(`${GATEWAY_BASE_URL}/specs/master`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${agentSessionToken}`,
      'x-trace-id': traceId,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Fetch master spec failed: ${response.status}`);
  }

  return await response.json();
}

export async function exchangeToolAccessToken(params: {
  agentId: string;
  agentSessionToken: string;
  traceId: string;
  executionId: string;
  requestedOperations: string[];
}) {
  const response = await fetch(`${GATEWAY_BASE_URL}/tokens/tool-access`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.agentSessionToken}`,
      'content-type': 'application/json',
      'x-trace-id': params.traceId,
    },
    body: JSON.stringify({
      agent_id: params.agentId,
      trace_id: params.traceId,
      execution_id: params.executionId,
      requested_operations: params.requestedOperations,
    }),
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Tool token exchange failed: ${response.status}`);
  }

  return data as {
    ok: true;
    tool_access_token: string;
    expires_in_seconds: number;
    scope: string[];
    audience: string;
    trace_id: string;
  };
}
