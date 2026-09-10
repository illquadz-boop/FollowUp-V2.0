// Same-origin gateway: the browser never receives the upstream bearer token.
const COOKIE = 'followup_access';
const routes: [RegExp, string[]][] = [
  [/^health$/, ['GET']],
  [/^auth\/(login|signup)$/, ['POST']],
  [/^projects$/, ['GET']],
  [/^project$/, ['POST']],
  [/^project\/\d+$/, ['GET', 'PATCH', 'DELETE']],
  [/^project\/\d+\/(members|meetings|action-items|dashboard)$/, ['GET']],
  [/^project\/\d+\/(member|meeting|action-item)$/, ['POST']],
  [/^project\/\d+\/member\/\d+$/, ['DELETE']],
  [/^meeting\/\d+$/, ['GET', 'PATCH', 'DELETE']],
  [/^meeting\/\d+\/analysis$/, ['POST']],
  [/^analysis\/\d+$/, ['GET']],
  [/^analysis\/\d+\/confirm$/, ['POST']],
  [/^action-item\/\d+$/, ['GET', 'PATCH', 'DELETE']],
];
const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
function cookie(value: string, secure: boolean, maxAge?: number) {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}${maxAge === undefined ? '' : `; Max-Age=${maxAge}`}`;
}
export async function proxyBackend(
  request: Request,
  segments: string[],
  upstream = process.env.FOLLOWUP_BACKEND_URL || 'http://13.124.207.246:8080',
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(request.url);
  const path = segments.join('/');
  const secure = url.protocol === 'https:';
  const clear = { 'Set-Cookie': cookie('', secure, 0) };
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== url.origin)
      return json({ message: '요청 출처를 확인할 수 없어요.' }, 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site')
      return json({ message: '허용되지 않은 요청입니다.' }, 403);
  }
  let token = '';
  try {
    token = decodeURIComponent(
      request.headers
        .get('cookie')
        ?.split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${COOKIE}=`))
        ?.slice(COOKIE.length + 1) || '',
    );
  } catch (error) {
    console.error(
      'FollowUp upstream request failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return json({ message: '다시 로그인해주세요.' }, 401, clear);
  }
  if (path === 'auth/logout' && request.method === 'POST')
    return json({ ok: true }, 200, clear);
  const session = path === 'auth/session' && request.method === 'GET';
  if (
    !session &&
    !routes.some(
      ([pattern, methods]) =>
        pattern.test(path) && methods.includes(request.method),
    )
  )
    return json({ message: '지원하지 않는 API 요청입니다.' }, 404);
  const publicRoute =
    path === 'health' || path === 'auth/login' || path === 'auth/signup';
  if (!publicRoute && !token)
    return session
      ? json({ authenticated: false })
      : json({ message: '로그인이 필요해요.' }, 401);
  try {
    let body: string | undefined;
    if (!['GET', 'HEAD', 'DELETE'].includes(request.method)) {
      body = await request.text();
      if (body.length > 250000)
        return json({ message: '입력 내용이 너무 커요.' }, 413);
      if (body) {
        try {
          JSON.parse(body);
        } catch {
          return json({ message: '올바른 JSON이 아닙니다.' }, 400);
        }
      }
    }
    const target = new URL(`/api/${session ? 'projects' : path}`, upstream);
    if (!session) target.search = url.search;
    const response = await fetcher(target, {
      method: session ? 'GET' : request.method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(!publicRoute && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(path.endsWith('/analysis') ? 120000 : 45000),
    });
    if (response.status >= 300 && response.status < 400)
      return json(
        { message: '백엔드 주소가 변경되었어요. 관리자에게 알려주세요.' },
        502,
      );
    if (session) {
      if (response.status === 401)
        return json({ authenticated: false }, 200, clear);
      if (!response.ok)
        return json(
          { message: '로그인 상태를 확인하지 못했어요. 다시 시도해주세요.' },
          response.status,
        );
      return json({ authenticated: true });
    }
    if (path === 'auth/login' && response.ok) {
      const data = (await response.json()) as { accessToken?: unknown };
      if (
        typeof data.accessToken !== 'string' ||
        !data.accessToken ||
        data.accessToken.length > 3800
      )
        return json({ message: '로그인 응답을 확인할 수 없어요.' }, 502);
      // expiresIn units are undocumented. The backend validates expiry; use a session cookie.
      return json({ authenticated: true }, 200, {
        'Set-Cookie': cookie(data.accessToken, secure),
      });
    }
    return new Response(
      response.status === 204 ? null : await response.text(),
      {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...(response.status === 401 ? clear : {}),
        },
      },
    );
  } catch (error) {
    console.error(
      'FollowUp upstream request failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return json(
      {
        message:
          '서버 응답을 받지 못했어요. 저장 여부를 확인한 뒤 다시 시도해주세요.',
        code: 'UPSTREAM_UNAVAILABLE',
      },
      502,
    );
  }
}
