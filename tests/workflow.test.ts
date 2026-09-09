import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoRepository, type StoragePort } from '../lib/demo-repository';
import {
  localDate,
  offsetDate,
  summarize,
  dateOnly,
  type Draft,
  type Task,
} from '../lib/contracts';
import { analyzeLocally, extractDate } from '../lib/demo-analysis';

function memory(): StoragePort {
  const values = new Map<string, string>();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
    removeItem: (k) => {
      values.delete(k);
    },
  };
}
async function setup() {
  const storage = memory();
  const session = memory();
  const api = createDemoRepository(storage, session);
  await api.demoLogin();
  return { api, storage, session };
}
void test('전체 흐름: 회의 저장 → 분석 → 수정 → 확정 → 다음 회의 연결', async () => {
  const { api, storage, session } = await setup();
  const p = await api.createProject('w-team', {
    name: '검증 프로젝트',
    description: '',
    memberIds: ['u-seohyun', 'u-eunho'],
  });
  const m = await api.createMeeting(p.id, {
    title: 'QA 회의',
    date: '2026-09-09',
    participantIds: p.memberIds,
    notes:
      '반서현은 금요일까지 로그인 오류를 수정하기로 했다. 장은호는 다음 주 월요일까지 API 연동을 진행한다. 검색 기능은 이번 버전에서 제외하기로 결정했다. 배포는 다음 주 월요일에 진행한다.',
  });
  assert.equal((await api.tasks(p.id)).length, 0);
  const analyzed = await api.analyzeMeeting(m.id);
  assert.equal(analyzed.status, 'REVIEW');
  assert.equal(analyzed.draft!.tasks.length, 2);
  assert.equal(analyzed.draft!.decisions.length, 1);
  assert.equal(analyzed.draft!.schedule[0].date, '2026-09-14');
  assert.equal((await api.tasks(p.id)).length, 0, '분석만으로 업무 생성 금지');
  const edited: Draft = {
    ...analyzed.draft!,
    decisions: ['검색 기능은 다음 버전으로 연기'],
    tasks: analyzed.draft!.tasks.map((t, i) => ({
      ...t,
      title: i === 0 ? '로그인 수정 최종 검토' : t.title,
      assigneeId: i === 0 ? 'u-eunho' : 'u-seohyun',
      dueDate: i === 0 ? '2026-09-11' : '2026-09-14',
    })),
  };
  await api.saveDraft(m.id, edited);
  const reloaded = createDemoRepository(storage, session);
  assert.deepEqual((await reloaded.meetings(p.id))[0].draft, edited);
  const [first, second] = await Promise.all([
    api.confirmMeeting(m.id, edited),
    api.confirmMeeting(m.id, edited),
  ]);
  assert.equal(first.status, 'CONFIRMED');
  assert.equal(second.status, 'CONFIRMED');
  const tasks = await api.tasks(p.id);
  assert.equal(tasks.length, 2, '중복 확정 멱등성');
  assert.ok(tasks.every((t) => t.status === 'TODO'));
  assert.equal(tasks[0].assigneeId, 'u-eunho');
  const done = await api.updateTask(tasks[0].id, {
    ...tasks[0],
    status: 'DONE',
  });
  assert.ok(done.completedAt);
  const next = await api.createMeeting(p.id, {
    title: '다음 회의',
    date: '2026-09-15',
    participantIds: p.memberIds,
    notes: '',
  });
  assert.deepEqual(next.carryoverTaskIds, [tasks[1].id]);
  const reopened = await api.updateTask(done.id, {
    ...done,
    status: 'IN_PROGRESS',
  });
  assert.equal(reopened.completedAt, null);
  assert.equal(
    (await api.tasks('p-followup')).length,
    6,
    '다른 프로젝트는 변경되지 않음',
  );
});
void test('유효성 검증과 분석 실패는 원본 회의록과 업무를 보존한다', async () => {
  const { api } = await setup();
  await assert.rejects(() =>
    api.createMeeting('p-followup', {
      title: '',
      date: localDate(),
      participantIds: [],
      notes: '',
    }),
  );
  const m = await api.createMeeting('p-followup', {
    title: '빈 회의',
    date: localDate(),
    participantIds: ['u-seohyun'],
    notes: '',
  });
  await assert.rejects(() => api.analyzeMeeting(m.id), /회의록/);
  assert.equal(
    (await api.meetings('p-followup')).find((x) => x.id === m.id)!.notes,
    '',
  );
  assert.equal((await api.tasks('p-followup')).length, 6);
  await api.updateMeeting(m.id, {
    ...m,
    notes: '반서현은 내일까지 로그인 오류를 수정한다.',
  });
  const analyzed = await api.analyzeMeeting(m.id);
  const bad = {
    ...analyzed.draft!,
    tasks: analyzed.draft!.tasks.map((t) => ({ ...t, assigneeId: null })),
  };
  await assert.rejects(() => api.confirmMeeting(m.id, bad), /담당자/);
  assert.equal((await api.tasks('p-followup')).length, 6);
  await assert.rejects(
    () => api.confirmMeeting(m.id, { ...analyzed.draft!, id: 'obsolete' }),
    /변경/,
  );
  await api.updateMeeting(m.id, { ...m, notes: '변경된 회의록' });
  const fresh = (await api.meetings('p-followup')).find((x) => x.id === m.id)!;
  assert.equal(fresh.draft, null);
  assert.equal(fresh.status, 'DRAFT');
});
void test('구성원 제거·업무 삭제·회의 삭제의 연결 일관성', async () => {
  const { api } = await setup();
  const original = (await api.meetings('p-followup')).find(
    (m) => m.id === 'm-dev',
  )!;
  await api.removeMember('p-followup', 'u-eunho');
  assert.equal(
    (await api.tasks('p-followup')).find((t) => t.id === 't-api')!.assigneeId,
    null,
  );
  assert.deepEqual(
    (await api.meetings('p-followup')).find((m) => m.id === 'm-dev')!
      .participantIds,
    original.participantIds,
  );
  await assert.rejects(
    () => api.removeMember('p-followup', 'u-seohyun'),
    /관리자/,
  );
  await api.deleteMeeting('m-plan');
  assert.ok(
    (await api.tasks('p-followup'))
      .filter((t) => t.id === 't-ui' || t.id === 't-erd')
      .every((t) => t.meetingId === null),
  );
  assert.equal((await api.tasks('p-followup')).length, 6);
  await api.deleteTask('t-ui');
  assert.ok(
    (await api.meetings('p-followup')).every(
      (m) => !m.carryoverTaskIds.includes('t-ui'),
    ),
  );
  await api.deleteProject('p-followup');
  await assert.rejects(() => api.tasks('p-followup'), /프로젝트/);
  assert.equal((await api.projects('w-team')).length, 1);
  assert.equal((await api.project('p-seminar')).name, '사내 세미나 운영');
});
void test('회원가입·로그인·이메일 중복·로그아웃·다른 계정 접근 차단', async () => {
  const { api, storage, session } = await setup();
  await api.logout();
  const user = await api.signup({
    name: '테스트 사용자',
    email: ' Test@example.com ',
    password: 'local-test-password',
  });
  assert.equal(user.email, 'test@example.com');
  assert.equal(await api.me(), null);
  await assert.rejects(
    () =>
      api.signup({
        name: '테스트',
        email: 'test@example.com',
        password: 'different-password',
      }),
    /이미 등록/,
  );
  await assert.rejects(
    () => api.login({ email: user.email, password: 'wrong-password' }),
    /올바르지/,
  );
  await api.login({ email: user.email, password: 'local-test-password' });
  assert.equal((await api.me())!.id, user.id);
  await assert.rejects(() => api.tasks('p-followup'), /접근/);
  assert.equal((await api.workspaces()).length, 1);
  assert.equal((await api.projects((await api.workspaces())[0].id)).length, 0);
  assert.ok(
    !storage.getItem('followup.demo.v1')!.includes('local-test-password'),
    '평문 비밀번호 저장 금지',
  );
  const reloaded = createDemoRepository(storage, session);
  assert.equal((await reloaded.me())!.id, user.id);
  await reloaded.logout();
  await assert.rejects(() => reloaded.users(), /로그인/);
});
void test('날짜 경계: 오늘/임박/지연/완료, 회의 이후 실제 변화', () => {
  const today = '2026-09-09';
  const base = {
    projectId: 'p',
    meetingId: 'm',
    title: '업무',
    description: '',
    assigneeId: null,
    priority: 'MEDIUM',
    reason: '',
    createdAt: '2026-09-07T10:00:00+09:00',
    updatedAt: '2026-09-08T10:00:00+09:00',
    completedAt: null,
  } as const;
  const tasks: Task[] = [
    { ...base, id: 'a', status: 'TODO', dueDate: today },
    { ...base, id: 'b', status: 'IN_PROGRESS', dueDate: '2026-09-08' },
    {
      ...base,
      id: 'c',
      status: 'DONE',
      dueDate: '2026-09-01',
      completedAt: '2026-09-09T10:00:00+09:00',
    },
    { ...base, id: 'd', status: 'TODO', dueDate: '2026-09-12' },
    { ...base, id: 'e', status: 'TODO', dueDate: '2026-09-13' },
    { ...base, id: 'f', status: 'TODO', dueDate: null },
  ];
  const result = summarize(tasks, [], today, 3);
  assert.deepEqual(
    result.dueSoon.map((t) => t.id),
    ['a', 'd'],
  );
  assert.deepEqual(
    result.overdue.map((t) => t.id),
    ['b'],
  );
  assert.equal(result.done, 1);
  assert.equal(result.newCount, 0);
  assert.equal(offsetDate(1, '2026-12-31'), '2027-01-01');
  assert.equal(dateOnly.safeParse('2026-02-30').success, false);
  assert.equal(extractDate('다음 주 월요일 배포', today), '2026-09-14');
  assert.equal(extractDate('금요일까지 수정', today), '2026-09-11');
  assert.equal(extractDate('9월 31일 배포', today), null);
});
void test('규칙 기반 체험 분석은 추측한 담당자를 강제로 지정하지 않는다', () => {
  const result = analyzeLocally(
    '김 대리는 금요일까지 로그인 오류를 수정하기로 했다. 배포는 다음 주 월요일에 진행한다. 검색 기능은 이번 버전에서 제외하기로 결정했다.',
    [],
    '2026-09-09',
  );
  assert.equal(result.source, 'LOCAL_DEMO');
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].assigneeId, null);
  assert.equal(result.tasks[0].dueDate, '2026-09-11');
  assert.equal(result.tasks[0].priority, 'HIGH');
  assert.equal(result.schedule[0].date, '2026-09-14');
  assert.equal(result.decisions.length, 1);
});
void test('저장소 실패 시 실패를 알리고 기존 데이터를 덮어쓰지 않는다', async () => {
  const { api, storage, session } = await setup();
  const snapshot = storage.getItem('followup.demo.v1');
  const broken: StoragePort = {
    ...storage,
    setItem: () => {
      throw new Error('quota');
    },
  };
  const repo = createDemoRepository(broken, session);
  await assert.rejects(() => repo.createWorkspace('저장 실패'), /저장할 공간/);
  assert.equal(storage.getItem('followup.demo.v1'), snapshot);
  assert.equal((await api.workspaces()).length, 1);
});
