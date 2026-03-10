export const OPENAPI_VERSION = '3.1.0';

export function buildMasterOpenApiSpec() {
	return {
		openapi: OPENAPI_VERSION,
		info: {
			title: 'MCP Code Mode Demo Master Spec',
			version: '2026-03-10.1',
			description:
				'Shared master spec for demo purposes. Client-side filtering is for visibility only, not security.',
		},
		servers: [
			{
				url: 'https://remote-tools.example.workers.dev',
			},
		],
		paths: {
			'/rpc/customer.lookup': {
				post: {
					operationId: 'customer.lookup',
					summary: 'Find customer by email',
					'x-tool-name': 'customer.lookup',
					'x-procedure-name': 'customer.lookup',
					'x-scope': 'customer:read',
					'x-risk-tier': 'low',
					'x-auth-mode': 'gateway-minted-jwt',
					'x-idempotency': true,
					'x-llm-exposure': 'visible',
					'x-response-schema-id': 'CustomerLookupResponse',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										email: { type: 'string', format: 'email' },
									},
									required: ['email'],
								},
							},
						},
					},
					responses: {
						'200': {
							description: 'Successful response',
						},
					},
				},
			},
			'/rpc/order.getLatestByCustomer': {
				post: {
					operationId: 'order.getLatestByCustomer',
					summary: 'Get latest order by customer id',
					'x-tool-name': 'order.getLatestByCustomer',
					'x-procedure-name': 'order.getLatestByCustomer',
					'x-scope': 'order:read',
					'x-risk-tier': 'low',
					'x-auth-mode': 'gateway-minted-jwt',
					'x-idempotency': true,
					'x-llm-exposure': 'visible',
					'x-response-schema-id': 'OrderLatestResponse',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										customer_id: { type: 'string' },
									},
									required: ['customer_id'],
								},
							},
						},
					},
					responses: {
						'200': {
							description: 'Successful response',
						},
					},
				},
			},
			'/rpc/report.salesSummary': {
				post: {
					operationId: 'report.salesSummary',
					summary: 'Get sales summary report',
					'x-tool-name': 'report.salesSummary',
					'x-procedure-name': 'report.salesSummary',
					'x-scope': 'report:read',
					'x-risk-tier': 'high',
					'x-auth-mode': 'gateway-minted-jwt',
					'x-idempotency': true,
					'x-llm-exposure': 'restricted',
					'x-response-schema-id': 'SalesSummaryResponse',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										range: { type: 'string' },
									},
									required: ['range'],
								},
							},
						},
					},
					responses: {
						'200': {
							description: 'Successful response',
						},
					},
				},
			},
		},
	};
}
