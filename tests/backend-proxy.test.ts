import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyBackend } from '../lib/backend-proxy';
const request = (
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`https://followup.test/api/${path}`, {
    method,
    headers: { Origin: 'https://followup.test', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
void test('gateway rejects cross-origin writes and unknown paths without upstream requests', async () => {
  const never = (async () => {
    throw new Error('must not fetch');
  }) as typeof fetch;
  assert.equal(
    (
      await proxyBackend(
        request('project', 'POST', {}, { Origin: 'https://attacker.test' }),
        ['project'],
        undefined,
        never,
      )
    ).status,
    403,
  );
  assert.equal(
    (await proxyBackend(request('users'), ['users'], undefined, never)).status,
    404,
  );
  assert.equal(
    (await proxyBackend(request('projects'), ['projects'], undefined, never))
      .status,
    401,
  );
});
void test('login keeps token in an HttpOnly cookie and hides it from response JSON', async () => {
  const upstream = (async () =>
    Response.json({
      accessToken: 'test-secret',
      tokenType: 'Bearer',
      expiresIn: 3600,
    })) as typeof fetch;
  const response = await proxyBackend(
    request('auth/login', 'POST', {
      email: 'test@example.invalid',
      password: 'test',
    }),
    ['auth', 'login'],
    undefined,
    upstream,
  );
  assert.deepEqual(await response.json(), { authenticated: true });
  assert.match(
    response.headers.get('set-cookie') || '',
    /HttpOnly; SameSite=Lax; Secure/,
  );
});
void test('gateway forwards only fixed API paths and bearer credentials, preserves 204', async () => {
  const upstream = (async (url: URL, options: RequestInit) => {
    assert.equal(
      url.toString(),
      'http://13.124.207.246:8080/api/action-item/5',
    );
    assert.equal(
      new Headers(options.headers).get('authorization'),
      'Bearer token',
    );
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const response = await proxyBackend(
    request('action-item/5', 'DELETE', undefined, {
      Cookie: 'followup_access=token',
    }),
    ['action-item', '5'],
    undefined,
    upstream,
  );
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
});
void test('expired upstream session clears cookie; upstream redirects are rejected', async () => {
  const expired = (async () =>
    new Response(null, { status: 401 })) as typeof fetch;
  const response = await proxyBackend(
    request('auth/session', 'GET', undefined, {
      Cookie: 'followup_access=expired',
    }),
    ['auth', 'session'],
    undefined,
    expired,
  );
  assert.deepEqual(await response.json(), { authenticated: false });
  assert.match(response.headers.get('set-cookie') || '', /Max-Age=0/);
  const redirect = (async () =>
    new Response(null, {
      status: 302,
      headers: { Location: 'https://other.test' },
    })) as typeof fetch;
  assert.equal(
    (await proxyBackend(request('health'), ['health'], undefined, redirect))
      .status,
    502,
  );
});
