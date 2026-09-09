'use client';
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Plus,
  Check,
  CheckSquare,
  GripVertical,
  CalendarClock,
  Pencil,
  Trash2,
  FileText,
  Sparkles,
  ArrowUpRight,
  Columns3,
  ListFilter,
  Search,
  X,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  TaskInputSchema,
  daysUntil,
  statusLabels,
  priorityLabels,
  type Task,
  type TaskInput,
  type Status,
  type Priority,
} from '@/lib/contracts';
import { useProject } from './data';
import {
  Btn,
  Header,
  Avatar,
  SelectField,
  Field,
  Modal,
  ConfirmDialog,
  StatusBadge,
  DueBadge,
  EmptyState,
  useAction,
  ErrorState,
} from './ui';

export function TaskModal({
  task,
  initialStatus = 'TODO',
  onClose,
}: {
  task?: Task;
  initialStatus?: Status;
  onClose: () => void;
}) {
  const { project, members, meetings, api } = useProject();
  const nav = useNavigate();
  const [editing, setEditing] = useState(!task);
  const [removing, setRemoving] = useState(false);
  const a = useAction();
  const [form, setForm] = useState<TaskInput>({
    title: task?.title || '',
    description: task?.description || '',
    assigneeId: task?.assigneeId ?? null,
    dueDate: task?.dueDate ?? null,
    priority: task?.priority || 'MEDIUM',
    reason: task?.reason || '',
    status: task?.status || initialStatus,
    meetingId: task?.meetingId ?? null,
  });
  const update = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((p) => ({ ...p, [key]: value }));
  const origin = meetings.find((m) => m.id === task?.meetingId);
  return (
    <Modal
      title={editing ? (task ? '업무 수정' : '새 후속 업무') : task!.title}
      description={
        editing
          ? '다음 행동을 구체적으로 정리해주세요.'
          : '회의에서 이어진 팀의 다음 행동'
      }
      onClose={() => {
        if (!a.busy) onClose();
      }}
      wide
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = await a.run(
            () =>
              task
                ? api.updateTask(task.id, TaskInputSchema.parse(form))
                : api.createTask(project.id, TaskInputSchema.parse(form)),
            task ? '업무가 수정됐어요.' : '업무가 만들어졌어요.',
          );
          if (t) onClose();
        }}
      >
        {editing ? (
          <>
            <Field
              label="업무명"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="예: 로그인 오류 수정"
            />
            <label className="field">
              설명
              <textarea
                className="fu-textarea"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="업무에 필요한 내용을 적어주세요."
              />
            </label>
            <div className="form-grid">
              <SelectField
                label="담당자"
                value={form.assigneeId || 'none'}
                onChange={(v) => update('assigneeId', v === 'none' ? null : v)}
                options={[
                  { value: 'none', label: '담당자 미지정' },
                  ...members.map((m) => ({ value: m.id, label: m.name })),
                ]}
              />
              <Field
                label="마감일"
                type="date"
                value={form.dueDate || ''}
                onChange={(e) => update('dueDate', e.target.value || null)}
              />
            </div>
            <div className="form-grid">
              <SelectField
                label="상태"
                value={form.status}
                onChange={(v) => update('status', v as Status)}
                options={Object.entries(statusLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <SelectField
                label="우선순위"
                value={form.priority}
                onChange={(v) => update('priority', v as Priority)}
                options={Object.entries(priorityLabels).map(
                  ([value, label]) => ({ value, label: `${label} · ${value}` }),
                )}
              />
            </div>
            {!task && (
              <SelectField
                label="연결 회의"
                value={form.meetingId || 'none'}
                onChange={(v) => update('meetingId', v === 'none' ? null : v)}
                options={[
                  { value: 'none', label: '회의 연결 없음' },
                  ...meetings.map((m) => ({
                    value: m.id,
                    label: `${m.title} · ${m.date}`,
                  })),
                ]}
              />
            )}
            <div className="form-actions">
              <Btn
                type="button"
                secondary
                onClick={() => (task ? setEditing(false) : onClose())}
              >
                취소
              </Btn>
              <Btn type="submit" busy={a.busy}>
                <Check size={16} />
                {task ? '변경사항 저장' : '업무 생성'}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <div className="task-detail-badges">
              <StatusBadge status={task!.status} />
              <span className={`priority ${task!.priority.toLowerCase()}`}>
                {task!.priority}
              </span>
              <DueBadge
                date={task!.dueDate}
                status={task!.status}
                threshold={project.dueSoonDays}
              />
            </div>
            {task!.description && (
              <p className="task-description">{task!.description}</p>
            )}
            <dl className="task-details">
              <div>
                <dt>담당자</dt>
                <dd>
                  <Avatar
                    user={members.find((m) => m.id === task!.assigneeId)}
                    size="small"
                  />
                  {members.find((m) => m.id === task!.assigneeId)?.name ||
                    '미지정'}
                </dd>
              </div>
              <div>
                <dt>
                  <CalendarClock size={14} />
                  마감일
                </dt>
                <dd>{task!.dueDate || '미지정'}</dd>
              </div>
              <div>
                <dt>
                  <FileText size={14} />
                  생성 회의
                </dt>
                <dd>
                  {origin ? (
                    <button
                      className="text-link"
                      onClick={() => {
                        onClose();
                        void nav(`/p/${project.id}/meetings/${origin.id}`);
                      }}
                    >
                      {origin.title}
                      <ArrowUpRight size={13} />
                    </button>
                  ) : (
                    '회의 연결 없음'
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <Clock size={14} />
                  생성일
                </dt>
                <dd>{new Date(task!.createdAt).toLocaleDateString('ko-KR')}</dd>
              </div>
              {task!.completedAt && (
                <div>
                  <dt>완료일</dt>
                  <dd>{new Date(task!.completedAt).toLocaleString('ko-KR')}</dd>
                </div>
              )}
            </dl>
            {task!.reason && (
              <div className="reason-box">
                <span>
                  <Sparkles size={13} />
                  우선순위 추천 이유
                </span>
                <p>{task!.reason}</p>
              </div>
            )}
            <div className="task-modal-actions">
              <Btn secondary type="button" onClick={() => setEditing(true)}>
                <Pencil size={15} />
                수정
              </Btn>
              <Btn
                type="button"
                busy={a.busy}
                onClick={async () => {
                  const t = await a.run(
                    () =>
                      api.updateTask(task!.id, {
                        ...task!,
                        status:
                          task!.status === 'DONE' ? 'IN_PROGRESS' : 'DONE',
                      }),
                    task!.status === 'DONE'
                      ? '업무를 다시 진행해요.'
                      : '업무를 완료했어요.',
                  );
                  if (t) onClose();
                }}
              >
                {task!.status === 'DONE' ? (
                  <RotateCcw size={15} />
                ) : (
                  <Check size={15} />
                )}{' '}
                {task!.status === 'DONE' ? '다시 진행하기' : '완료 처리'}
              </Btn>
              <button
                type="button"
                className="icon-button danger"
                aria-label="업무 삭제"
                onClick={() => setRemoving(true)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </>
        )}
        {a.error ? <ErrorState error={a.error} /> : null}
      </form>
      <ConfirmDialog
        open={removing}
        onClose={() => setRemoving(false)}
        title="업무를 삭제할까요?"
        description="대시보드와 연결된 회의에서도 이 업무가 제거돼요. 되돌릴 수 없어요."
        busy={a.busy}
        onConfirm={async () => {
          if (!task) return;
          const ok = await a.run(async () => {
            await api.deleteTask(task.id);
            return true;
          }, '업무가 삭제됐어요.');
          if (ok) onClose();
        }}
      />
    </Modal>
  );
}

export function TaskBoard() {
  const { project, tasks, members, meetings, api } = useProject();
  const [params, setParams] = useSearchParams();
  const a = useAction();
  const [view, setView] = useState('board');
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState<Status | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const filter = (key: string) => params.get(key) || 'all';
  const setFilter = (key: string, value: string) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (value === 'all' || !value) p.delete(key);
        else p.set(key, value);
        return p;
      },
      { replace: true },
    );
  };
  const filtered = tasks.filter((t) => {
    const days = daysUntil(t.dueDate);
    const due = filter('due');
    return (
      (filter('assignee') === 'all' ||
        (filter('assignee') === 'none'
          ? !t.assigneeId
          : t.assigneeId === filter('assignee'))) &&
      (filter('status') === 'all' || t.status === filter('status')) &&
      (filter('priority') === 'all' || t.priority === filter('priority')) &&
      (!params.get('q') ||
        `${t.title} ${t.description}`
          .toLowerCase()
          .includes(params.get('q')!.toLowerCase())) &&
      (due === 'all' ||
        (due === 'none' && !t.dueDate) ||
        (t.status !== 'DONE' &&
          days !== null &&
          ((due === 'overdue' && days < 0) ||
            (due === 'today' && days === 0) ||
            (due === 'soon' && days >= 0 && days <= project.dueSoonDays))))
    );
  });
  async function move(taskId: string, status: Status) {
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== status)
      await a.run(
        () => api.updateTask(taskId, { ...task, status }),
        `업무를 ${statusLabels[status]} 상태로 이동했어요.`,
      );
    setOver(null);
    setDragging(null);
  }
  function open(t: Task) {
    if (!dragging) setSelected(t.id);
  }
  return (
    <main className="page-container board-page page-enter">
      <Header
        title="후속 업무"
        subtitle="회의에서 시작된 일을, 완성으로 이어가세요."
        action={
          <Btn onClick={() => setCreating('TODO')}>
            <Plus size={16} />새 업무
          </Btn>
        }
      />
      <div className="board-toolbar">
        <Tabs value={view} onValueChange={(v) => setView(v as string)}>
          <TabsList className="view-tabs">
            <TabsTrigger value="board">
              <Columns3 size={15} />
              업무 보드
            </TabsTrigger>
            <TabsTrigger value="list">
              <ListFilter size={15} />
              전체 업무
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="result-count">{filtered.length}개 업무</span>
        <div className="search-field task-search">
          <Search size={15} />
          <Input
            className="fu-input"
            placeholder="업무 검색"
            aria-label="업무 검색"
            value={params.get('q') || ''}
            onChange={(e) => setFilter('q', e.target.value)}
          />
        </div>
      </div>
      <div className="filters">
        <SelectField
          label="담당자"
          value={filter('assignee')}
          onChange={(v) => setFilter('assignee', v)}
          options={[
            { value: 'all', label: '모든 담당자' },
            { value: 'none', label: '미지정' },
            ...members.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
        <SelectField
          label="상태"
          value={filter('status')}
          onChange={(v) => setFilter('status', v)}
          options={[
            { value: 'all', label: '모든 상태' },
            ...Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <SelectField
          label="우선순위"
          value={filter('priority')}
          onChange={(v) => setFilter('priority', v)}
          options={[
            { value: 'all', label: '모든 우선순위' },
            ...Object.entries(priorityLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <SelectField
          label="마감일"
          value={filter('due')}
          onChange={(v) => setFilter('due', v)}
          options={[
            { value: 'all', label: '모든 마감일' },
            { value: 'today', label: '오늘 마감' },
            {
              value: 'soon',
              label: `마감 임박 (${project.dueSoonDays}일 이내)`,
            },
            { value: 'overdue', label: '지연 업무' },
            { value: 'none', label: '기한 미지정' },
          ]}
        />
        {params.size > 0 && (
          <button className="reset-filter" onClick={() => setParams({})}>
            <X size={13} />
            초기화
          </button>
        )}
      </div>
      {view === 'board' ? (
        <>
          <div className="kanban-board">
            {(Object.keys(statusLabels) as Status[]).map((status) => {
              const list = filtered.filter((t) => t.status === status);
              return (
                <section
                  key={status}
                  className={`kanban-column ${over === status ? 'drag-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setOver(status);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain');
                    void move(id, status);
                  }}
                >
                  <header>
                    <i className={`status-dot ${status}`} />
                    <h2>{statusLabels[status]}</h2>
                    <span className="column-count">{list.length}</span>
                    <button
                      className="icon-button"
                      onClick={() => setCreating(status)}
                      aria-label={`${statusLabels[status]} 업무 추가`}
                    >
                      <Plus size={16} />
                    </button>
                  </header>
                  <div className="kanban-cards">
                    {list.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        className={`task-card ${dragging === t.id ? 'dragging' : ''} ${t.status === 'DONE' ? 'is-done' : ''}`}
                        aria-label={`${t.title} 상세, ${statusLabels[t.status]}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelected(t.id);
                          }
                        }}
                        draggable={!a.busy}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', t.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDragging(t.id);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        onClick={() => open(t)}
                      >
                        <div className="task-card-top">
                          <span className="task-key">
                            <CheckSquare size={14} />
                            No.{tasks.findIndex((x) => x.id === t.id) + 1}
                          </span>
                          <GripVertical className="grip" size={15} />
                        </div>
                        <h3>{t.title}</h3>
                        <span
                          className={`priority ${t.priority.toLowerCase()}`}
                        >
                          {t.priority === 'HIGH'
                            ? '↑↑'
                            : t.priority === 'MEDIUM'
                              ? '='
                              : '↓'}{' '}
                          {t.priority}
                        </span>
                        <div className="task-card-footer">
                          <span>
                            <CalendarClock size={13} />
                            <DueBadge
                              date={t.dueDate}
                              status={t.status}
                              threshold={project.dueSoonDays}
                            />
                          </span>
                          <Avatar
                            user={members.find((m) => m.id === t.assigneeId)}
                            size="small"
                          />
                        </div>
                        {t.meetingId && (
                          <div className="task-meeting">
                            <FileText size={12} />
                            {meetings.find((m) => m.id === t.meetingId)
                              ?.title || '회의 연결 없음'}
                          </div>
                        )}
                      </button>
                    ))}
                    {!list.length && (
                      <div className="empty-column">
                        {over === status
                          ? '여기에 놓아주세요'
                          : '아직 업무가 없어요'}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="board-hint">
            <GripVertical size={13} />
            카드를 끌어 상태를 변경하거나, 카드를 열어 수정할 수 있어요.
          </p>
        </>
      ) : filtered.length ? (
        <div className="task-table-wrap">
          <Table className="task-table">
            <TableHeader>
              <TableRow>
                <TableHead>업무</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>우선순위</TableHead>
                <TableHead>마감일</TableHead>
                <TableHead>생성 회의</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <button
                      className="table-task-link"
                      onClick={() => setSelected(t.id)}
                    >
                      <CheckSquare size={15} />
                      {t.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="table-person">
                      <Avatar
                        user={members.find((m) => m.id === t.assigneeId)}
                        size="small"
                      />
                      {members.find((m) => m.id === t.assigneeId)?.name ||
                        '미지정'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    <span className={`priority ${t.priority.toLowerCase()}`}>
                      {t.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DueBadge
                      date={t.dueDate}
                      status={t.status}
                      threshold={project.dueSoonDays}
                    />
                  </TableCell>
                  <TableCell>
                    {t.meetingId ? (
                      <Link
                        className="quiet-link"
                        to={`/p/${project.id}/meetings/${t.meetingId}`}
                      >
                        {meetings.find((m) => m.id === t.meetingId)?.title ||
                          '회의'}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 업무가 없어요"
          description="필터를 변경하거나 새 업무를 추가해보세요."
          action={
            <Btn secondary onClick={() => setParams({})}>
              필터 초기화
            </Btn>
          }
        />
      )}
      {selected && tasks.find((t) => t.id === selected) && (
        <TaskModal
          task={tasks.find((t) => t.id === selected)}
          onClose={() => setSelected(null)}
        />
      )}{' '}
      {creating && (
        <TaskModal initialStatus={creating} onClose={() => setCreating(null)} />
      )}
    </main>
  );
}
