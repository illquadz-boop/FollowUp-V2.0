import { z } from 'zod';

export const StatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
export const PrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type Status = z.infer<typeof StatusSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜를 선택해주세요.')
  .refine((v) => {
    const d = new Date(v + 'T12:00:00');
    return !Number.isNaN(d.getTime()) && localDate(d) === v;
  }, '유효한 날짜를 선택해주세요.');
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function offsetDate(days: number, from = localDate()) {
  const d = new Date(from + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function daysUntil(date: string | null, today = localDate()) {
  return date
    ? Math.round(
        (Date.parse(date + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) /
          86400000,
      )
    : null;
}
export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
});
export type User = z.infer<typeof UserSchema>;
export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;
export const ProjectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  memberIds: z.array(z.string()),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dueSoonDays: z.number().int().min(0).max(30).default(3),
});
export type Project = z.infer<typeof ProjectSchema>;
export const DraftTaskSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, '업무명을 입력해주세요.').max(200),
  description: z.string().default(''),
  assigneeId: z.string().nullable(),
  dueDate: dateOnly.nullable(),
  priority: PrioritySchema,
  reason: z.string().default(''),
});
export type DraftTask = z.infer<typeof DraftTaskSchema>;
export const DraftSchema = z.object({
  id: z.string(),
  decisions: z.array(z.string().trim().min(1)),
  schedule: z.array(
    z.object({
      id: z.string(),
      title: z.string().trim().min(1),
      date: dateOnly.nullable(),
    }),
  ),
  tasks: z.array(DraftTaskSchema),
  analyzedAt: z.string(),
  source: z.enum(['LOCAL_DEMO', 'AI']),
});
export type Draft = z.infer<typeof DraftSchema>;
export const MeetingSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  date: dateOnly,
  participantIds: z.array(z.string()),
  notes: z.string(),
  status: z.enum(['DRAFT', 'REVIEW', 'CONFIRMED']),
  draft: DraftSchema.nullable(),
  carryoverTaskIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  confirmedAt: z.string().nullable(),
});
export type Meeting = z.infer<typeof MeetingSchema>;
export const TaskSchema = DraftTaskSchema.extend({
  id: z.string(),
  projectId: z.string(),
  meetingId: z.string().nullable(),
  status: StatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;
export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('이메일 형식을 확인해주세요.')
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});
export const SignupSchema = z.object({
  name: z.string().trim().min(2, '이름을 2자 이상 입력해주세요.').max(30),
  email: z
    .string()
    .trim()
    .email('이메일 형식을 확인해주세요.')
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 해요.').max(128),
});
export const ProjectInputSchema = z.object({
  name: z.string().trim().min(1, '프로젝트명을 입력해주세요.').max(80),
  description: z.string().max(1000),
  memberIds: z.array(z.string()).min(1, '구성원을 한 명 이상 선택해주세요.'),
  dueSoonDays: z.number().int().min(0).max(30).optional(),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export const MeetingInputSchema = z.object({
  title: z.string().trim().min(1, '회의 제목을 입력해주세요.').max(120),
  date: dateOnly,
  participantIds: z
    .array(z.string())
    .min(1, '참여자를 한 명 이상 선택해주세요.'),
  notes: z.string().max(100000, '회의록은 10만 자까지 입력할 수 있어요.'),
});
export type MeetingInput = z.infer<typeof MeetingInputSchema>;
export const TaskInputSchema = DraftTaskSchema.omit({ id: true }).extend({
  status: StatusSchema,
  meetingId: z.string().nullable().optional(),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;
export const statusLabels: Record<Status, string> = {
  TODO: '예정',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
};
export const priorityLabels: Record<Priority, string> = {
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
};
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = 'VALIDATION_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export function errorMessage(error: unknown) {
  return error instanceof z.ZodError
    ? error.issues[0]?.message || '입력 내용을 확인해주세요.'
    : error instanceof Error
      ? error.message
      : '요청을 처리하지 못했어요. 다시 시도해주세요.';
}
export function summarize(
  tasks: Task[],
  meetings: Meeting[],
  today = localDate(),
  threshold = 3,
) {
  const latest = [...meetings]
    .filter((m) => m.date <= today)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )[0];
  const since = latest ? `${latest.date}T00:00:00` : null;
  const unfinished = tasks.filter((t) => t.status !== 'DONE');
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'TODO').length,
    progress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    done: tasks.filter((t) => t.status === 'DONE').length,
    dueSoon: unfinished
      .filter((t) => {
        const d = daysUntil(t.dueDate, today);
        return d !== null && d >= 0 && d <= threshold;
      })
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)),
    overdue: unfinished
      .filter((t) => t.dueDate && t.dueDate < today)
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)),
    since: latest?.date || null,
    newCount: since
      ? tasks.filter((t) => new Date(t.createdAt) >= new Date(since)).length
      : 0,
    completedCount: since
      ? tasks.filter(
          (t) =>
            t.status === 'DONE' &&
            t.completedAt &&
            new Date(t.completedAt) >= new Date(since),
        ).length
      : 0,
    newlyOverdue: latest
      ? unfinished.filter(
          (t) => t.dueDate && t.dueDate >= latest.date && t.dueDate < today,
        ).length
      : 0,
  };
}
