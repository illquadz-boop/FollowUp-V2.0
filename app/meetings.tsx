'use client';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Calendar,
  FileText,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Upload,
  Save,
  Link2,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { isDemo } from '@/lib/api';
import {
  AppError,
  MeetingInputSchema,
  DraftSchema,
  localDate,
  statusLabels,
  type Meeting,
  type MeetingInput,
  type Draft,
  type DraftTask,
  type Priority,
} from '@/lib/contracts';
import { useProject } from './data';
import {
  Btn,
  Header,
  Back,
  Card,
  Field,
  Avatar,
  DueBadge,
  StatusBadge,
  SelectField,
  EmptyState,
  ConfirmDialog,
  ErrorState,
  useAction,
} from './ui';
import { TaskModal } from './tasks';

function MeetingBadge({ meeting }: { meeting: Meeting }) {
  return (
    <span className={`meeting-badge ${meeting.status}`}>
      {meeting.status === 'CONFIRMED' ? (
        <Check size={12} />
      ) : meeting.status === 'REVIEW' ? (
        <Sparkles size={12} />
      ) : (
        <Pencil size={12} />
      )}{' '}
      {meeting.status === 'CONFIRMED'
        ? '확정됨'
        : meeting.status === 'REVIEW'
          ? '검토 대기'
          : '임시 저장'}
    </span>
  );
}
export function MeetingList() {
  const { project, meetings, tasks, users } = useProject();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const list = meetings.filter(
    (m) =>
      m.title.toLowerCase().includes(q.toLowerCase()) &&
      (status === 'all' || m.status === status),
  );
  return (
    <main className="page-container medium page-enter">
      <Header
        title="회의"
        subtitle="기록된 대화가 다음 행동의 시작이 됩니다."
        action={
          <Btn onClick={() => void nav(`/p/${project.id}/meetings/new`)}>
            <Plus size={16} />새 회의
          </Btn>
        }
      />
      <div className="meeting-toolbar">
        <Input
          className="fu-input"
          placeholder="회의 제목 검색"
          aria-label="회의 제목 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <SelectField
          label="회의 상태"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: '모든 회의' },
            { value: 'DRAFT', label: '임시 저장' },
            { value: 'REVIEW', label: '검토 대기' },
            { value: 'CONFIRMED', label: '확정됨' },
          ]}
        />
      </div>
      <div className="list-stack">
        {list.map((m) => (
          <Link
            to={`/p/${project.id}/meetings/${m.id}`}
            className="meeting-row"
            key={m.id}
          >
            <div className="meeting-date">
              <span>{new Date(m.date + 'T12:00:00').getMonth() + 1}월</span>
              <b>{new Date(m.date + 'T12:00:00').getDate()}</b>
            </div>
            <div className="meeting-row-body">
              <div>
                <h3>{m.title}</h3>
                <MeetingBadge meeting={m} />
              </div>
              <p>
                {m.date}
                <span>·</span>
                {m.participantIds
                  .map(
                    (id) =>
                      users.find((u) => u.id === id)?.name || '이전 구성원',
                  )
                  .join(', ')}
              </p>
            </div>
            <div className="meeting-row-count">
              <CheckSquareIcon />
              {tasks.filter((t) => t.meetingId === m.id).length}건
              <ChevronRight size={17} />
            </div>
          </Link>
        ))}
      </div>
      {!list.length && (
        <EmptyState
          title={
            meetings.length
              ? '조건에 맞는 회의가 없어요'
              : '아직 기록된 회의가 없어요'
          }
          description={
            meetings.length
              ? '검색어나 상태를 변경해보세요.'
              : '첫 회의를 만들어 팀의 대화를 남겨보세요.'
          }
          action={
            !meetings.length && (
              <Btn onClick={() => void nav(`/p/${project.id}/meetings/new`)}>
                <Plus size={15} />첫 회의 만들기
              </Btn>
            )
          }
        />
      )}
    </main>
  );
}
function CheckSquareIcon() {
  return <FileText size={14} />;
}
export function MeetingDetail() {
  const { meetingId } = useParams();
  const { project, meetings, tasks, users, api } = useProject();
  const meeting = meetings.find((m) => m.id === meetingId);
  const nav = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const a = useAction();
  if (!meeting)
    return (
      <main className="page-container">
        <Back onClick={() => void nav(`/p/${project.id}/meetings`)}>
          회의 목록
        </Back>
        <EmptyState title="회의를 찾을 수 없어요" />
      </main>
    );
  const related = tasks.filter((t) => t.meetingId === meeting.id);
  const carried = tasks.filter((t) => meeting.carryoverTaskIds.includes(t.id));
  return (
    <main className="page-container meeting-detail page-enter">
      <Back onClick={() => void nav(`/p/${project.id}/meetings`)}>
        회의 목록
      </Back>
      <Header
        title={meeting.title}
        action={
          <>
            <Btn
              secondary
              onClick={() =>
                void nav(`/p/${project.id}/meetings/${meeting.id}/edit`)
              }
            >
              <Pencil size={15} />
              {meeting.status === 'REVIEW' ? '초안 검토' : '수정'}
            </Btn>
            <button
              className="icon-button"
              aria-label="회의 삭제"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={17} />
            </button>
          </>
        }
      />
      <div className="meeting-meta">
        <span>
          <Calendar size={15} />
          {meeting.date}
        </span>
        <MeetingBadge meeting={meeting} />
        <div className="meeting-people">
          {meeting.participantIds.map((id) => {
            const u = users.find((u) => u.id === id);
            return (
              <span key={id}>
                <Avatar user={u} size="small" />
                {u?.name || '이전 구성원'}
              </span>
            );
          })}
        </div>
      </div>
      {meeting.status !== 'CONFIRMED' && (
        <div className="continue-meeting">
          <Sparkles size={19} />
          <div>
            <b>
              {meeting.status === 'REVIEW'
                ? '아직 검토 중인 회의예요'
                : '회의록을 다음 행동으로 바꿔보세요'}
            </b>
            <p>
              {meeting.status === 'REVIEW'
                ? '검토 결과를 확정하면 후속 업무가 생성돼요.'
                : '회의록을 작성하고 분석을 시작할 수 있어요.'}
            </p>
          </div>
          <Btn
            onClick={() =>
              void nav(`/p/${project.id}/meetings/${meeting.id}/edit`)
            }
          >
            {meeting.status === 'REVIEW' ? '검토 계속하기' : '회의록 작성'}
            <ArrowRight size={15} />
          </Btn>
        </div>
      )}
      <div className="meeting-sections">
        <Card soft>
          <div className="card-title">
            <h2>
              <Check size={17} />
              결정 사항
            </h2>
            {meeting.status !== 'CONFIRMED' && <span>초안</span>}
          </div>
          {meeting.draft?.decisions.length ? (
            <ul className="decisions-list">
              {meeting.draft.decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">기록된 결정 사항이 없어요.</p>
          )}
        </Card>
        <Card soft>
          <div className="card-title">
            <h2>
              <Calendar size={17} />
              주요 일정
            </h2>
          </div>
          {meeting.draft?.schedule.length ? (
            meeting.draft.schedule.map((s) => (
              <div className="schedule-row" key={s.id}>
                <span>{s.date || '일정 미지정'}</span>
                <b>{s.title}</b>
              </div>
            ))
          ) : (
            <p className="empty-copy">기록된 주요 일정이 없어요.</p>
          )}
        </Card>
        <Card>
          <div className="card-title">
            <h2>
              <FileText size={17} />
              원본 회의록
            </h2>
            <span>{meeting.notes.length.toLocaleString()}자</span>
          </div>
          {meeting.notes ? (
            <p className="notes-content">{meeting.notes}</p>
          ) : (
            <p className="empty-copy">아직 회의록이 작성되지 않았어요.</p>
          )}
        </Card>
        <Card>
          <div className="card-title">
            <h2>
              생성된 후속 업무 <span className="pill">{related.length}</span>
            </h2>
          </div>
          {related.length ? (
            <div className="detail-task-list">
              {related.map((t) => (
                <button key={t.id} onClick={() => setOpenTask(t.id)}>
                  <CheckSquareIcon />
                  <div>
                    <b>{t.title}</b>
                    <span>
                      {users.find((u) => u.id === t.assigneeId)?.name ||
                        '미지정'}{' '}
                      · {t.dueDate || '기한 미지정'}
                    </span>
                  </div>
                  <StatusBadge status={t.status} />
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="생성된 후속 업무가 없어요"
              description={
                meeting.status === 'CONFIRMED'
                  ? '결정 사항과 일정만 확정했거나 연결된 업무가 삭제됐어요.'
                  : '분석 결과를 검토하고 확정하면 여기에 표시돼요.'
              }
            />
          )}
        </Card>
        <Card>
          <div className="card-title">
            <h2>
              <Link2 size={17} />
              이전 회의에서 연결된 업무
            </h2>
            <span>{carried.length}건</span>
          </div>
          <p className="field-help">
            이 회의를 만들 때 연결한 업무의 현재 상태예요.
          </p>
          {carried.length ? (
            <div className="detail-task-list">
              {carried.map((t) => (
                <button key={t.id} onClick={() => setOpenTask(t.id)}>
                  <div>
                    <b>{t.title}</b>
                    <span>
                      {users.find((u) => u.id === t.assigneeId)?.name ||
                        '미지정'}
                    </span>
                  </div>
                  <StatusBadge status={t.status} />
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-copy">이전 회의의 미완료 업무가 없습니다.</p>
          )}
        </Card>
      </div>
      <div className="next-meeting">
        <div>
          <h3>다음 대화도 이어가세요.</h3>
          <p>미완료 업무는 다음 회의에 자동으로 연결돼요.</p>
        </div>
        <Btn onClick={() => void nav(`/p/${project.id}/meetings/new`)}>
          <Plus size={16} />
          다음 회의 만들기
        </Btn>
      </div>
      <ConfirmDialog
        title="회의를 삭제할까요?"
        description="원본 회의록과 분석 결과가 삭제됩니다. 이미 생성된 후속 업무는 남고 회의 연결만 해제돼요."
        open={deleting}
        onClose={() => setDeleting(false)}
        busy={a.busy}
        onConfirm={async () => {
          const ok = await a.run(async () => {
            await api.deleteMeeting(meeting.id);
            return true;
          }, '회의가 삭제됐어요.');
          if (ok) void nav(`/p/${project.id}/meetings`);
        }}
      />
      {openTask && tasks.find((t) => t.id === openTask) && (
        <TaskModal
          task={tasks.find((t) => t.id === openTask)}
          onClose={() => setOpenTask(null)}
        />
      )}
    </main>
  );
}

export function MeetingEditorRoute() {
  const { meetingId } = useParams();
  return <MeetingEditor key={meetingId || 'new'} meetingId={meetingId} />;
}
function MeetingEditor({ meetingId }: { meetingId?: string }) {
  const { project, meetings, tasks, members, user, api } = useProject();
  const nav = useNavigate();
  const original = meetings.find((m) => m.id === meetingId);
  const cacheKey = `followup.editor.${isDemo ? 'demo' : 'api'}.${user.id}.${project.id}.${meetingId || 'new'}`;
  const [initial] = useState<{
    form: MeetingInput;
    draft: Draft | null;
    savedId: string | null;
  }>(() => {
    let cached = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    } catch {}
    const usable =
      cached &&
      cached.projectId === project.id &&
      (!meetingId || cached.updatedAt === original?.updatedAt) &&
      cached.form &&
      typeof cached.form.title === 'string' &&
      Array.isArray(cached.form.participantIds);
    return usable
      ? {
          form: cached.form,
          draft: cached.draft || null,
          savedId: cached.savedId || null,
        }
      : {
          form: {
            title: original?.title || '',
            date: original?.date || localDate(),
            participantIds:
              original?.participantIds.filter((id) =>
                members.some((m) => m.id === id),
              ) || members.map((m) => m.id),
            notes: original?.notes || '',
          },
          draft: original?.draft || null,
          savedId: original?.id || null,
        };
  });
  const [form, setForm] = useState<MeetingInput>(initial.form);
  const [draft, setDraft] = useState<Draft | null>(initial.draft);
  const savedId = useRef<string | null>(initial.savedId);
  const [displaySavedId, setDisplaySavedId] = useState(initial.savedId);
  const baseline = useRef<string | undefined>(original?.updatedAt);
  const [step, setStep] = useState<'write' | 'review' | 'analyzing'>(
    draft && original?.status !== 'CONFIRMED' ? 'review' : 'write',
  );
  const [restored] = useState(() => {
    try {
      return !!sessionStorage.getItem(cacheKey);
    } catch {
      return false;
    }
  });
  const [storageError, setStorageError] = useState(false);
  const a = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmed = original?.status === 'CONFIRMED';
  const update = <K extends keyof MeetingInput>(
    key: K,
    value: MeetingInput[K],
  ) => setForm((p) => ({ ...p, [key]: value }));
  useEffect(() => {
    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          projectId: project.id,
          updatedAt: baseline.current,
          form,
          draft,
          savedId: savedId.current,
        }),
      );
    } catch {
      // Storage is an external system; surface its write failure to the user.
      // oxlint-disable-next-line react/react-compiler
      setStorageError(true);
    }
  }, [cacheKey, form, draft, project.id]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (form.title || form.notes) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [form.title, form.notes]);
  if (meetingId && !original)
    return <EmptyState title="회의를 찾을 수 없어요" />;
  const priorIds = new Set(
    meetings
      .filter((m) => m.id !== displaySavedId && m.date <= form.date)
      .map((m) => m.id),
  );
  const unfinished = tasks.filter(
    (t) => t.status !== 'DONE' && t.meetingId && priorIds.has(t.meetingId),
  );
  async function ensureSaved() {
    const value = MeetingInputSchema.parse(form);
    const m = savedId.current
      ? await api.updateMeeting(savedId.current, value)
      : await api.createMeeting(project.id, value);
    savedId.current = m.id;
    setDisplaySavedId(m.id);
    baseline.current = m.updatedAt;
    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          projectId: project.id,
          updatedAt: m.updatedAt,
          form: value,
          draft,
          savedId: m.id,
        }),
      );
    } catch {
      setStorageError(true);
    }
    return m;
  }
  async function analyze() {
    setStep('analyzing');
    const m = await a.run(async () => {
      if (!form.notes.trim())
        throw new AppError('분석할 회의록을 입력해주세요.');
      const saved = await ensureSaved();
      return api.analyzeMeeting(saved.id);
    });
    if (m) {
      baseline.current = m.updatedAt;
      setDraft(m.draft);
      setStep('review');
    } else setStep(draft ? 'review' : 'write');
  }
  async function saveOnly() {
    const m = await a.run(
      async () => {
        let saved = await ensureSaved();
        if (step === 'review' && draft)
          saved = await api.saveDraft(saved.id, DraftSchema.parse(draft));
        return saved;
      },
      confirmed ? '회의가 수정됐어요.' : '회의가 임시 저장됐어요.',
    );
    if (m) {
      sessionStorage.removeItem(cacheKey);
      void nav(`/p/${project.id}/meetings/${m.id}`);
    }
  }
  async function confirm() {
    if (!draft) return;
    const m = await a.run(async () => {
      const parsed = DraftSchema.parse(draft);
      const saved = await ensureSaved();
      return api.confirmMeeting(saved.id, parsed);
    }, '검토 결과를 확정했어요. 후속 업무가 반영됐습니다.');
    if (m) {
      sessionStorage.removeItem(cacheKey);
      void nav(`/p/${project.id}/meetings/${m.id}`);
    }
  }
  function updateTask(id: string, patch: Partial<DraftTask>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          }
        : d,
    );
  }
  async function loadFile(file: File | undefined) {
    if (!file) return;
    await a.run(async () => {
      if (!/\.(txt|md)$/i.test(file.name))
        throw new AppError('TXT 또는 Markdown 파일을 선택해주세요.');
      if (file.size > 1024 * 1024)
        throw new AppError('파일은 1MB 이하로 선택해주세요.');
      const text = await file.text();
      if (text.includes('\0'))
        throw new AppError(
          '텍스트 파일을 읽을 수 없어요. UTF-8 형식으로 저장해주세요.',
        );
      const notes = [form.notes, text].filter(Boolean).join('\n\n');
      if (notes.length > 100000)
        throw new AppError('회의록은 10만 자까지 입력할 수 있어요.');
      update('notes', notes);
      return true;
    }, '회의록 파일을 불러왔어요.');
    if (fileRef.current) fileRef.current.value = '';
  }
  const tasksMissing =
    draft?.tasks.filter((t) => !t.title.trim() || !t.assigneeId || !t.dueDate)
      .length || 0;
  return (
    <main className="page-container editor-page page-enter">
      <Back onClick={() => void nav(`/p/${project.id}/meetings`)}>
        회의 목록
      </Back>
      <Header
        title={
          confirmed
            ? '회의 수정'
            : step === 'review'
              ? 'AI 분석 결과'
              : original
                ? '회의록 작성'
                : '새 회의'
        }
        subtitle={
          step === 'review'
            ? '필요한 부분을 다듬고, 팀의 다음 행동으로 확정하세요.'
            : '오늘의 대화가 다음 행동으로 이어지도록.'
        }
      />
      {!confirmed && (
        <ol className="editor-steps">
          <li className={step === 'write' ? 'active' : 'complete'}>
            <span>{step === 'write' ? '1' : <Check size={12} />}</span>회의록
            작성
          </li>
          <ChevronRight size={13} />
          <li className={step === 'analyzing' ? 'active' : ''}>
            <span>2</span>AI 분석
          </li>
          <ChevronRight size={13} />
          <li className={step === 'review' ? 'active' : ''}>
            <span>3</span>검토·확정
          </li>
        </ol>
      )}
      {storageError && (
        <ErrorState
          error={
            new AppError(
              '임시 보관이 차단됐어요. 화면을 떠나기 전에 저장해주세요.',
            )
          }
        />
      )}{' '}
      {a.error ? (
        <ErrorState error={a.error} retry={confirmed ? undefined : analyze} />
      ) : null}
      {step !== 'review' ? (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void (confirmed ? saveOnly() : analyze());
          }}
        >
          <fieldset disabled={a.busy} className="form-stack">
            <div className="form-grid title-date">
              <Field
                label="회의 제목"
                required
                maxLength={120}
                placeholder="예: 배포 전 QA 회의"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
              />
              <Field
                label="회의 날짜"
                type="date"
                required
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
              />
            </div>
            <div className="field">
              <span>
                참여자 <small>{form.participantIds.length}명 선택</small>
              </span>
              <div className="participant-options">
                {members.map((m) => (
                  <label
                    key={m.id}
                    className={`participant-chip ${form.participantIds.includes(m.id) ? 'selected' : ''}`}
                  >
                    <Checkbox
                      checked={form.participantIds.includes(m.id)}
                      onCheckedChange={(checked) =>
                        update(
                          'participantIds',
                          checked
                            ? [...form.participantIds, m.id]
                            : form.participantIds.filter((i) => i !== m.id),
                        )
                      }
                    />
                    <Avatar user={m} size="small" />
                    {m.name}
                  </label>
                ))}
              </div>
            </div>
            {!confirmed && (
              <Card soft className="carryover-card">
                <div className="card-title">
                  <h2>
                    <RefreshCw size={16} />
                    이전 회의 미완료 업무{' '}
                    <span className="pill">{unfinished.length}</span>
                  </h2>
                  {unfinished.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          'notes',
                          [
                            form.notes,
                            '[이전 업무 점검 안건]',
                            ...unfinished.map(
                              (t) =>
                                `- ${t.title} / ${members.find((m) => m.id === t.assigneeId)?.name || '담당자 미지정'} / ${statusLabels[t.status]}`,
                            ),
                          ]
                            .filter(Boolean)
                            .join('\n'),
                        )
                      }
                    >
                      안건에 추가 <Plus size={13} />
                    </button>
                  )}
                </div>
                {unfinished.length ? (
                  unfinished.slice(0, 8).map((t) => (
                    <div className="carryover-row" key={t.id}>
                      <i className={`status-dot ${t.status}`} />
                      <b>{t.title}</b>
                      <span>
                        {members.find((m) => m.id === t.assigneeId)?.name ||
                          '미지정'}
                      </span>
                      <DueBadge
                        date={t.dueDate}
                        status={t.status}
                        threshold={project.dueSoonDays}
                      />
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">
                    이전 회의의 미완료 업무가 없습니다.
                  </p>
                )}
                {unfinished.length > 8 && (
                  <p className="field-help">
                    외 {unfinished.length - 8}건도 함께 연결돼요.
                  </p>
                )}
              </Card>
            )}
            <div className="field">
              <div className="notes-label">
                <label htmlFor="meeting-notes">회의록</label>
                <div>
                  <button
                    type="button"
                    className="quiet-link"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={14} />
                    TXT·MD 불러오기
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    className="sr-only"
                    aria-label="회의록 파일 업로드"
                    onChange={(e) => void loadFile(e.target.files?.[0])}
                  />
                </div>
              </div>
              <textarea
                id="meeting-notes"
                className="fu-textarea meeting-notes"
                value={form.notes}
                maxLength={100000}
                onChange={(e) => update('notes', e.target.value)}
                placeholder={
                  '회의 내용을 자유롭게 입력하세요.\n\n예: 반서현은 금요일까지 로그인 오류를 수정하기로 했다.\n장은호는 다음 주 월요일까지 API 연동을 진행한다.\n검색 기능은 이번 버전에서 제외하기로 결정했다.'
                }
              />
              <div className="notes-footer">
                <span>
                  {restored
                    ? '임시 보관한 내용을 복구했어요.'
                    : '작성 중인 내용은 이 브라우저에 임시 보관돼요.'}
                </span>
                <span>{form.notes.length.toLocaleString()} / 100,000</span>
              </div>
            </div>
            {isDemo && !confirmed && (
              <div className="demo-analysis-note">
                <Sparkles size={15} />
                <p>
                  체험 분석은 회의록의 표현을 바탕으로 만든 규칙 기반
                  초안입니다.
                  <br />
                  담당자와 날짜가 정확한지 검토해주세요. 실제 AI는 백엔드 연결
                  후 사용할 수 있어요.
                </p>
              </div>
            )}
            <div className="editor-actions">
              <Btn type="button" secondary onClick={saveOnly} busy={a.busy}>
                <Save size={15} />
                {confirmed ? '변경사항 저장' : '임시 저장'}
              </Btn>
              {!confirmed && (
                <Btn type="submit" busy={a.busy}>
                  <Sparkles size={15} />
                  {step === 'analyzing' ? '분석 중…' : 'AI 분석하기'}
                </Btn>
              )}
            </div>
          </fieldset>
          {step === 'analyzing' && (
            <output className="analyzing-state">
              <div className="analysis-orbit">
                <Sparkles size={27} />
              </div>
              <h3>대화에서 다음 행동을 찾고 있어요.</h3>
              <p>결정 사항, 담당자, 기한을 정리하는 중입니다.</p>
              <div className="analysis-track">
                <i />
              </div>
            </output>
          )}
        </form>
      ) : (
        draft && (
          <div className="form-stack review-content">
            <div className="review-banner">
              <span className="review-spark">
                <Sparkles size={19} />
              </span>
              <div>
                <b>{form.title}</b>
                <p>
                  {draft.source === 'LOCAL_DEMO'
                    ? '체험 분석 초안'
                    : 'AI 분석 초안'}{' '}
                  · 아직 업무로 등록되지 않았어요.
                </p>
              </div>
              <Btn secondary className="small" busy={a.busy} onClick={analyze}>
                <RefreshCw size={14} />
                다시 분석
              </Btn>
            </div>
            <Card soft>
              <div className="card-title">
                <h2>
                  <Check size={16} />
                  결정 사항
                </h2>
                <button
                  onClick={() =>
                    setDraft((d) =>
                      d ? { ...d, decisions: [...d.decisions, ''] } : d,
                    )
                  }
                >
                  <Plus size={14} />
                  추가
                </button>
              </div>
              <div className="draft-lines">
                {draft.decisions.map((d, i) => (
                  <div key={i}>
                    <span className="draft-line-number">{i + 1}</span>
                    <Input
                      className="fu-input"
                      aria-label={`결정 사항 ${i + 1}`}
                      value={d}
                      onChange={(e) =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                decisions: p.decisions.map((s, j) =>
                                  i === j ? e.target.value : s,
                                ),
                              }
                            : p,
                        )
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label={`결정 사항 ${i + 1} 삭제`}
                      onClick={() =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                decisions: p.decisions.filter(
                                  (_, j) => j !== i,
                                ),
                              }
                            : p,
                        )
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                {!draft.decisions.length && (
                  <p className="empty-copy">
                    추출된 결정 사항이 없어요. 필요하면 추가하세요.
                  </p>
                )}
              </div>
            </Card>
            <Card soft>
              <div className="card-title">
                <h2>
                  <Calendar size={16} />
                  주요 일정
                </h2>
                <button
                  onClick={() =>
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            schedule: [
                              ...p.schedule,
                              {
                                id: crypto.randomUUID(),
                                title: '',
                                date: null,
                              },
                            ],
                          }
                        : p,
                    )
                  }
                >
                  <Plus size={14} />
                  추가
                </button>
              </div>
              <div className="draft-lines">
                {draft.schedule.map((s, i) => (
                  <div key={s.id} className="schedule-edit">
                    <Input
                      className="fu-input"
                      aria-label={`주요 일정 ${i + 1}`}
                      placeholder="예: 1차 QA 배포"
                      value={s.title}
                      onChange={(e) =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                schedule: p.schedule.map((x) =>
                                  x.id === s.id
                                    ? { ...x, title: e.target.value }
                                    : x,
                                ),
                              }
                            : p,
                        )
                      }
                    />
                    <Input
                      className="fu-input"
                      type="date"
                      aria-label={`일정 ${i + 1} 날짜`}
                      value={s.date || ''}
                      onChange={(e) =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                schedule: p.schedule.map((x) =>
                                  x.id === s.id
                                    ? { ...x, date: e.target.value || null }
                                    : x,
                                ),
                              }
                            : p,
                        )
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label={`주요 일정 ${i + 1} 삭제`}
                      onClick={() =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                schedule: p.schedule.filter(
                                  (x) => x.id !== s.id,
                                ),
                              }
                            : p,
                        )
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                {!draft.schedule.length && (
                  <p className="empty-copy">추출된 주요 일정이 없어요.</p>
                )}
              </div>
            </Card>
            <div className="draft-task-heading">
              <h2>
                후속 업무 <span>{draft.tasks.length}</span>
              </h2>
              <Btn
                secondary
                className="small"
                onClick={() =>
                  setDraft((p) =>
                    p
                      ? {
                          ...p,
                          tasks: [
                            ...p.tasks,
                            {
                              id: crypto.randomUUID(),
                              title: '',
                              description: '',
                              assigneeId: null,
                              dueDate: null,
                              priority: 'MEDIUM',
                              reason: '직접 추가한 업무예요.',
                            },
                          ],
                        }
                      : p,
                  )
                }
              >
                <Plus size={15} />
                업무 추가
              </Btn>
            </div>
            {draft.tasks.map((t, i) => (
              <Card key={t.id} className="draft-task-card">
                <div className="draft-task-top">
                  <span>
                    FOLLOW UP <b>{String(i + 1).padStart(2, '0')}</b>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`후속 업무 ${i + 1} 삭제`}
                    onClick={() =>
                      setDraft((p) =>
                        p
                          ? {
                              ...p,
                              tasks: p.tasks.filter((x) => x.id !== t.id),
                            }
                          : p,
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <Field
                  label="업무명"
                  value={t.title}
                  maxLength={200}
                  onChange={(e) => updateTask(t.id, { title: e.target.value })}
                  placeholder="해야 할 일을 입력해주세요"
                />
                <div className="draft-task-fields">
                  <SelectField
                    label="담당자"
                    value={t.assigneeId || 'none'}
                    onChange={(v) =>
                      updateTask(t.id, { assigneeId: v === 'none' ? null : v })
                    }
                    options={[
                      { value: 'none', label: '담당자 선택' },
                      ...members.map((m) => ({ value: m.id, label: m.name })),
                    ]}
                  />
                  <Field
                    label="마감일"
                    type="date"
                    value={t.dueDate || ''}
                    onChange={(e) =>
                      updateTask(t.id, { dueDate: e.target.value || null })
                    }
                  />
                  <SelectField
                    label="우선순위"
                    value={t.priority}
                    onChange={(v) =>
                      updateTask(t.id, { priority: v as Priority })
                    }
                    options={['HIGH', 'MEDIUM', 'LOW'].map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </div>
                <div className="reason-box">
                  <span>
                    <Sparkles size={13} />
                    추천 이유
                  </span>
                  <p>{t.reason || '직접 추가한 업무예요.'}</p>
                </div>
              </Card>
            ))}
            {!draft.tasks.length && (
              <EmptyState
                title="추출된 후속 업무가 없어요"
                description="직접 업무를 추가하거나 결정 사항과 일정만 확정할 수 있어요."
              />
            )}
            <div className="review-final">
              <div>
                <Check size={18} />
                <p>
                  확정하면 <b>{draft.tasks.length}개</b>의 후속 업무가
                  만들어져요.
                  <span>
                    {tasksMissing
                      ? `${tasksMissing}개 업무의 제목, 담당자 또는 마감일을 확인해주세요.`
                      : '검토한 내용은 회의 상세에서도 확인할 수 있어요.'}
                  </span>
                </p>
              </div>
              <div className="form-actions">
                <Btn secondary busy={a.busy} onClick={() => setStep('write')}>
                  회의록 수정
                </Btn>
                <Btn secondary busy={a.busy} onClick={saveOnly}>
                  <Save size={15} />
                  초안 저장
                </Btn>
                <Btn
                  busy={a.busy}
                  disabled={
                    tasksMissing > 0 ||
                    (!draft.tasks.length &&
                      !draft.decisions.length &&
                      !draft.schedule.length)
                  }
                  onClick={confirm}
                >
                  <Check size={16} />
                  확정하고 업무 생성
                </Btn>
              </div>
            </div>
          </div>
        )
      )}
    </main>
  );
}
