'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Plus, ArrowLeft, Sparkles, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  backend,
  type Analysis,
  type ConfirmInput,
  type Meeting,
  type MeetingInput,
} from '@/lib/swagger-api';
import { Btn, Card, Field, ConfirmDialog, EmptyState } from './ui';
import {
  useApiProject,
  useApiAction,
  SectionTitle,
  QueryView,
  TextArea,
  AssigneeField,
  PriorityField,
} from './api-app';

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="api-checkbox">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      {label}
    </label>
  );
}
export function ApiMeetings() {
  const { project } = useApiProject();
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['server', project.id, 'meetings'],
    queryFn: () => backend.meetings(project.id),
  });
  return (
    <>
      <SectionTitle title="회의">
        <Link to="new">
          <Btn>
            <Plus size={16} />새 회의
          </Btn>
        </Link>
      </SectionTitle>
      <Field
        label="회의 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <QueryView query={q}>
        {(meetings) =>
          meetings.length ? (
            <Card>
              {meetings
                .filter((m) =>
                  m.title.toLowerCase().includes(search.toLowerCase()),
                )
                .map((m) => (
                  <Link className="api-list-row" to={String(m.id)} key={m.id}>
                    <span>
                      <strong>{m.title}</strong>
                      <small>
                        {m.scheduledAt.replace('T', ' ').slice(0, 16)}
                      </small>
                    </span>
                    <span className="pill">
                      {m.status === 'CONFIRMED' ? '확정됨' : '작성 중'}
                    </span>
                  </Link>
                ))}
            </Card>
          ) : (
            <EmptyState
              title="첫 회의를 기록해보세요"
              description="회의 내용을 분석해 결정 사항과 후속 업무를 만들어요."
            />
          )
        }
      </QueryView>
    </>
  );
}
export function ApiMeetingPage() {
  const { meetingId } = useParams();
  const id = Number(meetingId);
  const location = useLocation();
  const q = useQuery({
    queryKey: ['server', 'meeting', id],
    queryFn: () => backend.meeting(id),
    enabled: Number.isSafeInteger(id) && id > 0,
  });
  if (!meetingId) return <MeetingEditor />;
  if (!Number.isSafeInteger(id) || id <= 0)
    return <EmptyState title="올바른 회의 주소가 아니에요" />;
  return (
    <QueryView query={q}>
      {(meeting) =>
        location.pathname.endsWith('/edit') ? (
          <MeetingEditor key={meeting.id} initial={meeting} />
        ) : (
          <MeetingDetail meeting={meeting} />
        )
      }
    </QueryView>
  );
}
function MeetingEditor({ initial }: { initial?: Meeting }) {
  const { project, members } = useApiProject();
  const nav = useNavigate();
  const a = useApiAction();
  const [input, setInput] = useState<MeetingInput>({
    title: initial?.title || '',
    scheduledAt: initial?.scheduledAt?.slice(0, 16) || '',
    content: initial?.content || '',
    participantIds: initial?.participants.map((p) => p.userId) || [],
    carryOverActionItemIds: [],
  });
  const [fileError, setFileError] = useState('');
  const tasks = useQuery({
    queryKey: ['server', project.id, 'tasks'],
    queryFn: () => backend.tasks(project.id),
    enabled: !initial,
  });
  const field = <K extends keyof MeetingInput>(
    key: K,
    value: MeetingInput[K],
  ) => setInput((v) => ({ ...v, [key]: value }));
  return (
    <>
      <Link to={`/p/${project.id}/meetings`} className="api-back">
        <ArrowLeft size={16} />
        회의 목록
      </Link>
      <SectionTitle title={initial ? '회의 수정' : '새 회의'} />
      <Card>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const payload = {
              ...input,
              title: input.title.trim(),
              scheduledAt:
                input.scheduledAt.length === 16
                  ? `${input.scheduledAt}:00`
                  : input.scheduledAt,
            };
            const result = await a.run(
              () =>
                initial
                  ? backend.updateMeeting(initial.id, {
                      title: payload.title,
                      content: payload.content,
                      scheduledAt: payload.scheduledAt,
                      ...(JSON.stringify(
                        initial.participants
                          .map((p) => p.userId)
                          .sort((a, b) => a - b),
                      ) ===
                      JSON.stringify(
                        [...payload.participantIds].sort((a, b) => a - b),
                      )
                        ? {}
                        : { participantIds: payload.participantIds }),
                    })
                  : backend.createMeeting(project.id, payload),
              '회의를 저장했어요.',
            );
            if (result)
              void nav(`/p/${project.id}/meetings/${result.value.id}`);
          }}
        >
          <Field
            required
            label="회의 제목"
            maxLength={200}
            value={input.title}
            onChange={(e) => field('title', e.target.value)}
          />
          <Field
            required
            label="회의 일시 (팀 기준 시간)"
            type="datetime-local"
            value={input.scheduledAt}
            onChange={(e) => field('scheduledAt', e.target.value)}
          />
          <fieldset>
            <legend>참여자</legend>
            <div className="api-check-grid">
              {members.map((m) => (
                <Check
                  key={m.userId}
                  label={`${m.name} (${m.email})`}
                  checked={input.participantIds.includes(m.userId)}
                  onChange={(checked) =>
                    field(
                      'participantIds',
                      checked
                        ? [...input.participantIds, m.userId]
                        : input.participantIds.filter((id) => id !== m.userId),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          {!initial && (
            <fieldset>
              <legend>이전 미완료 업무 연결</legend>
              <QueryView query={tasks}>
                {(list) => (
                  <div className="api-check-grid">
                    {list
                      .filter((t) => t.status !== 'DONE')
                      .map((t) => (
                        <Check
                          key={t.id}
                          label={t.title}
                          checked={
                            input.carryOverActionItemIds?.includes(t.id) ||
                            false
                          }
                          onChange={(checked) =>
                            field(
                              'carryOverActionItemIds',
                              checked
                                ? [
                                    ...(input.carryOverActionItemIds || []),
                                    t.id,
                                  ]
                                : input.carryOverActionItemIds?.filter(
                                    (id) => id !== t.id,
                                  ),
                            )
                          }
                        />
                      ))}
                    {!list.some((t) => t.status !== 'DONE') && (
                      <p className="muted">연결할 미완료 업무가 없어요.</p>
                    )}
                  </div>
                )}
              </QueryView>
            </fieldset>
          )}
          <TextArea
            label="회의록"
            value={input.content}
            onChange={(v) => field('content', v)}
          />
          <Field
            label="텍스트 파일 불러오기 (.txt, .md / 최대 100KB)"
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileError('');
              if (!/\.(txt|md)$/i.test(file.name) || file.size > 100000) {
                setFileError('100KB 이하의 txt 또는 md 파일을 선택해주세요.');
                return;
              }
              try {
                field('content', await file.text());
              } catch {
                setFileError('파일을 읽지 못했어요.');
              }
            }}
          />
          {fileError && (
            <p role="alert" className="api-error">
              {fileError}
            </p>
          )}
          {a.feedback}
          <Btn type="submit" busy={a.busy}>
            회의 저장
          </Btn>
        </form>
      </Card>
    </>
  );
}
function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const { project } = useApiProject();
  const a = useApiAction();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [remove, setRemove] = useState(false);
  const analysisId = Number(params.get('analysis'));
  const q = useQuery({
    queryKey: ['server', 'analysis', analysisId],
    queryFn: () => backend.analysis(analysisId),
    enabled: Number.isSafeInteger(analysisId) && analysisId > 0,
    refetchInterval: (query) =>
      query.state.data?.status === 'PROCESSING' ? 2500 : false,
    retry: false,
  });
  async function analyze() {
    const result = await a.run(
      () => backend.analyze(meeting.id),
      '분석 상태를 확인했어요.',
    );
    if (result) setParams({ analysis: String(result.value.id) });
  }
  return (
    <>
      <Link className="api-back" to={`/p/${project.id}/meetings`}>
        <ArrowLeft size={16} />
        회의 목록
      </Link>
      <SectionTitle title={meeting.title}>
        <Link to="edit">
          <Btn secondary>회의 수정</Btn>
        </Link>
        <Btn secondary danger onClick={() => setRemove(true)}>
          삭제
        </Btn>
      </SectionTitle>
      <Card>
        <div className="api-list-row">
          <span>{meeting.scheduledAt.replace('T', ' ').slice(0, 16)}</span>
          <span className="pill">
            {meeting.status === 'CONFIRMED' ? '확정됨' : '작성 중'}
          </span>
        </div>
        <p>
          참여자:{' '}
          {meeting.participants.map((p) => p.name).join(', ') || '미지정'}
        </p>
        <h2>회의록</h2>
        <p className="api-prewrap">
          {meeting.content || '회의록을 작성해주세요.'}
        </p>
      </Card>
      {!!meeting.carryOverActionItems.length && (
        <Card>
          <h2>이전 미완료 업무</h2>
          {meeting.carryOverActionItems.map((t) => (
            <Link
              className="api-list-row"
              key={t.actionItemId}
              to={`../tasks?task=${t.actionItemId}`}
            >
              <span>{t.title}</span>
              <span>{t.status === 'DONE' ? '완료' : '미완료'}</span>
            </Link>
          ))}
        </Card>
      )}
      {!!meeting.decisions.length && (
        <Card>
          <h2>확정된 결정 사항</h2>
          <ul>
            {meeting.decisions.map((d) => (
              <li key={d.id}>{d.content}</li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <div className="api-section-title">
          <h2>AI 분석 · 후속 업무</h2>
          <Btn
            busy={a.busy}
            disabled={
              !meeting.content.trim() || q.data?.status === 'PROCESSING'
            }
            onClick={() => void analyze()}
          >
            <Sparkles size={16} />
            {analysisId > 0 ? '분석 다시 확인' : '분석 시작·기존 결과 열기'}
          </Btn>
        </div>
        {a.feedback}
        {!analysisId && (
          <p className="muted">
            결정 사항과 후속 업무를 추출해요. 기존 분석이 있으면 서버에서 해당
            결과를 반환합니다.
          </p>
        )}
        {analysisId > 0 && (
          <QueryView query={q}>
            {(analysis) =>
              analysis.meetingId !== meeting.id ? (
                <p className="api-error">이 회의의 분석 결과가 아니에요.</p>
              ) : analysis.status === 'PROCESSING' ? (
                <div>
                  <output>회의를 분석하고 있어요. 잠시 기다려주세요.</output>
                  <Btn secondary onClick={() => void q.refetch()}>
                    상태 새로고침
                  </Btn>
                </div>
              ) : analysis.status === 'FAILED' ? (
                <div role="alert">
                  <p className="api-error">
                    {analysis.errorMessage || '분석에 실패했어요.'}
                  </p>
                  <Btn busy={a.busy} onClick={() => void analyze()}>
                    분석 재시도
                  </Btn>
                </div>
              ) : analysis.status === 'CONFIRMED' ? (
                <div>
                  <p className="api-success">분석 결과가 확정되었어요.</p>
                  <Link to={`/p/${project.id}/tasks`}>
                    <Btn>후속 업무 보기</Btn>
                  </Link>
                </div>
              ) : (
                <AnalysisReview
                  key={analysis.id}
                  analysis={analysis}
                  onCheck={() => q.refetch()}
                />
              )
            }
          </QueryView>
        )}
      </Card>
      <ConfirmDialog
        open={remove}
        title="회의를 삭제할까요?"
        description="분석 또는 결정 이력이 있는 회의는 서버에서 삭제를 제한할 수 있어요."
        busy={a.busy}
        onClose={() => setRemove(false)}
        onConfirm={async () => {
          if (
            await a.run(
              () => backend.deleteMeeting(meeting.id),
              '회의를 삭제했어요.',
            )
          )
            void nav(`/p/${project.id}/meetings`);
        }}
      >
        {a.feedback}
      </ConfirmDialog>
    </>
  );
}
function AnalysisReview({
  analysis,
  onCheck,
}: {
  analysis: Analysis;
  onCheck: () => Promise<unknown>;
}) {
  const { members } = useApiProject();
  const a = useApiAction();
  const [draft, setDraft] = useState<ConfirmInput>(() => ({
    decisions:
      analysis.draft?.decisions?.map((d) => ({ content: d.content })) || [],
    actionItems:
      analysis.draft?.actionItems?.map((t) => {
        const matches = members.filter((m) => m.name === t.assigneeName);
        return {
          title: t.title,
          description: t.description,
          assigneeUserId: matches.length === 1 ? matches[0].userId : null,
          dueDate: t.dueDate,
          priority: t.priority || 'MEDIUM',
          priorityReason: t.priorityReason,
        };
      }) || [],
  }));
  const [confirmOpen, setConfirmOpen] = useState(false);
  function updateTask(
    index: number,
    patch: Partial<ConfirmInput['actionItems'][number]>,
  ) {
    setDraft((d) => ({
      ...d,
      actionItems: d.actionItems.map((t, i) =>
        i === index ? { ...t, ...patch } : t,
      ),
    }));
  }
  const invalid =
    draft.decisions.some((d) => !d.content.trim()) ||
    draft.actionItems.some((t) => !t.title.trim());
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) setConfirmOpen(true);
      }}
    >
      <p className="muted">
        내용을 확인하고 담당자를 선택해주세요. 확정 전 수정 내용은 이 화면에서만
        유지돼요.
      </p>
      <h3>결정 사항</h3>
      {draft.decisions.map((d, i) => (
        <div className="api-inline-form" key={i}>
          <Field
            required
            label={`결정 사항 ${i + 1}`}
            value={d.content}
            onChange={(e) =>
              setDraft((v) => ({
                ...v,
                decisions: v.decisions.map((x, j) =>
                  i === j ? { content: e.target.value } : x,
                ),
              }))
            }
          />
          <Btn
            type="button"
            secondary
            aria-label={`결정 사항 ${i + 1} 삭제`}
            onClick={() =>
              setDraft((v) => ({
                ...v,
                decisions: v.decisions.filter((_, j) => i !== j),
              }))
            }
          >
            <Trash2 size={16} />
          </Btn>
        </div>
      ))}
      <Btn
        type="button"
        secondary
        onClick={() =>
          setDraft((v) => ({
            ...v,
            decisions: [...v.decisions, { content: '' }],
          }))
        }
      >
        결정 사항 추가
      </Btn>
      <h3>후속 업무</h3>
      {draft.actionItems.map((t, i) => (
        <section className="api-draft-task" key={i}>
          <div className="api-section-title">
            <h3>No.{i + 1}</h3>
            <Btn
              type="button"
              secondary
              onClick={() =>
                setDraft((v) => ({
                  ...v,
                  actionItems: v.actionItems.filter((_, j) => i !== j),
                }))
              }
              aria-label={`업무 ${i + 1} 삭제`}
            >
              <Trash2 size={16} />
            </Btn>
          </div>
          <Field
            required
            label="업무명"
            maxLength={255}
            value={t.title}
            onChange={(e) => updateTask(i, { title: e.target.value })}
          />
          <TextArea
            label="설명"
            value={t.description}
            onChange={(description) => updateTask(i, { description })}
          />
          <div className="api-two-columns">
            <AssigneeField
              value={t.assigneeUserId}
              onChange={(assigneeUserId) => updateTask(i, { assigneeUserId })}
            />
            <Field
              label="마감일"
              type="date"
              value={t.dueDate || ''}
              onChange={(e) =>
                updateTask(i, { dueDate: e.target.value || null })
              }
            />
            <PriorityField
              value={t.priority}
              onChange={(priority) => updateTask(i, { priority })}
            />
          </div>
          <TextArea
            label="우선순위 추천 이유"
            value={t.priorityReason}
            onChange={(priorityReason) => updateTask(i, { priorityReason })}
          />
        </section>
      ))}
      <Btn
        type="button"
        secondary
        onClick={() =>
          setDraft((v) => ({
            ...v,
            actionItems: [
              ...v.actionItems,
              {
                title: '',
                description: '',
                assigneeUserId: null,
                dueDate: null,
                priority: 'MEDIUM',
                priorityReason: '',
              },
            ],
          }))
        }
      >
        업무 추가
      </Btn>
      {a.feedback}
      <Btn type="submit" busy={a.busy} disabled={invalid}>
        확정하고 업무 생성 ({draft.actionItems.length}개)
      </Btn>
      <ConfirmDialog
        open={confirmOpen}
        title="분석 결과를 확정할까요?"
        description={`${draft.decisions.length}개 결정 사항과 ${draft.actionItems.length}개 후속 업무를 저장합니다.`}
        confirmLabel="확정"
        busy={a.busy}
        onClose={() => {
          if (!a.busy) setConfirmOpen(false);
        }}
        onConfirm={async () => {
          const result = await a.run(async () => {
            const current = await backend.analysis(analysis.id);
            if (current.status === 'CONFIRMED') return current;
            if (current.status !== 'GENERATED')
              throw new Error(
                '현재 분석은 확정할 수 없어요. 상태를 다시 확인해주세요.',
              );
            return backend.confirm(analysis.id, {
              decisions: draft.decisions.map((d) => ({
                content: d.content.trim(),
              })),
              actionItems: draft.actionItems.map((t) => ({
                ...t,
                title: t.title.trim(),
              })),
            });
          }, '분석 결과를 확정했어요.');
          if (result) setConfirmOpen(false);
          await onCheck();
        }}
      >
        {a.feedback}
      </ConfirmDialog>
    </form>
  );
}
