import type { CSSProperties } from 'react';
import { runAgentPrompt } from '@/lib/run-agent';

export default async function RunPage(props: {
  searchParams?: Promise<{ prompt?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const prompt = searchParams.prompt || 'Find customer demo@example.com and get latest order';

  const result = await runAgentPrompt(prompt);

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>Agent Run Trace</h1>

      <section style={{ marginTop: 24 }}>
        <p>
          <strong>Prompt:</strong> {prompt}
        </p>
        <p>
          <strong>Status:</strong> {result.ok ? 'success' : 'error'}
        </p>
        <p>
          <strong>Trace ID:</strong> {result.traceId}
        </p>
        <p>
          <strong>Execution ID:</strong> {result.executionId}
        </p>
        {result.error ? (
          <p>
            <strong>Error:</strong> {result.error}
          </p>
        ) : null}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Execution Trace</h2>
        {result.traces.map((trace, index) => (
          <div
            key={`${trace.step}-${index}`}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
              background: trace.status === 'success' ? '#f8fff8' : '#fff8f8',
            }}
          >
            <p>
              <strong>Step:</strong> {trace.step}
            </p>
            <p>
              <strong>Status:</strong> {trace.status}
            </p>
            <p>
              <strong>Detail:</strong> {trace.detail}
            </p>
            {trace.payload ? (
              <pre style={preStyle}>
                {JSON.stringify(trace.payload, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Final Result</h2>
        <pre style={preStyle}>
          {JSON.stringify(result.finalResult ?? null, null, 2)}
        </pre>
      </section>
    </main>
  );
}

const preStyle: CSSProperties = {
  background: '#f5f5f5',
  padding: 16,
  overflowX: 'auto',
  borderRadius: 8,
};
