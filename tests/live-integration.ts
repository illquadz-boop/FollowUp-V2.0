// Explicit opt-in: creates isolated test accounts and records on the supplied backend.
// Never prints passwords, bearer tokens or cookies. Run against the same-origin gateway.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ProjectSchema,
  MemberSchema,
  MeetingSchema,
  TaskSchema,
  AnalysisSchema,
  DashboardSchema,
} from '../lib/swagger-api';
if (process.env.RUN_LIVE_API !== '1')
  throw new Error('Set RUN_LIVE_API=1 to create live test records.');
const origin = process.env.TEST_APP_ORIGIN || 'http://localhost:3001';
let cookie = '';
const suffix = randomUUID().slice(0, 8);
const email = `followup-test-${suffix}@example.invalid`;
const password = randomUUID() + '!aA9';
const report: { step: string; status: number }[] = [];
async function call(
  path: string,
  method = 'GET',
  data?: unknown,
  expected = [200, 201, 204],
) {
  const options: RequestInit = {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
  };
  if (data !== undefined) options.body = JSON.stringify(data);
  const response = await fetch(`${origin}/api${path}`, options);
  const body = response.status === 204 ? undefined : await response.json();
  if (!expected.includes(response.status))
    throw new Error(
      `${method} ${path}: ${response.status} ${JSON.stringify(body)}`,
    );
  if (response.headers.has('set-cookie'))
    cookie = response.headers.get('set-cookie')!.split(';')[0];
  report.push({ step: `${method} ${path}`, status: response.status });
  return body;
}
try {
  await call('/health');
  await call('/auth/signup', 'POST', {
    email,
    password,
    name: `연동검증 ${suffix}`,
  });
  await call('/auth/signup', 'POST', {
    email: `followup-member-${suffix}@example.invalid`,
    password,
    name: `검증멤버 ${suffix}`,
  });
  assert.equal(
    z
      .object({ authenticated: z.boolean() })
      .parse(await call('/auth/login', 'POST', { email, password }))
      .authenticated,
    true,
  );
  assert.equal(
    z.object({ authenticated: z.boolean() }).parse(await call('/auth/session'))
      .authenticated,
    true,
  );
  const p = ProjectSchema.parse(
    await call('/project', 'POST', {
      name: `연동 검증 ${suffix}`,
      description: '자동 연동 테스트 전용 데이터',
    }),
  );
  await call('/projects');
  ProjectSchema.parse(await call(`/project/${p.id}`));
  ProjectSchema.parse(
    await call(`/project/${p.id}`, 'PATCH', {
      name: `연동 검증 완료 ${suffix}`,
    }),
  );
  const member = MemberSchema.parse(
    await call(`/project/${p.id}/member`, 'POST', {
      email: `followup-member-${suffix}@example.invalid`,
    }),
  );
  await call(`/project/${p.id}/members`);
  const task = TaskSchema.parse(
    await call(`/project/${p.id}/action-item`, 'POST', {
      title: '연동 검증 업무',
      description: '테스트',
      assigneeUserId: member.userId,
      dueDate: '2026-09-20',
      priority: 'HIGH',
    }),
  );
  TaskSchema.parse(await call(`/action-item/${task.id}`));
  const changed = TaskSchema.parse(
    await call(`/action-item/${task.id}`, 'PATCH', {
      status: 'IN_PROGRESS',
      title: '수정 검증 업무',
    }),
  );
  assert.equal(changed.status, 'IN_PROGRESS');
  const cleared = TaskSchema.parse(
    await call(`/action-item/${task.id}`, 'PATCH', {
      assigneeUserId: null,
      dueDate: null,
    }),
  );
  console.log(
    JSON.stringify({
      observation: 'PATCH null semantics',
      assigneeCleared: !cleared.assignee,
      dueDateCleared: cleared.dueDate === null,
    }),
  );
  const meeting = MeetingSchema.parse(
    await call(`/project/${p.id}/meeting`, 'POST', {
      title: '삭제 가능한 검증 회의',
      scheduledAt: '2026-09-10T14:00:00',
      content: '테스트 회의록',
      participantIds: [member.userId],
      carryOverActionItemIds: [task.id],
    }),
  );
  MeetingSchema.parse(await call(`/meeting/${meeting.id}`));
  for (const patch of [
    { content: '수정된 테스트 회의록' },
    { title: '수정된 검증 회의' },
    { scheduledAt: '2026-09-10T15:00:00' },
    { participantIds: [member.userId] },
  ]) {
    const result = await call(
      `/meeting/${meeting.id}`,
      'PATCH',
      patch,
      [200, 500],
    );
    console.log(
      JSON.stringify({
        observation: 'Meeting PATCH field',
        field: Object.keys(patch)[0],
        response: result,
      }),
    );
  }
  await call(`/project/${p.id}/meetings`);
  await call(`/project/${p.id}/action-items`);
  DashboardSchema.parse(await call(`/project/${p.id}/dashboard`));
  await call(`/meeting/${meeting.id}`, 'DELETE');
  await call(`/action-item/${task.id}`, 'DELETE');
  await call(`/project/${p.id}/member/${member.userId}`, 'DELETE');
  await call(`/project/${p.id}`, 'DELETE');
  // One bounded AI call, in a separate project because analysis history prevents deletion.
  const ap = ProjectSchema.parse(
    await call('/project', 'POST', {
      name: `AI 연동 검증 ${suffix}`,
      description: '분석·확정 API 검증 기록',
    }),
  );
  const am = MeetingSchema.parse(
    await call(`/project/${ap.id}/meeting`, 'POST', {
      title: 'AI 통합 검증 회의',
      scheduledAt: '2026-09-10T16:00:00',
      content:
        '오늘 회의에서는 로그인 안정화를 우선 진행하기로 결정했다. 로그인 오류 재현 테스트를 작성한다. 담당자는 미정이고 기한은 2026년 9월 20일이다.',
      participantIds: [],
      carryOverActionItemIds: [],
    }),
  );
  let analysis = AnalysisSchema.parse(
    await call(`/meeting/${am.id}/analysis`, 'POST'),
  );
  for (let i = 0; analysis.status === 'PROCESSING' && i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    analysis = AnalysisSchema.parse(await call(`/analysis/${analysis.id}`));
  }
  console.log(
    JSON.stringify({
      observation: 'AI analysis',
      projectId: ap.id,
      meetingId: am.id,
      analysisId: analysis.id,
      status: analysis.status,
      error: analysis.errorMessage,
    }),
  );
  if (analysis.status === 'GENERATED') {
    const confirmed = AnalysisSchema.parse(
      await call(`/analysis/${analysis.id}/confirm`, 'POST', {
        decisions: [{ content: '로그인 안정화 우선' }],
        actionItems: [
          {
            title: '로그인 재현 테스트',
            description: '연동 검증',
            assigneeUserId: null,
            dueDate: '2026-09-20',
            priority: 'HIGH',
            priorityReason: '로그인 안정화',
          },
        ],
      }),
    );
    assert.equal(confirmed.status, 'CONFIRMED');
    const generated = (await call(`/project/${ap.id}/action-items`)) as {
      id: number;
    }[];
    assert.equal(generated.length, 1);
    const detail = TaskSchema.parse(
      await call(`/action-item/${generated[0].id}`),
    );
    assert.equal(detail.originMeetingId, am.id);
    await call(
      `/analysis/${analysis.id}/confirm`,
      'POST',
      { decisions: [], actionItems: [] },
      [409],
    );
    assert.equal(
      ((await call(`/project/${ap.id}/action-items`)) as unknown[]).length,
      1,
    );
    DashboardSchema.parse(await call(`/project/${ap.id}/dashboard`));
    await call(`/meeting/${am.id}`, 'DELETE', undefined, [409]);
  }
  await call('/auth/logout', 'POST');
  assert.equal(
    z.object({ authenticated: z.boolean() }).parse(await call('/auth/session'))
      .authenticated,
    false,
  );
  console.log(
    JSON.stringify({ result: 'completed', checks: report.length, report }),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Live integration failed',
  );
  console.log(JSON.stringify({ completedChecks: report }));
  process.exitCode = 1;
}
