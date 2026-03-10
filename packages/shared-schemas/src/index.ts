import { z } from 'zod';

/**
 * Generic
 */
export const TraceIdSchema = z.string().min(8).max(128);
export const AgentIdSchema = z.string().min(3).max(100);
export const SessionIdSchema = z.string().min(8).max(128);
export const NonceSchema = z.string().min(6).max(128);

/**
 * Health
 */
export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Agent login
 */
export const AgentLoginRequestSchema = z.object({
  agent_id: AgentIdSchema,
  agent_type: z.string().min(3).max(100),
  agent_session_id: SessionIdSchema,
  requested_capability_set: z.string().min(1).max(100),
  client_version: z.string().min(1).max(50),
  trace_id: TraceIdSchema,
  nonce: NonceSchema,
});

export const AgentLoginResponseSchema = z.object({
  ok: z.literal(true),
  agent_session_token: z.string().min(10),
  expires_in_seconds: z.number().int().positive(),
  issued_at: z.string(),
  trace_id: TraceIdSchema,
});

export type AgentLoginRequest = z.infer<typeof AgentLoginRequestSchema>;
export type AgentLoginResponse = z.infer<typeof AgentLoginResponseSchema>;

/**
 * Specs master response
 */
export const OperationPolicySchema = z.object({
  scope: z.string(),
  risk_tier: z.enum(['low', 'medium', 'high']),
  auth_mode: z.string(),
});

export const SpecsMasterResponseSchema = z.object({
  ok: z.literal(true),
  spec_version: z.string(),
  spec_hash: z.string(),
  issued_at: z.string(),
  expires_at: z.string(),
  master_openapi_spec: z.record(z.any()),
  operation_policy_index: z.record(OperationPolicySchema),
  agent_policy_context: z.object({
    agent_id: AgentIdSchema,
    client_visible_scopes: z.array(z.string()),
  }),
  token_exchange_endpoint: z.string(),
  allowed_remote_hosts: z.array(z.string()),
  execution_constraints: z.object({
    max_calls: z.number().int().positive(),
    timeout_ms: z.number().int().positive(),
  }),
  trace_id: TraceIdSchema,
});

export type SpecsMasterResponse = z.infer<typeof SpecsMasterResponseSchema>;

/**
 * Tool access token exchange
 */
export const ToolAccessTokenRequestSchema = z.object({
  agent_id: AgentIdSchema,
  trace_id: TraceIdSchema,
  execution_id: z.string().min(8).max(128),
  requested_operations: z.array(z.string().min(1)).min(1).max(10),
});

export const ToolAccessTokenResponseSchema = z.object({
  ok: z.literal(true),
  tool_access_token: z.string().min(10),
  expires_in_seconds: z.number().int().positive(),
  scope: z.array(z.string()),
  audience: z.string(),
  trace_id: TraceIdSchema,
});

export type ToolAccessTokenRequest = z.infer<typeof ToolAccessTokenRequestSchema>;
export type ToolAccessTokenResponse = z.infer<typeof ToolAccessTokenResponseSchema>;

/**
 * Error response
 */
export const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
  trace_id: TraceIdSchema.optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Remote tool request / response schemas
 */

export const CustomerLookupRequestSchema = z.object({
  email: z.string().email(),
});

export const CustomerLookupResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    customer_id: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
  meta: z.object({
    procedure: z.literal('customer.lookup'),
    trace_id: TraceIdSchema.optional(),
  }),
});

export type CustomerLookupRequest = z.infer<typeof CustomerLookupRequestSchema>;
export type CustomerLookupResponse = z.infer<typeof CustomerLookupResponseSchema>;

export const OrderGetLatestByCustomerRequestSchema = z.object({
  customer_id: z.string().min(1),
});

export const OrderGetLatestByCustomerResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    order_id: z.string(),
    customer_id: z.string(),
    total: z.number(),
    currency: z.string(),
    status: z.string(),
  }),
  meta: z.object({
    procedure: z.literal('order.getLatestByCustomer'),
    trace_id: TraceIdSchema.optional(),
  }),
});

export type OrderGetLatestByCustomerRequest = z.infer<
  typeof OrderGetLatestByCustomerRequestSchema
>;
export type OrderGetLatestByCustomerResponse = z.infer<
  typeof OrderGetLatestByCustomerResponseSchema
>;

export const ReportSalesSummaryRequestSchema = z.object({
  range: z.string().min(1),
});

export const ReportSalesSummaryResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    range: z.string(),
    gross_sales: z.number(),
    orders_count: z.number(),
    currency: z.string(),
  }),
  meta: z.object({
    procedure: z.literal('report.salesSummary'),
    trace_id: TraceIdSchema.optional(),
  }),
});

export type ReportSalesSummaryRequest = z.infer<typeof ReportSalesSummaryRequestSchema>;
export type ReportSalesSummaryResponse = z.infer<typeof ReportSalesSummaryResponseSchema>;
