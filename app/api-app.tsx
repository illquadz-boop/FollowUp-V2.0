'use client';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  createContext,
  useContext,
} from 'react';
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  LogOut,
  CheckSquare,
  CalendarDays,
  Users,
  LayoutDashboard,
  Settings,
  GripVertical,
} from 'lucide-react';
import {
  backend,
  type Member,
  type Project,
  type Task,
  type TaskInput,
  Status,
} from '@/lib/swagger-api';
import { errorMessage, statusLabels, priorityLabels } from '@/lib/contracts';
import {
  Btn,
  Card,
  Field,
  SelectField,
  Modal,
  ConfirmDialog,
  Loading,
  ErrorState,
  EmptyState,
} from './ui';
import { Landing, Logo } from './landing';
import { usePageMotion } from './account';
import { ApiMeetings, ApiMeetingPage } from './api-meetings';
import './api-workspace.css';

export function useApiAction() {
  const qc = useQueryClient();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function run<T>(fn: () => Promise<T>, success = '저장했어요.') {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const value = await fn();
      await qc.invalidateQueries({ queryKey: ['server'] });
      setMessage(success);
      return { value };
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    run,
    feedback: (
      <div aria-live="polite">
        {error && (
          <p className="api-error" role="alert">
            {error}
          </p>
        )}
        {message && <p className="api-success">{message}</p>}
      </div>
    ),
  };
}
export function QueryView<T>({
  query,
  children,
}: {
  query: UseQueryResult<T, Error>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return <>{children(query.data)}</>;
}
export function SectionTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="api-section-title">
      <h1>{title}</h1>
      <div>{children}</div>
    </header>
  );
}
export function TextArea({
  label,
  value,
  onChange,
  maxLength = 100000,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  maxLength?: number;
}) {
  return (
    <label className="api-textarea-label">
      {label}
      <textarea
        className="fu-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
      />
    </label>
  );
}
export function ApiRouting() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  useEffect(() => {
    document.title = 'FollowUp — 회의에서 다음 행동으로';
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const expired = () => {
      qc.clear();
      void nav('/login', { replace: true });
    };
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('followup-auth')
        : null;
    if (channel)
      channel.onmessage = () => {
        qc.clear();
        void qc.invalidateQueries();
        void nav('/start', { replace: true });
      };
    window.addEventListener('followup:unauthorized', expired);
    return () => {
      window.removeEventListener('followup:unauthorized', expired);
      channel?.close();
    };
  }, [qc, nav]);
  return (
    <Routes>
      <Route path="/" element={<ApiLanding />} />
      <Route path="/login" element={<ApiAuth />} />
      <Route path="/signup" element={<ApiAuth signup />} />
      <Route element={<ApiGuard />}>
        <Route path="/start" element={<ApiProjects />} />
        <Route path="/projects" element={<ApiProjects />} />
        <Route path="/p/:projectId" element={<ApiProjectShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ApiDashboard />} />
          <Route path="members" element={<ApiMembers />} />
          <Route path="settings" element={<ApiSettings />} />
          <Route path="tasks" element={<ApiTasks />} />
          <Route path="meetings" element={<ApiMeetings />} />
          <Route path="meetings/new" element={<ApiMeetingPage />} />
          <Route path="meetings/:meetingId" element={<ApiMeetingPage />} />
          <Route path="meetings/:meetingId/edit" element={<ApiMeetingPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/start" replace />} />
    </Routes>
  );
}
function authChanged() {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('followup-auth');
    channel.postMessage('changed');
    channel.close();
  }
}
function ApiLanding() {
  const nav = useNavigate();
  usePageMotion();
  return (
    <Landing
      onLogin={() => nav('/login')}
      onSignup={() => nav('/signup')}
      onDemo={() => nav('/login')}
    />
  );
}
function ApiGuard() {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: backend.session,
    retry: false,
    staleTime: 0,
  });
  return (
    <main className="api-root">
      <QueryView query={session}>
        {(data) =>
          data.authenticated ? <Outlet /> : <Navigate to="/login" replace />
        }
      </QueryView>
    </main>
  );
}
function ApiAuth({ signup = false }: { signup?: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [created, setCreated] = useState(false);
  const a = useApiAction();
  const qc = useQueryClient();
  const nav = useNavigate();
  return (
    <div className="auth-page">
      <div className="auth-top">
        <Link to="/">
          <Logo />
        </Link>
        <Link to="/">홈으로</Link>
      </div>
      <main className="auth-content page-enter">
        <div className="auth-symbol">
          <Logo symbol />
        </div>
        <h1>{signup ? '계정 만들기' : '다시 만나서 반가워요'}</h1>
        <p>회의가 끝나도, 일은 계속 이어져요.</p>
        {created ? (
          <Card>
            <p>계정이 만들어졌어요. 로그인해주세요.</p>
            <Link to="/login">
              <Btn>로그인하기</Btn>
            </Link>
          </Card>
        ) : (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await a.run<unknown>(
                () =>
                  signup
                    ? backend.signup(name.trim(), email.trim(), password)
                    : backend.login(email.trim(), password),
                signup ? '계정을 만들었어요.' : '로그인했어요.',
              );
              if (result) {
                setPassword('');
                if (signup) setCreated(true);
                else {
                  qc.clear();
                  authChanged();
                  void nav('/start', { replace: true });
                }
              }
            }}
          >
            {signup && (
              <Field
                required
                label="이름"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <Field
              required
              type="email"
              label="이메일"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              required
              type="password"
              label="비밀번호"
              minLength={signup ? 8 : 1}
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {a.feedback}
            <Btn type="submit" busy={a.busy}>
              {signup ? '회원가입' : '로그인'}
            </Btn>
          </form>
        )}
        <p>
          <Link to={signup ? '/login' : '/signup'}>
            {signup ? '이미 계정이 있나요? 로그인' : '처음이신가요? 회원가입'}
          </Link>
        </p>
      </main>
    </div>
  );
}
function Logout() {
  const a = useApiAction();
  const qc = useQueryClient();
  const nav = useNavigate();
  return (
    <div>
      {a.feedback}
      <Btn
        secondary
        busy={a.busy}
        onClick={async () => {
          if (await a.run(backend.logout, '로그아웃했어요.')) {
            qc.clear();
            authChanged();
            void nav('/login', { replace: true });
          }
        }}
      >
        <LogOut size={16} />
        로그아웃
      </Btn>
    </div>
  );
}
function ProjectForm({
  initial,
  onDone,
  onClose,
}: {
  initial?: Project;
  onDone: (p: Project) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const a = useApiAction();
  return (
    <Modal
      title={initial ? '프로젝트 수정' : '새 프로젝트'}
      onClose={() => {
        if (!a.busy) onClose();
      }}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = { name: name.trim(), description };
          const result = await a.run(() =>
            initial
              ? backend.updateProject(initial.id, data)
              : backend.createProject(data),
          );
          if (result) onDone(result.value);
        }}
      >
        <Field
          required
          label="프로젝트 이름"
          maxLength={150}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextArea label="설명" value={description} onChange={setDescription} />
        {a.feedback}
        <Btn type="submit" busy={a.busy}>
          저장
        </Btn>
      </form>
    </Modal>
  );
}
function ApiProjects() {
  const q = useQuery({
    queryKey: ['server', 'projects'],
    queryFn: backend.projects,
  });
  const [create, setCreate] = useState(false);
  const nav = useNavigate();
  return (
    <div className="api-home">
      <header className="api-top">
        <Link to="/">
          <Logo />
        </Link>
        <Logout />
      </header>
      <SectionTitle title="내 프로젝트">
        <Btn onClick={() => setCreate(true)}>
          <Plus size={16} />새 프로젝트
        </Btn>
      </SectionTitle>
      <QueryView query={q}>
        {(projects) =>
          projects.length ? (
            <div className="api-project-grid">
              {projects.map((p) => (
                <Link
                  className="api-project-card"
                  to={`/p/${p.id}/dashboard`}
                  key={p.id}
                >
                  <span className="api-project-icon">{p.name.slice(0, 1)}</span>
                  <h2>{p.name}</h2>
                  <p>{p.description || '프로젝트 열기'}</p>
                  <span>프로젝트 보기 →</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="첫 프로젝트를 만들어보세요"
              description="회의와 후속 업무를 한곳에서 관리해요."
            />
          )
        }
      </QueryView>
      {create && (
        <ProjectForm
          onClose={() => setCreate(false)}
          onDone={(p) => nav(`/p/${p.id}/dashboard`)}
        />
      )}
    </div>
  );
}
const ProjectContext = createContext<{
  project: Project;
  members: Member[];
} | null>(null);
export function useApiProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('프로젝트를 선택해주세요.');
  return context;
}
function ApiProjectShell() {
  const id = Number(useParams().projectId);
  const q = useQuery({
    queryKey: ['server', id, 'project'],
    queryFn: () => backend.project(id),
    enabled: Number.isSafeInteger(id) && id > 0,
  });
  const members = useQuery({
    queryKey: ['server', id, 'members'],
    queryFn: () => backend.members(id),
    enabled: Number.isSafeInteger(id) && id > 0,
  });
  if (!Number.isSafeInteger(id) || id <= 0)
    return <Navigate to="/start" replace />;
  const items = [
    ['dashboard', '대시보드', LayoutDashboard],
    ['meetings', '회의', CalendarDays],
    ['tasks', '후속 업무', CheckSquare],
    ['members', '구성원', Users],
    ['settings', '설정', Settings],
  ] as const;
  return (
    <div className="api-shell">
      <aside className="api-sidebar">
        <Link to="/start">
          <Logo />
        </Link>
        <Link className="api-back" to="/start">
          <ArrowLeft size={14} />
          프로젝트 목록
        </Link>
        <h2>{q.data?.name || '프로젝트'}</h2>
        <nav>
          {items.map(([path, label, Icon]) => (
            <NavLink key={path} to={path}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <Logout />
      </aside>
      <div className="api-main">
        <QueryView query={q}>
          {(project) => (
            <QueryView query={members}>
              {(list) => (
                <ProjectContext.Provider value={{ project, members: list }}>
                  <Outlet />
                </ProjectContext.Provider>
              )}
            </QueryView>
          )}
        </QueryView>
      </div>
    </div>
  );
}
function ApiDashboard() {
  const { project } = useApiProject();
  const q = useQuery({
    queryKey: ['server', project.id, 'dashboard'],
    queryFn: () => backend.dashboard(project.id),
  });
  return (
    <>
      <SectionTitle title="대시보드">
        <Link to="../meetings/new">
          <Btn>
            <Plus size={16} />새 회의
          </Btn>
        </Link>
      </SectionTitle>
      <QueryView query={q}>
        {(d) => (
          <>
            <div className="api-stats">
              {[
                ['전체 업무', d.actionItemSummary.total],
                ['예정', d.actionItemSummary.todo],
                ['진행 중', d.actionItemSummary.inProgress],
                ['완료', d.actionItemSummary.done],
                ['지연', d.actionItemSummary.overdue],
              ].map(([label, n]) => (
                <Card key={label}>
                  <span>{label}</span>
                  <strong>{n}</strong>
                </Card>
              ))}
            </div>
            <div className="api-two-columns">
              <Card>
                <h2>마감이 가까운 업무</h2>
                {d.dueSoonActionItems.length ? (
                  d.dueSoonActionItems.map((t) => (
                    <Link
                      key={t.actionItemId}
                      className="api-list-row"
                      to={`../tasks?task=${t.actionItemId}`}
                    >
                      <span>
                        {t.title}
                        <small>{t.assigneeName || '담당자 미지정'}</small>
                      </span>
                      <span>{t.dueDate || '기한 없음'}</span>
                    </Link>
                  ))
                ) : (
                  <p className="muted">마감이 가까운 업무가 없어요.</p>
                )}
              </Card>
              <Card>
                <h2>최근 회의</h2>
                {d.recentMeetings.length ? (
                  d.recentMeetings.map((m) => (
                    <Link
                      className="api-list-row"
                      to={`../meetings/${m.meetingId}`}
                      key={m.meetingId}
                    >
                      <span>{m.title}</span>
                      <span>
                        {m.scheduledAt.replace('T', ' ').slice(0, 16)}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="muted">아직 회의가 없어요.</p>
                )}
              </Card>
            </div>
            <Card>
              <h2>구성원별 진행률</h2>
              {d.memberProgress.map((m) => {
                const percent = m.totalCount
                  ? Math.round((m.doneCount / m.totalCount) * 100)
                  : 0;
                return (
                  <div className="api-progress-row" key={m.userId}>
                    <span>{m.name}</span>
                    <progress
                      max={100}
                      value={percent}
                      aria-label={`${m.name} 완료율`}
                    />
                    <span>
                      {m.doneCount}/{m.totalCount} · {percent}%
                    </span>
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </QueryView>
    </>
  );
}
function ApiMembers() {
  const { project, members } = useApiProject();
  const [email, setEmail] = useState('');
  const [remove, setRemove] = useState<Member | null>(null);
  const a = useApiAction();
  return (
    <>
      <SectionTitle title="구성원" />
      <Card>
        <form
          className="api-inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await a.run(
                () => backend.addMember(project.id, email.trim()),
                '구성원을 추가했어요.',
              )
            )
              setEmail('');
          }}
        >
          <Field
            required
            label="추가할 구성원의 이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Btn type="submit" busy={a.busy}>
            추가
          </Btn>
        </form>
        {a.feedback}
      </Card>
      <Card>
        {members.map((m) => (
          <div className="api-list-row" key={m.userId}>
            <span>
              <strong>{m.name}</strong>
              <small>{m.email}</small>
            </span>
            <span>{m.role === 'OWNER' ? '소유자' : '구성원'}</span>
            {m.role !== 'OWNER' && (
              <Btn secondary disabled={a.busy} onClick={() => setRemove(m)}>
                제거
              </Btn>
            )}
          </div>
        ))}
      </Card>
      <ConfirmDialog
        open={!!remove}
        title="구성원을 제거할까요?"
        description={
          remove ? `${remove.name} 님을 프로젝트에서 제거합니다.` : ''
        }
        busy={a.busy}
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          if (
            remove &&
            (await a.run(
              () => backend.removeMember(project.id, remove.userId),
              '구성원을 제거했어요.',
            ))
          )
            setRemove(null);
        }}
      >
        {a.feedback}
      </ConfirmDialog>
    </>
  );
}
function ApiSettings() {
  const { project } = useApiProject();
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState(false);
  const [typed, setTyped] = useState('');
  const a = useApiAction();
  const nav = useNavigate();
  return (
    <>
      <SectionTitle title="프로젝트 설정" />
      <Card>
        <h2>{project.name}</h2>
        <p>{project.description}</p>
        <Btn secondary onClick={() => setEdit(true)}>
          이름·설명 수정
        </Btn>
      </Card>
      <Card>
        <h2>프로젝트 삭제</h2>
        <p>연결된 데이터가 있으면 삭제할 수 없어요.</p>
        <Btn danger onClick={() => setRemove(true)}>
          프로젝트 삭제
        </Btn>
        {a.feedback}
      </Card>
      {edit && (
        <ProjectForm
          initial={project}
          onClose={() => setEdit(false)}
          onDone={() => setEdit(false)}
        />
      )}
      <ConfirmDialog
        open={remove}
        title="프로젝트를 삭제할까요?"
        description="삭제한 프로젝트는 복구할 수 없어요. 프로젝트 이름을 입력해주세요."
        confirmDisabled={typed !== project.name}
        busy={a.busy}
        onClose={() => setRemove(false)}
        onConfirm={async () => {
          if (
            await a.run(
              () => backend.deleteProject(project.id),
              '프로젝트를 삭제했어요.',
            )
          )
            void nav('/start');
        }}
      >
        <Field
          label="프로젝트 이름"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        {a.feedback}
      </ConfirmDialog>
    </>
  );
}
export function AssigneeField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  const { members } = useApiProject();
  return (
    <SelectField
      label="담당자"
      value={value === null ? 'none' : String(value)}
      onChange={(v) => onChange(v === 'none' ? null : Number(v))}
      options={[
        { value: 'none', label: '미지정' },
        ...members.map((m) => ({
          value: String(m.userId),
          label: `${m.name} (${m.email})`,
        })),
      ]}
    />
  );
}
export function PriorityField({
  value,
  onChange,
}: {
  value: TaskInput['priority'];
  onChange: (v: TaskInput['priority']) => void;
}) {
  return (
    <SelectField
      label="우선순위"
      value={value}
      onChange={(v) => onChange(v as TaskInput['priority'])}
      options={Object.entries(priorityLabels).map(([value, label]) => ({
        value,
        label,
      }))}
    />
  );
}
function TaskForm({
  initial,
  onClose,
}: {
  initial?: Task;
  onClose: () => void;
}) {
  const { project } = useApiProject();
  const a = useApiAction();
  const [input, setInput] = useState<TaskInput>({
    title: initial?.title || '',
    description: initial?.description || '',
    assigneeUserId: initial?.assignee?.userId ?? null,
    dueDate: initial?.dueDate ?? null,
    priority: initial?.priority || 'MEDIUM',
  });
  const [status, setStatus] = useState(initial?.status || 'TODO');
  const [remove, setRemove] = useState(false);
  const field = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setInput((v) => ({ ...v, [key]: value }));
  return (
    <>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await a.run(() =>
              initial
                ? backend.updateTask(initial.id, {
                    ...input,
                    title: input.title.trim(),
                    status,
                  })
                : backend.createTask(project.id, {
                    ...input,
                    title: input.title.trim(),
                  }),
            )
          )
            onClose();
        }}
      >
        <Field
          required
          label="업무명"
          maxLength={255}
          value={input.title}
          onChange={(e) => field('title', e.target.value)}
        />
        <TextArea
          label="설명"
          value={input.description}
          onChange={(v) => field('description', v)}
        />
        <div className="api-two-columns">
          <AssigneeField
            value={input.assigneeUserId}
            onChange={(v) => field('assigneeUserId', v)}
          />
          <Field
            label="마감일"
            type="date"
            value={input.dueDate || ''}
            onChange={(e) => field('dueDate', e.target.value || null)}
          />
          <PriorityField
            value={input.priority}
            onChange={(v) => field('priority', v)}
          />
          {initial && (
            <SelectField
              label="상태"
              value={status}
              onChange={(v) => setStatus(Status.parse(v))}
              options={Object.entries(statusLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          )}
        </div>
        {initial?.originMeetingId && (
          <Link to={`../meetings/${initial.originMeetingId}`} onClick={onClose}>
            원본 회의 보기 →
          </Link>
        )}
        {initial?.priorityReason && (
          <p className="muted">추천 이유: {initial.priorityReason}</p>
        )}
        {a.feedback}
        <div className="api-actions">
          <Btn type="submit" busy={a.busy}>
            저장
          </Btn>
          {initial && (
            <Btn
              type="button"
              danger
              secondary
              disabled={a.busy}
              onClick={() => setRemove(true)}
            >
              삭제
            </Btn>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={remove}
        title="업무를 삭제할까요?"
        description="삭제한 업무는 복구할 수 없어요."
        busy={a.busy}
        onClose={() => setRemove(false)}
        onConfirm={async () => {
          if (
            initial &&
            (await a.run(
              () => backend.deleteTask(initial.id),
              '업무를 삭제했어요.',
            ))
          )
            onClose();
        }}
      >
        {a.feedback}
      </ConfirmDialog>
    </>
  );
}
function TaskDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['server', 'task', id],
    queryFn: () => backend.task(id),
  });
  return (
    <QueryView query={q}>
      {(task) => <TaskForm initial={task} onClose={onClose} />}
    </QueryView>
  );
}
function ApiTasks() {
  const { project, members } = useApiProject();
  const location = useLocation();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['server', project.id, 'tasks'],
    queryFn: () => backend.tasks(project.id),
  });
  const meetings = useQuery({
    queryKey: ['server', project.id, 'meetings'],
    queryFn: () => backend.meetings(project.id),
  });
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [view, setView] = useState('board');
  const taskParam = Number(new URLSearchParams(location.search).get('task'));
  const [localSelected, setSelected] = useState<number | 'new' | null>(null);
  const selected = localSelected ?? (taskParam > 0 ? taskParam : null);
  const a = useApiAction();
  const close = () => {
    setSelected(null);
    if (taskParam)
      void nav({ pathname: location.pathname, search: '' }, { replace: true });
  };
  const move = (id: number, status: 'TODO' | 'IN_PROGRESS' | 'DONE') =>
    a.run(() => backend.updateTask(id, { status }), '업무 상태를 변경했어요.');
  return (
    <>
      <SectionTitle title="후속 업무">
        <Btn onClick={() => setSelected('new')}>
          <Plus size={16} />새 업무
        </Btn>
      </SectionTitle>
      <div className="api-filters">
        <Field
          label="업무 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectField
          label="담당자"
          value={assignee}
          onChange={setAssignee}
          options={[
            { value: 'all', label: '전체' },
            { value: 'none', label: '미지정' },
            ...members.map((m) => ({ value: String(m.userId), label: m.name })),
          ]}
        />
        <SelectField
          label="우선순위"
          value={priority}
          onChange={setPriority}
          options={[
            { value: 'all', label: '전체' },
            ...Object.entries(priorityLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <SelectField
          label="보기"
          value={view}
          onChange={setView}
          options={[
            { value: 'board', label: '업무 보드' },
            { value: 'list', label: '전체 목록' },
          ]}
        />
      </div>
      {a.feedback}
      <QueryView query={q}>
        {(tasks) => {
          const filtered = tasks.filter(
            (t) =>
              t.title.toLowerCase().includes(search.toLowerCase()) &&
              (priority === 'all' || t.priority === priority) &&
              (assignee === 'all' ||
                (assignee === 'none'
                  ? t.assigneeUserId === null
                  : t.assigneeUserId === Number(assignee))),
          );
          return (
            <div className={view === 'board' ? 'api-board' : 'api-task-list'}>
              {(view === 'board' ? Status.options : (['all'] as const)).map(
                (column) => (
                  <section
                    className="api-board-column"
                    key={column}
                    onDragOver={(e) => {
                      if (!a.busy) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = Number(e.dataTransfer.getData('text/plain'));
                      if (
                        column !== 'all' &&
                        tasks.some((t) => t.id === id) &&
                        !a.busy
                      )
                        void move(id, column);
                    }}
                  >
                    <h2>
                      {column === 'all' ? '전체 업무' : statusLabels[column]}{' '}
                      <span>
                        {
                          filtered.filter(
                            (t) => column === 'all' || t.status === column,
                          ).length
                        }
                      </span>
                    </h2>
                    {filtered
                      .filter((t) => column === 'all' || t.status === column)
                      .map((t) => (
                        <article className="api-task-card" key={t.id}>
                          <button
                            className="api-task-open"
                            draggable={!a.busy}
                            onDragStart={(e) =>
                              e.dataTransfer.setData('text/plain', String(t.id))
                            }
                            onClick={() => setSelected(t.id)}
                          >
                            <span className="task-key">
                              <CheckSquare size={14} />
                              No.{tasks.findIndex((x) => x.id === t.id) + 1}
                              <GripVertical size={14} />
                            </span>
                            <h3>{t.title}</h3>
                            <span
                              className={`priority ${(t.priority || 'MEDIUM').toLowerCase()}`}
                            >
                              {t.priority
                                ? priorityLabels[t.priority]
                                : '우선순위 미지정'}
                            </span>
                            <div className="api-task-meta">
                              <span>{t.dueDate || '기한 없음'}</span>
                              <span>
                                {members.find(
                                  (m) => m.userId === t.assigneeUserId,
                                )?.name || '미지정'}
                              </span>
                            </div>
                          </button>
                          <TaskOrigin
                            id={t.id}
                            number={tasks.findIndex((x) => x.id === t.id) + 1}
                            meetings={meetings.data || []}
                          />
                          <SelectField
                            label="업무 상태"
                            value={t.status}
                            disabled={a.busy}
                            onChange={(s) => void move(t.id, Status.parse(s))}
                            options={Object.entries(statusLabels).map(
                              ([value, label]) => ({ value, label }),
                            )}
                          />
                        </article>
                      ))}
                    {!filtered.some(
                      (t) => column === 'all' || t.status === column,
                    ) && <p className="muted">표시할 업무가 없어요.</p>}
                  </section>
                ),
              )}
            </div>
          );
        }}
      </QueryView>
      {selected !== null && (
        <Modal
          title={selected === 'new' ? '새 후속 업무' : '업무 상세·수정'}
          onClose={close}
        >
          {selected === 'new' ? (
            <TaskForm onClose={close} />
          ) : (
            <TaskDetail id={selected} onClose={close} />
          )}
        </Modal>
      )}
    </>
  );
}
// The list DTO omits originMeetingId. Fetch detail for visible cards, with Query caching.
function TaskOrigin({
  id,
  number,
  meetings,
}: {
  id: number;
  number: number;
  meetings: { id: number; title: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const q = useQuery({
    queryKey: ['server', 'task', id],
    queryFn: () => backend.task(id),
    enabled: visible,
  });
  return (
    <div ref={ref} className="task-meeting">
      {q.data?.originMeetingId ? (
        <Link to={`../meetings/${q.data.originMeetingId}`}>
          No.{number} ·{' '}
          {meetings.find((m) => m.id === q.data?.originMeetingId)?.title ||
            '원본 회의'}
        </Link>
      ) : q.isError ? (
        <button onClick={() => void q.refetch()}>회의 연결 재조회</button>
      ) : q.data ? (
        <span>직접 추가한 업무</span>
      ) : (
        <span>회의 연결 확인 중</span>
      )}
    </div>
  );
}
