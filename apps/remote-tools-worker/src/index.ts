import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CustomerLookupRequestSchema,
  ErrorResponseSchema,
  OrderGetLatestByCustomerRequestSchema,
  ReportSalesSummaryRequestSchema,
} from '@repo/shared-schemas';
import { verifyToolAccessToken } from '@repo/shared-auth';

type ToolContext = {
  agentId: string;
  scope: string[];
  traceId?: string;
  executionId?: string;
};

const app = new Hono<{ Variables: { toolAuth: ToolContext } }>();

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

async function toolAuthMiddleware(c: any, next: any) {
  const authHeader = c.req.header('authorization');
  const traceId = c.req.header('x-trace-id');

  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('UNAUTHORIZED', 'Missing bearer token', traceId, 401);
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const verified = await verifyToolAccessToken(token);
    const payload = verified.payload;

    c.set('toolAuth', {
      agentId: String(payload.sub),
      scope: Array.isArray(payload.scope) ? payload.scope.map(String) : [],
      traceId: typeof payload.trace_id === 'string' ? payload.trace_id : traceId,
      executionId: typeof payload.execution_id === 'string' ? payload.execution_id : undefined,
    });

    await next();
  } catch {
    return jsonError('UNAUTHORIZED', 'Invalid or expired tool access token', traceId, 401);
  }
}

function requireScope(requiredScope: string) {
  return async (c: any, next: any) => {
    const auth = c.get('toolAuth') as ToolContext;

    if (!auth.scope.includes(requiredScope)) {
      return jsonError('FORBIDDEN', `Missing required scope: ${requiredScope}`, auth.traceId, 403);
    }

    await next();
  };
}

app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'remote-tools-worker',
  });
});

app.post(
  '/rpc/customer.lookup',
  toolAuthMiddleware,
  requireScope('customer:read'),
  zValidator('json', CustomerLookupRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const auth = c.get('toolAuth') as ToolContext;

    return c.json({
      ok: true,
      data: {
        customer_id: 'cust_demo_001',
        email: body.email,
        name: 'Demo Customer',
      },
      meta: {
        procedure: 'customer.lookup',
        trace_id: auth.traceId,
      },
    });
  },
);

app.post(
  '/rpc/order.getLatestByCustomer',
  toolAuthMiddleware,
  requireScope('order:read'),
  zValidator('json', OrderGetLatestByCustomerRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const auth = c.get('toolAuth') as ToolContext;

    return c.json({
      ok: true,
      data: {
        order_id: 'ord_demo_001',
        customer_id: body.customer_id,
        total: 149.99,
        currency: 'USD',
        status: 'paid',
      },
      meta: {
        procedure: 'order.getLatestByCustomer',
        trace_id: auth.traceId,
      },
    });
  },
);

app.post(
  '/rpc/report.salesSummary',
  toolAuthMiddleware,
  requireScope('report:read'),
  zValidator('json', ReportSalesSummaryRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const auth = c.get('toolAuth') as ToolContext;

    return c.json({
      ok: true,
      data: {
        range: body.range,
        gross_sales: 12500,
        orders_count: 84,
        currency: 'USD',
      },
      meta: {
        procedure: 'report.salesSummary',
        trace_id: auth.traceId,
      },
    });
  },
);

app.get('/', (c) => {
  return c.text('remote-tools-worker is running');
});

export default app;
