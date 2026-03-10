import { exchangeToolAccessToken, fetchMasterSpec, loginAgent } from '@/lib/gateway-client';
import { planActionsFromPrompt } from '@/lib/operation-planner';
import { callRemoteTool } from '@/lib/tool-client';

export type ExecutionTraceItem = {
  step: string;
  status: 'success' | 'error';
  detail: string;
  payload?: unknown;
};

export type AgentRunResult = {
  ok: boolean;
  traceId: string;
  executionId: string;
  traces: ExecutionTraceItem[];
  finalResult?: unknown;
  error?: string;
};

export async function runAgentPrompt(prompt: string): Promise<AgentRunResult> {
  const executionId = `exec_${crypto.randomUUID()}`;
  const traces: ExecutionTraceItem[] = [];

  try {
    if (!prompt.trim()) {
      return {
        ok: false,
        traceId: 'trace_missing_prompt',
        executionId,
        traces: [],
        error: 'Prompt is required',
      };
    }

    const session = await loginAgent();
    traces.push({
      step: 'agent.login',
      status: 'success',
      detail: 'Agent authenticated with gateway',
      payload: { traceId: session.traceId },
    });

    const specResponse = await fetchMasterSpec(
      session.agentSessionToken,
      session.traceId,
    );

    traces.push({
      step: 'gateway.fetchMasterSpec',
      status: 'success',
      detail: 'Fetched master spec package from gateway',
      payload: {
        specVersion: specResponse.spec_version,
        allowedRemoteHosts: specResponse.allowed_remote_hosts,
      },
    });

    const plannedActions = planActionsFromPrompt(prompt);

    if (plannedActions.length === 0) {
      return {
        ok: false,
        traceId: session.traceId,
        executionId,
        traces: [
          ...traces,
          {
            step: 'agent.planActions',
            status: 'error',
            detail: 'No actions could be planned from prompt',
            payload: { prompt },
          },
        ],
        error: 'No actions could be planned from prompt',
      };
    }

    traces.push({
      step: 'agent.planActions',
      status: 'success',
      detail: 'Planned actions from prompt',
      payload: plannedActions,
    });

    const requestedOperations = Array.from(
      new Set(
        plannedActions.map((action) =>
          action.type === 'customer.lookup' &&
          prompt.toLowerCase().includes('latest order')
            ? ['customer.lookup', 'order.getLatestByCustomer']
            : [action.type],
        ).flat(),
      ),
    );

    const tokenExchange = await exchangeToolAccessToken({
      agentId: session.agentId,
      agentSessionToken: session.agentSessionToken,
      traceId: session.traceId,
      executionId,
      requestedOperations,
    });

    traces.push({
      step: 'gateway.exchangeToolAccessToken',
      status: 'success',
      detail: 'Received scoped tool access token',
      payload: {
        scope: tokenExchange.scope,
        audience: tokenExchange.audience,
      },
    });

    const firstAction = plannedActions[0];

    const firstCall = await callRemoteTool({
      spec: specResponse.master_openapi_spec,
      operationId: firstAction.type,
      toolAccessToken: tokenExchange.tool_access_token,
      traceId: session.traceId,
      executionId,
      body: firstAction.input,
    });

    traces.push({
      step: `tool.${firstAction.type}`,
      status: firstCall.ok ? 'success' : 'error',
      detail: `Called remote tool: ${firstAction.type}`,
      payload: firstCall,
    });

    if (!firstCall.ok) {
      return {
        ok: false,
        traceId: session.traceId,
        executionId,
        traces,
        error: `Tool call failed for ${firstAction.type}`,
      };
    }

    if (
      firstAction.type === 'customer.lookup' &&
      prompt.toLowerCase().includes('latest order')
    ) {
      const customerId = firstCall.responseBody?.data?.customer_id;

      if (!customerId) {
        return {
          ok: false,
          traceId: session.traceId,
          executionId,
          traces,
          error: 'Customer ID missing from customer.lookup response',
        };
      }

      const secondCall = await callRemoteTool({
        spec: specResponse.master_openapi_spec,
        operationId: 'order.getLatestByCustomer',
        toolAccessToken: tokenExchange.tool_access_token,
        traceId: session.traceId,
        executionId,
        body: { customer_id: customerId },
      });

      traces.push({
        step: 'tool.order.getLatestByCustomer',
        status: secondCall.ok ? 'success' : 'error',
        detail: 'Called remote tool: order.getLatestByCustomer',
        payload: secondCall,
      });

      if (!secondCall.ok) {
        return {
          ok: false,
          traceId: session.traceId,
          executionId,
          traces,
          error: 'Tool call failed for order.getLatestByCustomer',
        };
      }

      return {
        ok: true,
        traceId: session.traceId,
        executionId,
        traces,
        finalResult: {
          customer: firstCall.responseBody?.data,
          latestOrder: secondCall.responseBody?.data,
        },
      };
    }

    return {
      ok: true,
      traceId: session.traceId,
      executionId,
      traces,
      finalResult: firstCall.responseBody?.data ?? firstCall.responseBody,
    };
  } catch (error) {
    return {
      ok: false,
      traceId: 'trace_runtime_error',
      executionId,
      traces,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
