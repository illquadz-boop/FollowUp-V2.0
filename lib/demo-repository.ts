import { z } from 'zod';
import {
  AppError,
  DraftSchema,
  LoginSchema,
  SignupSchema,
  ProjectInputSchema,
  MeetingInputSchema,
  TaskInputSchema,
  UserSchema,
  WorkspaceSchema,
  ProjectSchema,
  MeetingSchema,
  TaskSchema,
  localDate,
  offsetDate,
  type User,
  type Meeting,
  type Task,
  type Project,
  type TaskInput,
} from './contracts';
import { analyzeLocally } from './demo-analysis';
import type { Repository } from './repository';

const DATABASE_KEY = 'followup.demo.v1';
const SESSION_KEY = 'followup.demo.session.v1';
const DatabaseSchema = z.object({
  version: z.literal(1),
  users: z.array(
    UserSchema.extend({
      passwordHash: z.string().nullable(),
      salt: z.string().nullable(),
    }),
  ),
  workspaces: z.array(WorkspaceSchema),
  projects: z.array(ProjectSchema),
  meetings: z.array(MeetingSchema),
  tasks: z.array(TaskSchema),
});
type Database = z.infer<typeof DatabaseSchema>;
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const visibleUser = ({ id, name, email, role }: User): User => ({
  id,
  name,
  email,
  role,
});
export function makeSeed(): Database {
  const today = localDate();
  const timestamp = (days: number) =>
    new Date(offsetDate(days, today) + 'T10:00:00').toISOString();
  const users = [
    {
      id: 'u-seohyun',
      name: '반서현',
      email: 'demo@followup.local',
      role: 'Backend',
    },
    {
      id: 'u-eunho',
      name: '장은호',
      email: 'eunho@followup.local',
      role: 'Frontend',
    },
    {
      id: 'u-doyun',
      name: '김도윤',
      email: 'doyun@followup.local',
      role: 'Frontend',
    },
    {
      id: 'u-yujin',
      name: '최유진',
      email: 'yujin@followup.local',
      role: 'Design',
    },
  ].map((u) => ({ ...u, passwordHash: null, salt: null }));
  const projects = [
    {
      id: 'p-followup',
      workspaceId: 'w-team',
      name: 'FollowUp 팀 프로젝트',
      description: 'AI 회의록 기반 후속 업무 관리 서비스 개발',
      memberIds: users.map((u) => u.id),
      ownerId: users[0].id,
      createdAt: timestamp(-14),
      updatedAt: timestamp(0),
      dueSoonDays: 3,
    },
    {
      id: 'p-seminar',
      workspaceId: 'w-team',
      name: '사내 세미나 운영',
      description: '월간 기술 세미나 기획 및 운영',
      memberIds: [users[0].id, users[3].id],
      ownerId: users[0].id,
      createdAt: timestamp(-8),
      updatedAt: timestamp(-3),
      dueSoonDays: 3,
    },
  ];
  const draft = {
    id: 'draft-seed',
    decisions: [
      '로그인 화면 오류는 이번 주 내 우선 수정한다.',
      '회원가입 UI는 디자인 시안 확정 후 개발 착수한다.',
    ],
    schedule: [
      { id: 'schedule-seed', title: '1차 QA 배포', date: offsetDate(3) },
    ],
    tasks: [],
    analyzedAt: timestamp(-5),
    source: 'LOCAL_DEMO' as const,
  };
  const meetings: Meeting[] = [
    {
      id: 'm-dev',
      projectId: 'p-followup',
      title: '개발 회의',
      date: offsetDate(-5),
      participantIds: users.slice(0, 3).map((u) => u.id),
      notes:
        '로그인 화면에서 간헐적으로 오류가 발생한다는 리포트가 있었음. 반서현이 원인을 분석하고 이번 주 내 수정하기로 함. 회원가입 UI는 디자인 시안이 나오는 대로 김도윤이 개발 착수. API 연동은 장은호가 담당, 1차 QA 배포는 이번 주 금요일 목표.',
      status: 'CONFIRMED',
      draft,
      carryoverTaskIds: ['t-ui', 't-db'],
      createdAt: timestamp(-5),
      updatedAt: timestamp(-5),
      confirmedAt: timestamp(-5),
    },
    {
      id: 'm-plan',
      projectId: 'p-followup',
      title: '기획 회의',
      date: offsetDate(-7),
      participantIds: [users[0].id, users[3].id],
      notes:
        '프로젝트 목표와 MVP 범위를 확정했다. 회원가입 UI와 DB 설계를 먼저 진행하고, ERD 작성과 프로젝트 초기 구성을 완료한다.',
      status: 'CONFIRMED',
      draft: {
        ...draft,
        id: 'draft-plan',
        decisions: ['회의 → 분석 → 검토 → 업무 확정을 핵심 흐름으로 설계한다.'],
        schedule: [],
      },
      carryoverTaskIds: [],
      createdAt: timestamp(-7),
      updatedAt: timestamp(-7),
      confirmedAt: timestamp(-7),
    },
  ];
  const tasks: Task[] = [
    {
      id: 't-ui',
      title: '회원가입 UI',
      assigneeId: 'u-doyun',
      dueDate: offsetDate(3),
      priority: 'MEDIUM',
      status: 'TODO',
      meetingId: 'm-plan',
      reason: '온보딩 플로우의 선행 작업으로 다른 화면 개발을 막고 있어요.',
    },
    {
      id: 't-db',
      title: 'DB 설계',
      assigneeId: 'u-yujin',
      dueDate: offsetDate(-1),
      priority: 'MEDIUM',
      status: 'TODO',
      meetingId: 'm-plan',
      reason: '백엔드 API 개발 착수 전 확정되어야 해요.',
    },
    {
      id: 't-login',
      title: '로그인 오류 수정',
      assigneeId: 'u-seohyun',
      dueDate: offsetDate(1),
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      meetingId: 'm-dev',
      reason: '사용자 리포트가 접수된 오류로 우선 처리가 필요해요.',
    },
    {
      id: 't-api',
      title: 'API 연동',
      assigneeId: 'u-eunho',
      dueDate: offsetDate(4),
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      meetingId: 'm-dev',
      reason: '1차 QA 배포 전 연동 테스트가 필요해요.',
    },
    {
      id: 't-erd',
      title: 'ERD 작성',
      assigneeId: 'u-yujin',
      dueDate: offsetDate(-8),
      priority: 'LOW',
      status: 'DONE',
      meetingId: 'm-plan',
      reason: '',
    },
    {
      id: 't-project',
      title: '프로젝트 생성',
      assigneeId: 'u-seohyun',
      dueDate: offsetDate(-12),
      priority: 'LOW',
      status: 'DONE',
      meetingId: 'm-plan',
      reason: '',
    },
  ].map(
    (t) =>
      ({
        ...t,
        projectId: 'p-followup',
        description: '',
        createdAt: timestamp(t.meetingId === 'm-dev' ? -5 : -7),
        updatedAt: timestamp(-1),
        completedAt: t.status === 'DONE' ? timestamp(-2) : null,
      }) as Task,
  );
  return {
    version: 1,
    users,
    workspaces: [
      {
        id: 'w-team',
        name: 'FollowUp 워크스페이스',
        ownerId: users[0].id,
        createdAt: timestamp(-14),
      },
    ],
    projects,
    meetings,
    tasks,
  };
}

