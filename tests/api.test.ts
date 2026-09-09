import test from 'node:test';
import assert from 'node:assert/strict';
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { createHttpRepository } from '../lib/api';
import { makeSeed } from '../lib/demo-repository';

void test('실제 API 어댑터: 응답 검증, 데이터 래퍼, 확정 멱등 키, DELETE 204', async () => {
  const calls: AxiosRequestConfig[] = [];
  const seed = makeSeed();
  const client = axios.create({
    adapter: async (config) => {
      calls.push(config);
      let data: unknown = { data: seed.users[0] };
      if (config.url?.endsWith('/confirm')) data = { data: seed.meetings[0] };
      return {
        status: config.method === 'delete' ? 204 : 200,
        statusText: 'OK',
        config,
        headers: {},
        data,
      };
    },
  });
  const api = createHttpRepository(client);
  assert.equal(
    (await api.login({ email: 'demo@followup.local', password: 'test' })).id,
    'u-seohyun',
  );
  assert.equal(calls[0].url, '/auth/login');
  assert.equal(calls[0].method, 'post');
  await api.confirmMeeting('m-dev', seed.meetings[0].draft!);
  assert.equal(calls[1].url, '/meetings/m-dev/confirm');
  assert.equal(calls[1].headers?.['Idempotency-Key'], 'm-dev:draft-seed');
  assert.equal(await api.deleteTask('task-to-delete'), undefined);
});
void test('불완전한 서버 응답은 UI 데이터로 통과시키지 않는다', async () => {
  const api = createHttpRepository(
    axios.create({
      adapter: async (config) => ({
        status: 200,
        statusText: 'OK',
        config,
        headers: {},
        data: { id: 'missing-fields' },
      }),
    }),
  );
  await assert.rejects(
    () => api.project('p'),
    (e) => (e as { code: string }).code === 'INVALID_RESPONSE',
  );
});
void test('네트워크 오류, 타임아웃과 인증 오류를 사용자가 이해할 메시지로 변환', async () => {
  const api = createHttpRepository(
    axios.create({
      adapter: async () => {
        throw new AxiosError('timeout', 'ECONNABORTED');
      },
    }),
  );
  await assert.rejects(() => api.tasks('p'), /응답 시간이 초과/);
  const offline = createHttpRepository(
    axios.create({
      adapter: async () => {
        throw new AxiosError('network', 'ERR_NETWORK');
      },
    }),
  );
  await assert.rejects(() => offline.tasks('p'), /서버에 연결/);
  const unauth = createHttpRepository(
    axios.create({
      adapter: async (config) => {
        throw new AxiosError(
          'unauthorized',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          {
            status: 401,
            statusText: 'Unauthorized',
            config,
            headers: {},
            data: {},
          },
        );
      },
    }),
  );
  assert.equal(await unauth.me(), null);
  await assert.rejects(
    () => unauth.login({ email: 'test@example.com', password: 'test' }),
    (e) => (e as { status: number }).status === 401,
  );
});
