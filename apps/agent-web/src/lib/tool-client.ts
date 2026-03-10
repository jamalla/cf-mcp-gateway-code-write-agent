type OpenApiSpec = {
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, any>>;
};

function getBaseUrlFromSpec(spec: OpenApiSpec): string {
  const url = spec?.servers?.[0]?.url;

  if (!url) {
    throw new Error('No server URL found in spec');
  }

  return url;
}

function getOperationPath(spec: OpenApiSpec, operationId: string): string {
  const paths = spec.paths ?? {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const operation of Object.values(methods)) {
      if (operation?.operationId === operationId) {
        return path;
      }
    }
  }

  throw new Error(`Operation path not found for ${operationId}`);
}

export async function callRemoteTool(params: {
  spec: OpenApiSpec;
  operationId: string;
  toolAccessToken: string;
  traceId: string;
  executionId: string;
  body: Record<string, unknown>;
}) {
  const baseUrl = getBaseUrlFromSpec(params.spec);
  const path = getOperationPath(params.spec, params.operationId);

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.toolAccessToken}`,
      'content-type': 'application/json',
      'x-trace-id': params.traceId,
      'x-execution-id': params.executionId,
    },
    body: JSON.stringify(params.body),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);

  return {
    status: response.status,
    ok: response.ok,
    operationId: params.operationId,
    path,
    requestBody: params.body,
    responseBody: data,
  };
}
