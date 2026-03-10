import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'remote-tools-worker',
  });
});

app.post('/rpc/customer.lookup', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    ok: true,
    data: {
      customer_id: 'cust_demo_001',
      email: body?.email ?? null,
    },
    meta: {
      procedure: 'customer.lookup',
    },
  });
});

export default app;
