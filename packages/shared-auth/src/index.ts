import { SignJWT, jwtVerify } from 'jose';

const DEFAULT_SECRET = 'dev-only-secret-change-me';

function getSecret(): Uint8Array {
	return new TextEncoder().encode(DEFAULT_SECRET);
}

export type AgentSessionClaims = {
	sub: string;
	aud: 'mcp-gateway';
	agent_type: string;
	session_id: string;
	env: 'dev';
	trace_id: string;
};

export type ToolAccessClaims = {
	sub: string;
	aud: 'remote-tools-worker';
	scope: string[];
	execution_id: string;
	trace_id: string;
};

export async function signAgentSessionToken(
	claims: AgentSessionClaims,
	expiresIn: string = '15m',
): Promise<string> {
	return await new SignJWT(claims)
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(claims.sub)
		.setAudience(claims.aud)
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(getSecret());
}

export async function verifyAgentSessionToken(token: string) {
	return await jwtVerify(token, getSecret(), {
		audience: 'mcp-gateway',
	});
}

export async function signToolAccessToken(
	claims: ToolAccessClaims,
	expiresIn: string = '5m',
): Promise<string> {
	return await new SignJWT(claims)
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(claims.sub)
		.setAudience(claims.aud)
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(getSecret());
}

export async function verifyToolAccessToken(token: string) {
	return await jwtVerify(token, getSecret(), {
		audience: 'remote-tools-worker',
	});
}
