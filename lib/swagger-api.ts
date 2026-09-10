import { z } from 'zod';
import { AppError } from './contracts';

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const text = z
  .string()
  .nullish()
  .transform((v) => v ?? '');
const optionalId = id.nullish().transform((v) => v ?? null);
const optionalDate = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
export const Status = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
export const Priority = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export const ProjectSchema = z.object({
  id,
  name: z.string(),
  description: text,
  createdBy: id,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const MemberSchema = z.object({
  userId: id,
  name: z.string(),
  email: z.string(),
  role: z.enum(['OWNER', 'MEMBER']),
  joinedAt: z.string(),
});
export const MeetingSummarySchema = z.object({
  id,
  title: z.string(),
  scheduledAt: z.string(),
  status: z.enum(['DRAFT', 'CONFIRMED']),
  createdBy: id,
  createdAt: z.string(),
});
export const MeetingSchema = MeetingSummarySchema.extend({
  projectId: id,
  content: text,
  updatedAt: z.string(),
  participants: z.array(
    z.object({ userId: id, name: z.string(), email: z.string() }),
  ),
  carryOverActionItems: z.array(
    z.object({
      actionItemId: id,
      title: z.string(),
      status: Status,
      assigneeUserId: optionalId,
      dueDate: optionalDate,
      priority: Priority.nullish(),
    }),
  ),
  decisions: z.array(
    z.object({ id, content: z.string(), createdAt: z.string() }),
  ),
});
export const TaskSummarySchema = z.object({
  id,
  title: z.string(),
  status: Status,
  priority: Priority.nullish(),
  assigneeUserId: optionalId,
  dueDate: optionalDate,
  projectId: id,
});
export const TaskSchema = z.object({
  id,
  projectId: id,
  title: z.string(),
  description: text,
  assignee: z
    .object({ userId: id, name: z.string(), email: z.string() })
    .nullish(),
  dueDate: optionalDate,
  status: Status,
  priority: Priority.nullish(),
  priorityReason: text,
  originMeetingId: optionalId,
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: optionalDate,
});
export const AnalysisSchema = z.object({
  id,
  meetingId: id,
  status: z.enum(['PROCESSING', 'GENERATED', 'CONFIRMED', 'FAILED']),
  modelName: text,
  promptVersion: text,
  errorMessage: text,
  createdAt: z.string(),
  confirmedAt: optionalDate,
  draft: z
    .object({
      decisions: z.array(z.object({ content: z.string() })).nullish(),
      actionItems: z
        .array(
          z.object({
            title: z.string(),
            description: text,
            assigneeName: text,
            dueDate: optionalDate,
            priority: Priority.nullish(),
            priorityReason: text,
          }),
        )
        .nullish(),
    })
    .nullish(),
});
export const DashboardSchema = z.object({
  actionItemSummary: z.object({
    total: z.number(),
    todo: z.number(),
    inProgress: z.number(),
    done: z.number(),
    overdue: z.number(),
  }),
  dueSoonActionItems: z.array(
    z.object({
      actionItemId: id,
      title: z.string(),
      status: Status,
      priority: Priority.nullish(),
      dueDate: optionalDate,
      assigneeUserId: optionalId,
      assigneeName: text,
    }),
  ),
  recentMeetings: z.array(
    z.object({
      meetingId: id,
      title: z.string(),
      scheduledAt: z.string(),
      status: z.enum(['DRAFT', 'CONFIRMED']),
    }),
  ),
  memberProgress: z.array(
    z.object({
      userId: id,
      name: z.string(),
      totalCount: z.number(),
      doneCount: z.number(),
      completionRate: z.number(),
    }),
  ),
});
export type Project = z.infer<typeof ProjectSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type Meeting = z.infer<typeof MeetingSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type TaskInput = {
  title: string;
  description: string;
  assigneeUserId: number | null;
  dueDate: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
};
export type ConfirmInput = {
  decisions: { content: string }[];
  actionItems: (TaskInput & { priorityReason: string })[];
};
export type MeetingInput = {
  title: string;
  scheduledAt: string;
  content: string;
  participantIds: number[];
  carryOverActionItemIds?: number[];
};
const empty = z.unknown().transform(() => undefined);
export async function apiRequest<S extends z.ZodTypeAny>(
  method: string,
  path: string,
  schema: S,
  data?: unknown,
): Promise<z.output<S>> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(path.endsWith('/analysis') ? 125000 : 50000),
    });
  } catch {
    throw new AppError(
      '서버에 연결하지 못했어요. 입력은 유지됩니다. 저장 여부를 확인한 뒤 다시 시도해주세요.',
      0,
      'NETWORK_ERROR',
    );
  }
  const raw =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login')
      window.dispatchEvent(new Event('followup:unauthorized'));
    const error = z
      .object({ message: z.string().optional(), code: z.string().optional() })
      .safeParse(raw);
    throw new AppError(
      (error.success && error.data.message) ||
        `요청을 처리하지 못했어요. (${response.status})`,
      response.status,
      (error.success && error.data.code) || 'API_ERROR',
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      '서버 응답 형식이 명세와 달라요. 새로고침 후에도 계속되면 관리자에게 알려주세요.',
      502,
      'INVALID_RESPONSE',
    );
  return parsed.data;
}
const safeId = (value: number) => id.parse(value);
export const backend = {
  session: () =>
    apiRequest(
      'GET',
      '/auth/session',
      z.object({ authenticated: z.boolean() }),
    ),
  health: () => apiRequest('GET', '/health', z.object({ status: z.string() })),
  login: (email: string, password: string) =>
    apiRequest(
      'POST',
      '/auth/login',
      z.object({ authenticated: z.boolean() }),
      { email, password },
    ),
  signup: (name: string, email: string, password: string) =>
    apiRequest(
      'POST',
      '/auth/signup',
      z.object({ userId: id, email: z.string(), name: z.string() }),
      { name, email, password },
    ),
  logout: () => apiRequest('POST', '/auth/logout', empty),
  projects: () => apiRequest('GET', '/projects', z.array(ProjectSchema)),
  project: (p: number) =>
    apiRequest('GET', `/project/${safeId(p)}`, ProjectSchema),
  createProject: (data: { name: string; description: string }) =>
    apiRequest('POST', '/project', ProjectSchema, data),
  updateProject: (p: number, data: { name: string; description: string }) =>
    apiRequest('PATCH', `/project/${safeId(p)}`, ProjectSchema, data),
  deleteProject: (p: number) =>
    apiRequest('DELETE', `/project/${safeId(p)}`, empty),
  members: (p: number) =>
    apiRequest('GET', `/project/${safeId(p)}/members`, z.array(MemberSchema)),
  addMember: (p: number, email: string) =>
    apiRequest('POST', `/project/${safeId(p)}/member`, MemberSchema, { email }),
  removeMember: (p: number, u: number) =>
    apiRequest('DELETE', `/project/${safeId(p)}/member/${safeId(u)}`, empty),
  meetings: (p: number) =>
    apiRequest(
      'GET',
      `/project/${safeId(p)}/meetings`,
      z.array(MeetingSummarySchema),
    ),
  meeting: (m: number) =>
    apiRequest('GET', `/meeting/${safeId(m)}`, MeetingSchema),
  createMeeting: (p: number, data: MeetingInput) =>
    apiRequest('POST', `/project/${safeId(p)}/meeting`, MeetingSchema, data),
  updateMeeting: async (m: number, data: Partial<MeetingInput>) => {
    const { carryOverActionItemIds: _unused, ...input } = data;
    try {
      return await apiRequest(
        'PATCH',
        `/meeting/${safeId(m)}`,
        MeetingSchema,
        input,
      );
    } catch (error) {
      if (
        error instanceof AppError &&
        error.status === 500 &&
        input.participantIds
      )
        throw new AppError(
          '서버에서 참여자 변경을 처리하지 못했어요. 참여자를 기존 값으로 되돌리면 다른 내용은 저장할 수 있어요.',
          500,
          'PARTICIPANT_UPDATE_FAILED',
        );
      throw error;
    }
  },
  deleteMeeting: (m: number) =>
    apiRequest('DELETE', `/meeting/${safeId(m)}`, empty),
  tasks: (p: number) =>
    apiRequest(
      'GET',
      `/project/${safeId(p)}/action-items`,
      z.array(TaskSummarySchema),
    ),
  task: (t: number) =>
    apiRequest('GET', `/action-item/${safeId(t)}`, TaskSchema),
  createTask: (p: number, data: TaskInput) =>
    apiRequest('POST', `/project/${safeId(p)}/action-item`, TaskSchema, data),
  updateTask: async (
    t: number,
    data: Partial<TaskInput> & { status?: 'TODO' | 'IN_PROGRESS' | 'DONE' },
  ) => {
    const task = await apiRequest(
      'PATCH',
      `/action-item/${safeId(t)}`,
      TaskSchema,
      data,
    );
    if (
      (data.assigneeUserId === null && task.assignee != null) ||
      (data.dueDate === null && task.dueDate !== null)
    )
      throw new AppError(
        '서버가 담당자 또는 마감일 해제를 반영하지 않았어요. 다른 변경은 저장되었을 수 있으니 재조회해주세요.',
        409,
        'PATCH_NOT_APPLIED',
      );
    return task;
  },
  deleteTask: (t: number) =>
    apiRequest('DELETE', `/action-item/${safeId(t)}`, empty),
  analyze: (m: number) =>
    apiRequest('POST', `/meeting/${safeId(m)}/analysis`, AnalysisSchema),
  analysis: (a: number) =>
    apiRequest('GET', `/analysis/${safeId(a)}`, AnalysisSchema),
  confirm: (a: number, data: ConfirmInput) =>
    apiRequest('POST', `/analysis/${safeId(a)}/confirm`, AnalysisSchema, data),
  dashboard: (p: number) =>
    apiRequest('GET', `/project/${safeId(p)}/dashboard`, DashboardSchema),
};
