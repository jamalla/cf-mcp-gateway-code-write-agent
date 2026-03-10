export type AgentSession = {
  agentSessionToken: string;
  traceId: string;
};

export type VisibleOperation = {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  scope?: string;
  riskTier?: string;
  llmExposure?: string;
};
