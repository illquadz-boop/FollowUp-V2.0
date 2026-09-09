'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Users,
  Settings,
  Plus,
  ChevronRight,
  ChevronDown,
  FileText,
  TrendingUp,
  Clock,
  AlertTriangle,
  LogOut,
  UserCircle2,
  Folder,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getRepository, isDemo } from '@/lib/api';
import { summarize, ProjectInputSchema, type User } from '@/lib/contracts';
import { ProjectContext, useProject, useIdentity } from './data';
import {
  Header,
  Btn,
  Loading,
  ErrorState,
  Card,
  Avatar,
  DueBadge,
  EmptyState,
  MemberPicker,
  Modal,
  Field,
  ConfirmDialog,
  useAction,
} from './ui';
import { Logo } from './landing';
import { ProfileDialog } from './account';
import { TaskModal } from './tasks';
import { ProjectTools } from './webmcp';

export function ProjectShell() {
  const { projectId = '' } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const user = useIdentity().data!;
  const api = getRepository();
  const action = useAction();
  const [profile, setProfile] = useState(false);
  const p = useQuery({
    queryKey: ['followup', user.id, 'project', projectId],
    queryFn: () => api.project(projectId),
  });
  const meetings = useQuery({
    queryKey: ['followup', user.id, 'meetings', projectId],
    queryFn: () => api.meetings(projectId),
  });
  const tasks = useQuery({
    queryKey: ['followup', user.id, 'tasks', projectId],
    queryFn: () => api.tasks(projectId),
  });
  const users = useQuery({
    queryKey: ['followup', user.id, 'users'],
    queryFn: () => api.users(),
  });
  const items = [
    { key: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    { key: 'meetings', label: '회의', icon: Calendar },
    { key: 'tasks', label: '후속 업무', icon: CheckSquare },
    { key: 'members', label: '구성원', icon: Users },
    { key: 'settings', label: '설정', icon: Settings },
  ];
  const active = location.pathname.split('/')[3] || 'dashboard';
  const error = p.error || meetings.error || tasks.error || users.error;
  if (error)
    return (
      <main className="page-container">
        <Btn secondary onClick={() => void nav('/start')}>
          프로젝트 목록
        </Btn>
        <ErrorState
          error={error}
          retry={() => {
            void p.refetch();
            void meetings.refetch();
            void tasks.refetch();
            void users.refetch();
          }}
        />
      </main>
    );
  if (!p.data || !meetings.data || !tasks.data || !users.data)
    return (
      <main className="page-container">
        <Loading text="팀의 작업 공간을 불러오고 있어요" />
      </main>
    );
  return (
    <ProjectContext.Provider
      value={{
        project: p.data,
        meetings: meetings.data,
        tasks: tasks.data,
        users: users.data,
        members: users.data.filter((u) => p.data.memberIds.includes(u.id)),
        user,
        api,
      }}
    >
      <ProjectTools />
      <div className="app-shell">
        <Tabs
          value={active}
          onValueChange={(v) => void nav(`/p/${projectId}/${v}`)}
        >
          <header className="app-nav">
            <Link
              to={`/w/${p.data.workspaceId}/projects`}
              className="app-logo"
              aria-label="프로젝트 목록"
            >
              <Logo symbol />
            </Link>
            <span className="nav-divider" />
            <TabsList className="nav-tabs">
              {items.map((it) => (
                <TabsTrigger className="nav-tab" key={it.key} value={it.key}>
                  <it.icon size={15} />
                  <span>{it.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="app-nav-right">
              {isDemo && (
                <span className="demo-pill">
                  <i />
                  체험 모드
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="user-dropdown"
                  aria-label="사용자 메뉴"
                >
                  <Avatar user={user} />
                  <ChevronDown size={12} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="user-menu">
                  <DropdownMenuItem onClick={() => setProfile(true)}>
                    <UserCircle2 size={15} />내 정보
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void nav(`/w/${p.data.workspaceId}/projects`)
                    }
                  >
                    <Folder size={15} />
                    프로젝트 목록
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void nav('/workspaces')}>
                    <Layers size={15} />
                    워크스페이스
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      const ok = await action.run(async () => {
                        await api.logout();
                        return true;
                      });
                      if (ok) void nav('/login');
                    }}
                  >
                    <LogOut size={15} />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div className="project-strip">
            <Link to={`/w/${p.data.workspaceId}/projects`}>프로젝트</Link>
            <ChevronRight size={12} />
            <span>{p.data.name}</span>
            <div className="member-stack">
              {users.data
                .filter((u) => p.data.memberIds.includes(u.id))
                .slice(0, 4)
                .map((u) => (
                  <Avatar user={u} size="small" key={u.id} />
                ))}
            </div>
          </div>
          <TabsContent value={active} className="route-content">
            <Outlet />
          </TabsContent>
        </Tabs>
        <footer className="app-footer">
          <span>FollowUp</span>
          <span>
            {isDemo
              ? '이 브라우저에 자동 보관되는 체험 공간'
              : '회의에서 다음 행동으로'}
          </span>
        </footer>
      </div>
      {profile && (
        <ProfileDialog user={user} onClose={() => setProfile(false)} />
      )}
    </ProjectContext.Provider>
  );
}
export function Dashboard() {
  const { project, tasks, meetings, members } = useProject();
  const nav = useNavigate();
  const [taskId, setTaskId] = useState<string | null>(null);
  const stats = summarize(tasks, meetings, undefined, project.dueSoonDays);
  const root = `/p/${project.id}`;
  const latest = [...meetings]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, 3);
  return (
    <main className="page-container dashboard page-enter">
      <Header
        title="대시보드"
        subtitle={`${project.name} — 전체 진행 상황`}
        action={
          <Btn onClick={() => void nav(`${root}/meetings/new`)}>
            <Plus size={16} />새 회의
          </Btn>
        }
      />
      {!meetings.length && !tasks.length ? (
        <div className="onboarding">
          <div className="onboarding-icon">
            <Logo symbol />
          </div>
          <h2>
            첫 회의를 기록하고
            <br />
            다음 행동을 만들어보세요.
          </h2>
          <p>
            회의록을 작성하고, 분석 결과를 검토하면
            <br />
            팀의 업무가 이곳에 모여요.
          </p>
          <div className="onboarding-steps">
            {['회의록 작성', 'AI 분석', '후속 업무 확정'].map((s, i) => (
              <span key={s}>
                <b>0{i + 1}</b>
                {s}
              </span>
            ))}
          </div>
          <Btn onClick={() => void nav(`${root}/meetings/new`)}>
            <Plus size={16} />첫 회의 만들기
          </Btn>
          <button
            className="quiet-link"
            onClick={() => void nav(`${root}/members`)}
          >
            또는 구성원부터 초대하기 <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            {[
              {
                name: '전체 업무',
                n: stats.total,
                icon: CheckSquare,
                filter: '',
              },
              {
                name: '예정',
                n: stats.todo,
                icon: Clock,
                filter: '?status=TODO',
              },
              {
                name: '진행 중',
                n: stats.progress,
                icon: TrendingUp,
                filter: '?status=IN_PROGRESS',
              },
              {
                name: '완료',
                n: stats.done,
                icon: CheckSquare,
                filter: '?status=DONE',
              },
            ].map((s, i) => (
              <button
                key={s.name}
                className={`stat-card stat-${i}`}
                onClick={() => void nav(`${root}/tasks${s.filter}`)}
              >
                <div>
                  <span>{s.name}</span>
                  <s.icon size={17} />
                </div>
                <strong>
                  {s.n}
                  <span>건</span>
                </strong>
                <footer>
                  {i === 3 ? (
                    <span>
                      전체의{' '}
                      {stats.total
                        ? Math.round((stats.done / stats.total) * 100)
                        : 0}
                      % 완료
                    </span>
                  ) : (
                    <span>
                      {i === 0
                        ? '팀이 함께 만들어가는 일'
                        : i === 1
                          ? '다음 시작을 기다리고 있어요'
                          : '한 걸음씩 나아가는 중'}
                    </span>
                  )}
                  <ArrowUpRight size={13} />
                </footer>
              </button>
            ))}
          </div>
          <Card soft className="change-card">
            <div>
              <span className="card-eyebrow">지난 회의 이후 변화</span>
              <span className="change-date">
                {stats.since ? `${stats.since}부터` : '기록된 회의가 없어요'}
              </span>
            </div>
            <div className="changes">
              <span>
                <TrendingUp size={17} className="text-green" />
                완료된 업무 <b>+{stats.completedCount}</b>
              </span>
              <span>
                <Plus size={17} className="text-blue" />
                새로운 업무 <b>+{stats.newCount}</b>
              </span>
              <span>
                <AlertTriangle size={16} className="text-red" />
                지연된 업무 <b>+{stats.newlyOverdue}</b>
              </span>
            </div>
          </Card>
          <div className="dashboard-grid">
            <Card>
              <div className="card-title">
                <h2>마감 관리</h2>
                <button onClick={() => void nav(`${root}/tasks?due=soon`)}>
                  전체 보기 <ChevronRight size={13} />
                </button>
              </div>
              <div className="deadline-summary">
                <button onClick={() => void nav(`${root}/tasks?due=soon`)}>
                  <Clock size={14} />
                  마감 임박 <b>{stats.dueSoon.length}</b>
                </button>
                <button
                  className="text-red"
                  onClick={() => void nav(`${root}/tasks?due=overdue`)}
                >
                  <AlertTriangle size={14} />
                  지연 <b>{stats.overdue.length}</b>
                </button>
              </div>
              <div className="deadline-list">
                {[...stats.overdue, ...stats.dueSoon].slice(0, 4).map((t) => (
                  <button
                    className="deadline-row"
                    key={t.id}
                    onClick={() => setTaskId(t.id)}
                  >
                    <Avatar user={members.find((m) => m.id === t.assigneeId)} />
                    <div>
                      <b>{t.title}</b>
                      <span>
                        {members.find((m) => m.id === t.assigneeId)?.name ||
                          '담당자 미지정'}
                      </span>
                    </div>
                    <DueBadge
                      date={t.dueDate}
                      status={t.status}
                      threshold={project.dueSoonDays}
                    />
                  </button>
                ))}
                {!stats.dueSoon.length && !stats.overdue.length && (
                  <EmptyState
                    title="급한 업무가 없어요"
                    description="다음 업무를 차근차근 진행해보세요."
                  />
                )}
              </div>
            </Card>
            <Card>
              <div className="card-title">
                <h2>최근 회의</h2>
                <button onClick={() => void nav(`${root}/meetings`)}>
                  전체 보기 <ChevronRight size={13} />
                </button>
              </div>
              <div className="recent-meetings">
                {latest.map((m) => (
                  <Link
                    to={`${root}/meetings/${m.id}`}
                    className="recent-row"
                    key={m.id}
                  >
                    <span className="file-icon">
                      <FileText size={18} />
                    </span>
                    <div>
                      <b>{m.title}</b>
                      <span>
                        {m.date} · 후속 업무{' '}
                        {tasks.filter((t) => t.meetingId === m.id).length}건
                      </span>
                    </div>
                    <ChevronRight size={15} />
                  </Link>
                ))}
              </div>
              {!latest.length && <EmptyState title="기록된 회의가 없어요" />}
              <button
                className="new-meeting-quiet"
                onClick={() => void nav(`${root}/meetings/new`)}
              >
                <Plus size={15} /> 다음 회의 기록하기
              </button>
            </Card>
          </div>
          <Card className="member-progress-card">
            <div className="card-title">
              <h2>담당자별 진행률</h2>
              <span>{members.length}명의 팀원</span>
            </div>
            {members.map((m) => {
              const mine = tasks.filter((t) => t.assigneeId === m.id);
              const done = mine.filter((t) => t.status === 'DONE').length;
              const pct = mine.length
                ? Math.round((done / mine.length) * 100)
                : 0;
              return (
                <button
                  className="member-progress-row"
                  key={m.id}
                  onClick={() => void nav(`${root}/tasks?assignee=${m.id}`)}
                >
                  <Avatar user={m} />
                  <div className="progress-person">
                    <b>{m.name}</b>
                    <span>{m.role}</span>
                  </div>
                  <Progress
                    value={pct}
                    aria-label={`${m.name} 업무 완료율`}
                    className="member-progress"
                  />
                  <span className="progress-fraction">
                    {done}/{mine.length}
                  </span>
                  <b>{pct}%</b>
                  <ChevronRight size={13} />
                </button>
              );
            })}
          </Card>
        </>
      )}
      {taskId && tasks.find((t) => t.id === taskId) && (
        <TaskModal
          task={tasks.find((t) => t.id === taskId)}
          onClose={() => setTaskId(null)}
        />
      )}
    </main>
  );
}
export function Members() {
  const { project, tasks, members, users, user, api } = useProject();
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [remove, setRemove] = useState<User | null>(null);
  const a = useAction();
  const available = users.filter((u) => !project.memberIds.includes(u.id));
  const owner = project.ownerId === user.id;
  return (
    <main className="page-container medium page-enter">
      <Header
        title="구성원"
        subtitle="각자의 역할이 하나의 팀으로 이어져요."
        action={
          owner && (
            <Btn onClick={() => setShow(true)}>
              <Plus size={16} />
              구성원 추가
            </Btn>
          )
        }
      />
      <div className="list-stack">
        {members.map((m) => {
          const mine = tasks.filter((t) => t.assigneeId === m.id);
          const done = mine.filter((t) => t.status === 'DONE').length;
          return (
            <div className="member-row" key={m.id}>
              <Avatar user={m} size="large" />
              <div>
                <h3>
                  {m.name}
                  {m.id === project.ownerId && (
                    <span className="pill">관리자</span>
                  )}
                  {m.id === user.id && <span className="pill">나</span>}
                </h3>
                <p>
                  {m.role} · {m.email}
                </p>
              </div>
              <button
                className="member-task-link"
                onClick={() =>
                  void nav(`/p/${project.id}/tasks?assignee=${m.id}`)
                }
              >
                담당 업무 {mine.length}건<span>{done}건 완료</span>
              </button>
              {owner && m.id !== project.ownerId && (
                <button
                  className="icon-button"
                  aria-label={`${m.name} 구성원 제거`}
                  onClick={() => setRemove(m)}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {show && (
        <Modal
          title="구성원 추가"
          description="등록된 사용자를 이름 또는 이메일로 검색하세요. 초대 메일은 발송되지 않습니다."
          onClose={() => {
            setShow(false);
            setPending([]);
          }}
          wide
        >
          {available.length ? (
            <MemberPicker
              pool={available}
              selected={pending}
              onChange={setPending}
            />
          ) : (
            <EmptyState
              title="추가할 수 있는 구성원이 없어요"
              description={
                isDemo
                  ? '체험용 계정을 회원가입하면 디렉토리에 표시돼요.'
                  : '등록된 사용자 모두가 참여하고 있어요.'
              }
            />
          )}
          <div className="form-actions">
            <Btn secondary onClick={() => setShow(false)}>
              취소
            </Btn>
            <Btn
              busy={a.busy}
              disabled={!pending.length}
              onClick={async () => {
                const p = await a.run(
                  () => api.addMembers(project.id, pending),
                  `${pending.length}명의 구성원이 추가됐어요.`,
                );
                if (p) {
                  setShow(false);
                  setPending([]);
                }
              }}
            >
              {pending.length || ''}명 추가
            </Btn>
          </div>
        </Modal>
      )}
      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title={`${remove?.name || ''}님을 제거할까요?`}
        description="담당 중인 업무는 유지되며 담당자가 미지정으로 변경됩니다. 과거 회의 참여 기록은 남습니다."
        busy={a.busy}
        confirmLabel="구성원 제거"
        onConfirm={async () => {
          if (!remove) return;
          const p = await a.run(
            () => api.removeMember(project.id, remove.id),
            '구성원이 제거됐어요.',
          );
          if (p) setRemove(null);
        }}
      />
    </main>
  );
}
export function SettingsPage() {
  const { project, user, api } = useProject();
  const nav = useNavigate();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [days, setDays] = useState(project.dueSoonDays);
  const [remove, setRemove] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const a = useAction();
  const owner = user.id === project.ownerId;
  return (
    <main className="page-container form-page page-enter">
      <Header
        title="프로젝트 설정"
        subtitle="팀에 맞게 작업 공간을 관리하세요."
      />
      <Card>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await a.run(
              () =>
                api.updateProject(
                  project.id,
                  ProjectInputSchema.parse({
                    name,
                    description,
                    memberIds: project.memberIds,
                    dueSoonDays: days,
                  }),
                ),
              '프로젝트 설정이 저장됐어요.',
            );
          }}
        >
          <Field
            label="프로젝트명"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!owner}
          />
          <label className="field">
            프로젝트 설명
            <textarea
              className="fu-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              disabled={!owner}
            />
          </label>
          <Field
            label="마감 임박 기준 (일)"
            type="number"
            min={0}
            max={30}
            required
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            help="오늘부터 지정한 일수 이내의 미완료 업무를 표시해요."
            disabled={!owner}
          />
          <div>
            <Btn type="submit" busy={a.busy} disabled={!owner}>
              변경사항 저장
            </Btn>
          </div>
          {!owner && (
            <p className="field-help">
              프로젝트 관리자만 설정을 변경할 수 있어요.
            </p>
          )}
        </form>
      </Card>
      <Card className="danger-card">
        <h2>프로젝트 삭제</h2>
        <p>프로젝트와 모든 회의, 업무 기록을 삭제해요. 되돌릴 수 없어요.</p>
        <Btn secondary danger disabled={!owner} onClick={() => setRemove(true)}>
          프로젝트 삭제
        </Btn>
      </Card>
      <ConfirmDialog
        open={remove}
        onClose={() => setRemove(false)}
        title="프로젝트를 삭제할까요?"
        description={`확인을 위해 “${project.name}”을 입력해주세요. 연결된 회의와 업무도 모두 삭제됩니다.`}
        busy={a.busy}
        confirmDisabled={confirmName !== project.name}
        onConfirm={async () => {
          if (confirmName !== project.name) return;
          const ok = await a.run(async () => {
            await api.deleteProject(project.id);
            return true;
          }, '프로젝트가 삭제됐어요.');
          if (ok) void nav(`/w/${project.workspaceId}/projects`);
        }}
      >
        <Field
          label="프로젝트명 확인"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
      </ConfirmDialog>
    </main>
  );
}
