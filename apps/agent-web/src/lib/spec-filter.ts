import type { VisibleOperation } from './types';

type OpenApiSpec = {
  paths?: Record<string, Record<string, any>>;
};

export function extractVisibleOperations(
  spec: OpenApiSpec,
  visibleScopes: string[],
): VisibleOperation[] {
  const results: VisibleOperation[] = [];

  const paths = spec.paths ?? {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const scope = operation?.['x-scope'];

      if (!scope || !visibleScopes.includes(scope)) {
        continue;
      }

      results.push({
        operationId: operation?.operationId ?? `${method}:${path}`,
        method: method.toUpperCase(),
        path,
        summary: operation?.summary,
        scope,
        riskTier: operation?.['x-risk-tier'],
        llmExposure: operation?.['x-llm-exposure'],
      });
    }
  }

  return results;
}
