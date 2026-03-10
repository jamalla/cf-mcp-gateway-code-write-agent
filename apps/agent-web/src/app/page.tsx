import type { CSSProperties } from 'react';
import Link from 'next/link';
import { extractVisibleOperations } from '@/lib/spec-filter';
import { fetchMasterSpec, loginAgent } from '@/lib/gateway-client';

export default async function Home() {
  const session = await loginAgent();
  const specResponse = await fetchMasterSpec(
    session.agentSessionToken,
    session.traceId,
  );

  const visibleScopes =
    specResponse?.agent_policy_context?.client_visible_scopes ?? [];

  const visibleOperations = extractVisibleOperations(
    specResponse?.master_openapi_spec ?? {},
    visibleScopes,
  );

  const prompt1 = encodeURIComponent('Find customer demo@example.com');
  const prompt2 = encodeURIComponent(
    'Find customer demo@example.com and get latest order',
  );
  const prompt3 = encodeURIComponent('Get sales summary report');

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>MCP Gateway Code Mode Agent</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Bridge Execution</h2>
        <p>This is the controlled bridge before true Code Mode generation.</p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          <Link href={`/run?prompt=${prompt1}`} style={linkStyle}>
            Run: customer lookup
          </Link>
          <Link href={`/run?prompt=${prompt2}`} style={linkStyle}>
            Run: customer + latest order
          </Link>
          <Link href={`/run?prompt=${prompt3}`} style={linkStyle}>
            Run: restricted report
          </Link>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Gateway Spec Package</h2>
        <p>
          <strong>Spec Version:</strong> {specResponse.spec_version}
        </p>
        <p>
          <strong>Spec Hash:</strong> {specResponse.spec_hash}
        </p>
        <p>
          <strong>Allowed Remote Hosts:</strong>{' '}
          {specResponse.allowed_remote_hosts.join(', ')}
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Client-Visible Scopes</h2>
        <ul>
          {visibleScopes.map((scope: string) => (
            <li key={scope}>{scope}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Visible Operations</h2>
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            marginTop: 12,
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Operation</th>
              <th style={thStyle}>Method</th>
              <th style={thStyle}>Path</th>
              <th style={thStyle}>Scope</th>
              <th style={thStyle}>Risk</th>
              <th style={thStyle}>Exposure</th>
            </tr>
          </thead>
          <tbody>
            {visibleOperations.map((op) => (
              <tr key={op.operationId}>
                <td style={tdStyle}>{op.operationId}</td>
                <td style={tdStyle}>{op.method}</td>
                <td style={tdStyle}>{op.path}</td>
                <td style={tdStyle}>{op.scope}</td>
                <td style={tdStyle}>{op.riskTier}</td>
                <td style={tdStyle}>{op.llmExposure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const linkStyle: CSSProperties = {
  display: 'inline-block',
  padding: '10px 14px',
  border: '1px solid #ccc',
  borderRadius: 8,
  textDecoration: 'none',
  color: '#111',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #ccc',
  padding: '8px',
};

const tdStyle: CSSProperties = {
  borderBottom: '1px solid #eee',
  padding: '8px',
};
