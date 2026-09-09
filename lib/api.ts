import axios, { type AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  AppError,
  UserSchema,
  WorkspaceSchema,
  ProjectSchema,
  MeetingSchema,
  TaskSchema,
  DraftSchema,
  LoginSchema,
  SignupSchema,
  ProjectInputSchema,
  MeetingInputSchema,
  TaskInputSchema,
} from './contracts';
import { createDemoRepository } from './demo-repository';
import type { Repository } from './repository';

export const isDemo = import.meta.env?.VITE_DATA_MODE !== 'api';
export function createHttpRepository(client: AxiosInstance): Repository {
  async function request<S extends z.ZodTypeAny>(
    method: string,
    url: string,
    schema: S,
    data?: unknown,
    headers?: Record<string, string>,
  ): Promise<z.output<S>> {
    try {
      const response = await client.request({ method, url, data, headers });
      const raw = response.status === 204 ? undefined : response.data;
      const body =
        raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
      const parsed = schema.safeParse(body);
      if (!parsed.success)
        throw new AppError(
          '서버 응답 형식이 올바르지 않아요. 잠시 후 다시 시도해주세요.',
          502,
          'INVALID_RESPONSE',
        );
      return parsed.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 0;
        const code =
          error.response?.data?.code || error.code || 'NETWORK_ERROR';
        const message =
          error.response?.data?.message ||
          (
            {
              401: '로그인이 만료됐어요. 다시 로그인해주세요.',
              403: '이 작업에 대한 권한이 없어요.',
              404: '요청한 항목을 찾을 수 없어요.',
              409: '다른 변경 사항이 있어요. 새로고침 후 다시 시도해주세요.',
              429: '요청이 많아요. 잠시 후 다시 시도해주세요.',
            } as Record<number, string>
          )[status] ||
          (error.code === 'ECONNABORTED'
            ? '응답 시간이 초과됐어요. 입력 내용은 유지됩니다.'
            : status >= 500
              ? '서버에서 요청을 처리하지 못했어요. 다시 시도해주세요.'
              : '서버에 연결할 수 없어요. 네트워크와 API 주소를 확인해주세요.');
        if (
          status === 401 &&
          url !== '/auth/login' &&
          url !== '/auth/me' &&
          typeof window !== 'undefined'
        )
          window.dispatchEvent(new Event('followup:unauthorized'));
        throw new AppError(message, status, code);
      }
      throw error;
    }
  }
  const path = (id: string) => encodeURIComponent(id);
  const empty = z.unknown().transform(() => undefined);
  return {
    async me() {
      try {
        return await request('GET', '/auth/me', UserSchema.nullable());
      } catch (e) {
        if (e instanceof AppError && e.status === 401) return null;
        throw e;
      }
    },
    signup: (input) =>
      request('POST', '/auth/signup', UserSchema, SignupSchema.parse(input)),
    login: (input) =>
      request('POST', '/auth/login', UserSchema, LoginSchema.parse(input)),
    async demoLogin() {
      throw new AppError('체험 기능은 데모 모드에서 이용할 수 있어요.');
    },
    logout: () => request('POST', '/auth/logout', empty),
    updateProfile: (input) => request('PATCH', '/users/me', UserSchema, input),
    users: () => request('GET', '/users', z.array(UserSchema)),
    workspaces: () => request('GET', '/workspaces', z.array(WorkspaceSchema)),
    createWorkspace: (name) =>
      request('POST', '/workspaces', WorkspaceSchema, { name }),
    projects: (id) =>
      request(
        'GET',
        `/workspaces/${path(id)}/projects`,
        z.array(ProjectSchema),
      ),
    project: (id) => request('GET', `/projects/${path(id)}`, ProjectSchema),
    createProject: (id, input) =>
      request(
        'POST',
        `/workspaces/${path(id)}/projects`,
        ProjectSchema,
        ProjectInputSchema.parse(input),
      ),
    updateProject: (id, input) =>
      request(
        'PATCH',
        `/projects/${path(id)}`,
        ProjectSchema,
        ProjectInputSchema.parse(input),
      ),
    deleteProject: (id) => request('DELETE', `/projects/${path(id)}`, empty),
    addMembers: (id, memberIds) =>
      request('POST', `/projects/${path(id)}/members`, ProjectSchema, {
        memberIds,
      }),
    removeMember: (id, userId) =>
      request(
        'DELETE',
        `/projects/${path(id)}/members/${path(userId)}`,
        ProjectSchema,
      ),
    meetings: (id) =>
      request('GET', `/projects/${path(id)}/meetings`, z.array(MeetingSchema)),
    createMeeting: (id, input) =>
      request(
        'POST',
        `/projects/${path(id)}/meetings`,
        MeetingSchema,
        MeetingInputSchema.parse(input),
      ),
    updateMeeting: (id, input) =>
      request(
        'PATCH',
        `/meetings/${path(id)}`,
        MeetingSchema,
        MeetingInputSchema.parse(input),
      ),
    deleteMeeting: (id) => request('DELETE', `/meetings/${path(id)}`, empty),
    analyzeMeeting: (id) =>
      request('POST', `/meetings/${path(id)}/analyze`, MeetingSchema),
    saveDraft: (id, draft) =>
      request(
        'PUT',
        `/meetings/${path(id)}/draft`,
        MeetingSchema,
        DraftSchema.parse(draft),
      ),
    confirmMeeting: (id, draft) =>
      request(
        'POST',
        `/meetings/${path(id)}/confirm`,
        MeetingSchema,
        DraftSchema.parse(draft),
        { 'Idempotency-Key': `${id}:${draft.id}` },
      ),
    tasks: (id) =>
      request('GET', `/projects/${path(id)}/action-items`, z.array(TaskSchema)),
    createTask: (id, input) =>
      request(
        'POST',
        `/projects/${path(id)}/action-items`,
        TaskSchema,
        TaskInputSchema.parse(input),
      ),
    updateTask: (id, input) =>
      request(
        'PATCH',
        `/action-items/${path(id)}`,
        TaskSchema,
        TaskInputSchema.parse(input),
      ),
    deleteTask: (id) => request('DELETE', `/action-items/${path(id)}`, empty),
  };
}
let repository: Repository | undefined;
export function getRepository() {
  if (repository) return repository;
  if (typeof window === 'undefined')
    throw new AppError('브라우저에서 실행해주세요.');
  if (isDemo)
    repository = createDemoRepository(
      window.localStorage,
      window.sessionStorage,
    );
  else
    repository = createHttpRepository(
      axios.create({
        baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
        timeout: 45000,
        withCredentials: true,
        withXSRFToken: true,
        xsrfCookieName: 'XSRF-TOKEN',
        xsrfHeaderName: 'X-XSRF-TOKEN',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
  return repository;
}