async function passwordDigest(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export function createDemoRepository(
  storage: StoragePort,
  session: StoragePort,
): Repository {
  function read(): Database {
    const raw = storage.getItem(DATABASE_KEY);
    if (!raw) {
      const seed = makeSeed();
      write(seed);
      return seed;
    }
    try {
      return DatabaseSchema.parse(JSON.parse(raw));
    } catch {
      throw new AppError(
        '이 브라우저의 체험 데이터를 읽을 수 없어요. 다른 브라우저에서 시작하거나 저장 데이터를 복구해주세요.',
        500,
        'STORAGE_CORRUPT',
      );
    }
  }
  function write(db: Database) {
    try {
      storage.setItem(DATABASE_KEY, JSON.stringify(db));
    } catch {
      throw new AppError(
        '브라우저에 저장할 공간이 부족하거나 저장이 차단됐어요. 내용을 복사해 보관한 뒤 다시 시도해주세요.',
        507,
        'STORAGE_UNAVAILABLE',
      );
    }
  }
  function mutate<T>(action: (db: Database) => T): T {
    const db = read();
    const result = action(db);
    write(db);
    return structuredClone(result);
  }
  function who(db = read()) {
    const user = db.users.find((u) => u.id === session.getItem(SESSION_KEY));
    if (!user) throw new AppError('로그인이 필요해요.', 401, 'UNAUTHORIZED');
    return user;
  }
  function project(db: Database, projectId: string): Project {
    const user = who(db);
    const p = db.projects.find(
      (p) => p.id === projectId && p.memberIds.includes(user.id),
    );
    if (!p)
      throw new AppError(
        '프로젝트가 없거나 접근할 수 없어요.',
        404,
        'NOT_FOUND',
      );
    return p;
  }
  function meeting(db: Database, meetingId: string) {
    const m = db.meetings.find((m) => m.id === meetingId);
    if (!m) throw new AppError('회의를 찾을 수 없어요.', 404);
    project(db, m.projectId);
    return m;
  }
  function task(db: Database, taskId: string) {
    const t = db.tasks.find((t) => t.id === taskId);
    if (!t) throw new AppError('업무를 찾을 수 없어요.', 404);
    project(db, t.projectId);
    return t;
  }
  function owner(db: Database, p: Project) {
    if (p.ownerId !== who(db).id)
      throw new AppError(
        '프로젝트 관리자만 변경할 수 있어요.',
        403,
        'FORBIDDEN',
      );
  }
  function workspace(db: Database, workspaceId: string) {
    const u = who(db);
    const w = db.workspaces.find(
      (w) =>
        w.id === workspaceId &&
        (w.ownerId === u.id ||
          db.projects.some(
            (p) => p.workspaceId === w.id && p.memberIds.includes(u.id),
          )),
    );
    if (!w) throw new AppError('워크스페이스를 찾을 수 없어요.', 404);
    return w;
  }
  function checkMembers(db: Database, p: Project, ids: string[]) {
    if (
      ids.some(
        (i) => !p.memberIds.includes(i) || !db.users.some((u) => u.id === i),
      )
    )
      throw new AppError('프로젝트 구성원만 지정할 수 있어요.');
  }
  function validateTask(db: Database, p: Project, input: TaskInput) {
    if (input.assigneeId) checkMembers(db, p, [input.assigneeId]);
    if (
      input.meetingId &&
      !db.meetings.some((m) => m.id === input.meetingId && m.projectId === p.id)
    )
      throw new AppError('연결할 회의를 찾을 수 없어요.');
  }
  function touch(p: Project) {
    p.updatedAt = now();
  }
  const api: Repository = {
    async me() {
      const db = read();
      const u = db.users.find((u) => u.id === session.getItem(SESSION_KEY));
      return u ? visibleUser(u) : null;
    },
    async signup(input) {
      const value = SignupSchema.parse(input);
      const salt = id();
      const passwordHash = await passwordDigest(value.password, salt);
      return mutate((db) => {
        if (db.users.some((u) => u.email === value.email))
          throw new AppError('이미 등록된 이메일이에요.', 409, 'EMAIL_EXISTS');
        const u = {
          id: id(),
          name: value.name,
          email: value.email,
          role: 'Member',
          salt,
          passwordHash,
        };
        db.users.push(u);
        db.workspaces.push({
          id: id(),
          name: `${u.name}의 워크스페이스`,
          ownerId: u.id,
          createdAt: now(),
        });
        return visibleUser(u);
      });
    },
    async login(input) {
      const v = LoginSchema.parse(input);
      const u = read().users.find((u) => u.email === v.email);
      if (
        !u?.salt ||
        !u.passwordHash ||
        (await passwordDigest(v.password, u.salt)) !== u.passwordHash
      )
        throw new AppError(
          '이메일 또는 비밀번호가 올바르지 않아요.',
          401,
          'INVALID_CREDENTIALS',
        );
      session.setItem(SESSION_KEY, u.id);
      return visibleUser(u);
    },
    async demoLogin() {
      const u = read().users.find((u) => u.id === 'u-seohyun')!;
      session.setItem(SESSION_KEY, u.id);
      return visibleUser(u);
    },
    async logout() {
      session.removeItem(SESSION_KEY);
    },
    async updateProfile(input) {
      const name = z.string().trim().min(2).max(30).parse(input.name);
      const role = z.string().trim().max(50).parse(input.role);
      return mutate((db) => {
        const u = who(db);
        u.name = name;
        u.role = role;
        return visibleUser(u);
      });
    },
    async users() {
      const db = read();
      who(db);
      return db.users.map(visibleUser);
    },
    async workspaces() {
      const db = read();
      const u = who(db);
      return db.workspaces.filter(
        (w) =>
          w.ownerId === u.id ||
          db.projects.some(
            (p) => p.workspaceId === w.id && p.memberIds.includes(u.id),
          ),
      );
    },
    async createWorkspace(name) {
      return mutate((db) => {
        const u = who(db);
        const w = {
          id: id(),
          name: z
            .string()
            .trim()
            .min(1, '워크스페이스 이름을 입력해주세요.')
            .max(80)
            .parse(name),
          ownerId: u.id,
          createdAt: now(),
        };
        db.workspaces.push(w);
        return w;
      });
    },
    async projects(workspaceId) {
      const db = read();
      workspace(db, workspaceId);
      const u = who(db);
      return db.projects
        .filter(
          (p) => p.workspaceId === workspaceId && p.memberIds.includes(u.id),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async project(projectId) {
      return project(read(), projectId);
    },
    async createProject(workspaceId, input) {
      const v = ProjectInputSchema.parse(input);
      return mutate((db) => {
        workspace(db, workspaceId);
        const u = who(db);
        if (v.memberIds.some((i) => !db.users.some((u) => u.id === i)))
          throw new AppError('선택한 구성원을 찾을 수 없어요.');
        const p = {
          ...v,
          id: id(),
          workspaceId,
          memberIds: [...new Set([u.id, ...v.memberIds])],
          ownerId: u.id,
          createdAt: now(),
          updatedAt: now(),
          dueSoonDays: v.dueSoonDays ?? 3,
        };
        db.projects.push(p);
        return p;
      });
    },
    async updateProject(projectId, input) {
      const v = ProjectInputSchema.parse(input);
      return mutate((db) => {
        const p = project(db, projectId);
        owner(db, p);
        checkMembers(db, p, v.memberIds);
        Object.assign(p, {
          name: v.name,
          description: v.description,
          dueSoonDays: v.dueSoonDays ?? p.dueSoonDays,
        });
        touch(p);
        return p;
      });
    },
    async deleteProject(projectId) {
      mutate((db) => {
        const p = project(db, projectId);
        owner(db, p);
        db.projects = db.projects.filter((p) => p.id !== projectId);
        db.meetings = db.meetings.filter((m) => m.projectId !== projectId);
        db.tasks = db.tasks.filter((t) => t.projectId !== projectId);
      });
    },
    async addMembers(projectId, ids) {
      return mutate((db) => {
        const p = project(db, projectId);
        owner(db, p);
        if (!ids.length || ids.some((i) => !db.users.some((u) => u.id === i)))
          throw new AppError('추가할 구성원을 선택해주세요.');
        p.memberIds = [...new Set([...p.memberIds, ...ids])];
        touch(p);
        return p;
      });
    },
    async removeMember(projectId, userId) {
      return mutate((db) => {
        const p = project(db, projectId);
        owner(db, p);
        if (userId === p.ownerId)
          throw new AppError('프로젝트 관리자는 제거할 수 없어요.');
        p.memberIds = p.memberIds.filter((i) => i !== userId);
        db.tasks.forEach((t) => {
          if (t.projectId === projectId && t.assigneeId === userId) {
            t.assigneeId = null;
            t.updatedAt = now();
          }
        });
        touch(p);
        return p;
      });
    },
    async meetings(projectId) {
      const db = read();
      project(db, projectId);
      return db.meetings
        .filter((m) => m.projectId === projectId)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        );
    },
    async createMeeting(projectId, input) {
      const v = MeetingInputSchema.parse(input);
      return mutate((db) => {
        const p = project(db, projectId);
        checkMembers(db, p, v.participantIds);
        const prior = new Set(
          db.meetings
            .filter((m) => m.projectId === projectId && m.date <= v.date)
            .map((m) => m.id),
        );
        const m: Meeting = {
          ...v,
          id: id(),
          projectId,
          status: 'DRAFT',
          draft: null,
          carryoverTaskIds: db.tasks
            .filter(
              (t) =>
                t.projectId === projectId &&
                t.status !== 'DONE' &&
                t.meetingId &&
                prior.has(t.meetingId),
            )
            .map((t) => t.id),
          createdAt: now(),
          updatedAt: now(),
          confirmedAt: null,
        };
        db.meetings.push(m);
        touch(p);
        return m;
      });
    },
    async updateMeeting(meetingId, input) {
      const v = MeetingInputSchema.parse(input);
      return mutate((db) => {
        const m = meeting(db, meetingId);
        const p = project(db, m.projectId);
        checkMembers(db, p, v.participantIds);
        if (m.notes !== v.notes && m.status !== 'CONFIRMED') {
          m.draft = null;
          m.status = 'DRAFT';
        }
        Object.assign(m, v, { updatedAt: now() });
        touch(p);
        return m;
      });
    },
    async deleteMeeting(meetingId) {
      mutate((db) => {
        const m = meeting(db, meetingId);
        db.meetings = db.meetings.filter((x) => x.id !== meetingId);
        db.tasks.forEach((t) => {
          if (t.meetingId === meetingId) t.meetingId = null;
        });
        touch(project(db, m.projectId));
      });
    },
    async analyzeMeeting(meetingId) {
      const db = read();
      const m = meeting(db, meetingId);
      if (m.status === 'CONFIRMED')
        throw new AppError(
          '이미 확정된 회의예요. 연결된 업무에서 수정해주세요.',
          409,
        );
      const p = project(db, m.projectId);
      const draft = analyzeLocally(
        m.notes,
        db.users.filter((u) => p.memberIds.includes(u.id)),
        m.date,
      );
      await new Promise((resolve) => setTimeout(resolve, 700));
      return mutate((current) => {
        const existing = meeting(current, meetingId);
        if (
          existing.updatedAt !== m.updatedAt ||
          existing.status === 'CONFIRMED'
        )
          throw new AppError(
            '분석 중 회의가 변경됐어요. 다시 분석해주세요.',
            409,
          );
        existing.draft = draft;
        existing.status = 'REVIEW';
        existing.updatedAt = now();
        return existing;
      });
    },
    async saveDraft(meetingId, input) {
      const draft = DraftSchema.parse(input);
      return mutate((db) => {
        const m = meeting(db, meetingId);
        if (m.status === 'CONFIRMED')
          throw new AppError('이미 확정된 회의예요.', 409);
        if (m.draft && m.draft.id !== draft.id)
          throw new AppError(
            '더 새로운 분석 결과가 있어요. 회의를 다시 열어주세요.',
            409,
          );
        m.draft = draft;
        m.status = 'REVIEW';
        m.updatedAt = now();
        return m;
      });
    },
    async confirmMeeting(meetingId, input) {
      const draft = DraftSchema.parse(input);
      return mutate((db) => {
        const m = meeting(db, meetingId);
        if (m.status === 'CONFIRMED') {
          if (m.draft?.id === draft.id) return m;
          throw new AppError('이미 다른 결과로 확정된 회의예요.', 409);
        }
        if (!m.draft || m.draft.id !== draft.id)
          throw new AppError(
            '분석 결과가 변경됐어요. 회의를 다시 열어주세요.',
            409,
          );
        const p = project(db, m.projectId);
        draft.tasks.forEach((t) => {
          if (!t.assigneeId || !t.dueDate)
            throw new AppError('모든 업무의 담당자와 마감일을 지정해주세요.');
          checkMembers(db, p, [t.assigneeId]);
        });
        if (
          !draft.tasks.length &&
          !draft.decisions.length &&
          !draft.schedule.length
        )
          throw new AppError('확정할 항목을 한 개 이상 추가해주세요.');
        const timestamp = now();
        db.tasks.push(
          ...draft.tasks.map((t) => ({
            ...t,
            id: id(),
            projectId: p.id,
            meetingId: m.id,
            status: 'TODO' as const,
            createdAt: timestamp,
            updatedAt: timestamp,
            completedAt: null,
          })),
        );
        m.draft = draft;
        m.status = 'CONFIRMED';
        m.confirmedAt = timestamp;
        m.updatedAt = timestamp;
        touch(p);
        return m;
      });
    },
    async tasks(projectId) {
      const db = read();
      project(db, projectId);
      return db.tasks
        .filter((t) => t.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async createTask(projectId, input) {
      const v = TaskInputSchema.parse(input);
      return mutate((db) => {
        const p = project(db, projectId);
        validateTask(db, p, v);
        const t: Task = {
          ...v,
          id: id(),
          projectId,
          meetingId: v.meetingId ?? null,
          createdAt: now(),
          updatedAt: now(),
          completedAt: v.status === 'DONE' ? now() : null,
        };
        db.tasks.push(t);
        touch(p);
        return t;
      });
    },
    async updateTask(taskId, input) {
      const v = TaskInputSchema.parse(input);
      return mutate((db) => {
        const t = task(db, taskId);
        const p = project(db, t.projectId);
        validateTask(db, p, v);
        const completedAt = v.status === 'DONE' ? t.completedAt || now() : null;
        Object.assign(t, v, { updatedAt: now(), completedAt });
        touch(p);
        return t;
      });
    },
    async deleteTask(taskId) {
      mutate((db) => {
        const t = task(db, taskId);
        touch(project(db, t.projectId));
        db.tasks = db.tasks.filter((t) => t.id !== taskId);
        db.meetings.forEach((m) => {
          m.carryoverTaskIds = m.carryoverTaskIds.filter((i) => i !== taskId);
        });
      });
    },
  };
  return api;
}
