'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  ArrowUpRight,
  ChevronRight,
  LogOut,
  Folder,
  Users,
  ArrowLeft,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';
import { getRepository, isDemo } from '@/lib/api';
import {
  LoginSchema,
  SignupSchema,
  ProjectInputSchema,
  type ProjectInput,
  type User,
} from '@/lib/contracts';
import {
  Btn,
  Field,
  Header,
  Back,
  Avatar,
  Modal,
  MemberPicker,
  Loading,
  ErrorState,
  EmptyState,
  useAction,
} from './ui';
import { Logo } from './landing';
import { useIdentity, useDirectory, useWorkspaces } from './data';

export function Auth({ signup = false }: { signup?: boolean }) {
  const nav = useNavigate();
  const api = getRepository();
  const action = useAction();
  const [show, setShow] = useState(false);
  const identity = useIdentity();
  const form = useForm({
    resolver: zodResolver(
      signup ? SignupSchema : LoginSchema.extend({ name: z.string() }),
    ),
    defaultValues: { name: '', email: '', password: '' },
  });
  if (identity.data) return <Navigate to="/start" replace />;
  const submit = form.handleSubmit(async (values) => {
    const result = await action.run(
      () =>
        signup
          ? api.signup({
              name: values.name || '',
              email: values.email,
              password: values.password,
            })
          : api.login(values),
      signup ? '계정이 만들어졌어요. 로그인해주세요.' : undefined,
    );
    if (result) void nav(signup ? '/login' : '/start');
  });
  return (
    <div className="auth-page">
      <div className="auth-top">
        <Link to="/" aria-label="FollowUp 홈">
          <Logo />
        </Link>
        <Link to="/" className="quiet-link">
          <ArrowLeft size={14} /> 홈으로
        </Link>
      </div>
      <main className="auth-content page-enter">
        <div className="auth-symbol">
          <Logo symbol />
        </div>
        <h1>{signup ? '계정 만들기' : '다시 만나서 반가워요'}</h1>
        <p>
          {signup
            ? '팀의 회의를 다음 행동으로 이어보세요.'
            : '회의가 끝나도, 일은 계속 이어져요.'}
        </p>
        <form onSubmit={submit} className="form-stack" noValidate>
          {signup && (
            <Field
              label="이름"
              placeholder="홍길동"
              autoComplete="name"
              {...form.register('name')}
              error={
                'name' in form.formState.errors
                  ? (form.formState.errors.name?.message as string)
                  : undefined
              }
            />
          )}
          <Field
            label="이메일"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...form.register('email')}
            error={form.formState.errors.email?.message}
          />
          <div className="password-field">
            <Field
              label="비밀번호"
              type={show ? 'text' : 'password'}
              placeholder={
                signup ? '8자 이상 입력해주세요' : '비밀번호를 입력해주세요'
              }
              autoComplete={signup ? 'new-password' : 'current-password'}
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />
            <button
              className="password-toggle"
              type="button"
              aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {action.error ? <ErrorState error={action.error} /> : null}
          <Btn type="submit" busy={action.busy}>
            {signup ? '회원가입' : '로그인'}
            <ArrowUpRight size={16} />
          </Btn>
        </form>
        <p className="auth-switch">
          {signup ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}{' '}
          <Link to={signup ? '/login' : '/signup'}>
            {signup ? '로그인' : '회원가입'}
          </Link>
        </p>
        {isDemo && (
          <div className="auth-demo">
            <div className="or-divider">
              <span>먼저 경험해보세요</span>
            </div>
            <Btn
              secondary
              busy={action.busy}
              onClick={async () => {
                const u = await action.run(() => api.demoLogin());
                if (u) void nav('/p/p-followup/dashboard');
              }}
            >
              데모 워크스페이스 둘러보기 <ChevronRight size={15} />
            </Btn>
            <p>
              이 브라우저에만 저장되는 체험 모드입니다.
              <br />
              실제 AI 분석은 백엔드 연결 후 사용할 수 있어요.
            </p>
          </div>
        )}
      </main>
      <footer className="auth-footer">© 2026 FollowUp</footer>
    </div>
  );
}
export function GlobalHeader() {
  const nav = useNavigate();
  const user = useIdentity().data;
  const a = useAction();
  const [profile, setProfile] = useState(false);
  return (
    <>
      <header className="global-header">
        <Link to="/start">
          <Logo />
        </Link>
        <div>
          <Link to="/workspaces" className="quiet-link">
            <Layers size={15} /> 워크스페이스
          </Link>
          {user && (
            <button className="user-link" onClick={() => setProfile(true)}>
              <Avatar user={user} />
              <span>{user.name}</span>
            </button>
          )}
          <button
            className="quiet-link"
            disabled={a.busy}
            onClick={async () => {
              const ok = await a.run(async () => {
                await getRepository().logout();
                return true;
              });
              if (ok) void nav('/login');
            }}
          >
            <LogOut size={15} />
            <span>로그아웃</span>
          </button>
        </div>
      </header>
      {profile && user && (
        <ProfileDialog user={user} onClose={() => setProfile(false)} />
      )}
    </>
  );
}
export function ProfileDialog({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const a = useAction();
  return (
    <Modal
      title="내 정보"
      description="팀에서 사용하는 이름과 역할을 관리하세요."
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const u = await a.run(
            () => getRepository().updateProfile({ name, role }),
            '내 정보가 저장됐어요.',
          );
          if (u) onClose();
        }}
      >
        <Field
          label="이름"
          value={name}
          minLength={2}
          maxLength={30}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <Field label="이메일" value={user.email} readOnly />
        <Field
          label="역할"
          value={role}
          maxLength={50}
          onChange={(e) => setRole(e.target.value)}
        />
        <Btn type="submit" busy={a.busy}>
          변경사항 저장
        </Btn>
      </form>
    </Modal>
  );
}
export function Start() {
  const ws = useWorkspaces();
  if (ws.isPending) return <Loading />;
  if (ws.error)
    return <ErrorState error={ws.error} retry={() => ws.refetch()} />;
  return (
    <Navigate
      to={ws.data.length === 1 ? `/w/${ws.data[0].id}/projects` : '/workspaces'}
      replace
    />
  );
}
export function Workspaces() {
  const ws = useWorkspaces();
  const nav = useNavigate();
  const a = useAction();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  return (
    <>
      <GlobalHeader />
      <main className="page-container narrow page-enter">
        <Header
          title="워크스페이스"
          subtitle="함께 일할 공간을 선택하세요."
          action={
            <Btn onClick={() => setAdding(true)}>
              <Plus size={16} />새 워크스페이스
            </Btn>
          }
        />
        {ws.isPending ? (
          <Loading />
        ) : ws.error ? (
          <ErrorState error={ws.error} retry={() => ws.refetch()} />
        ) : ws.data.length ? (
          <div className="list-stack">
            {ws.data.map((w) => (
              <Link
                className="workspace-row"
                to={`/w/${w.id}/projects`}
                key={w.id}
              >
                <div className="workspace-icon">
                  <Layers size={23} />
                </div>
                <div>
                  <h3>{w.name}</h3>
                  <p>프로젝트와 회의를 함께 관리하는 공간</p>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="첫 워크스페이스를 만들어보세요"
            action={
              <Btn onClick={() => setAdding(true)}>워크스페이스 만들기</Btn>
            }
          />
        )}
      </main>
      {adding && (
        <Modal
          title="새 워크스페이스"
          description="팀의 프로젝트를 한 공간에 모아보세요."
          onClose={() => setAdding(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const w = await a.run(
                () => getRepository().createWorkspace(name),
                '워크스페이스가 만들어졌어요.',
              );
              if (w) {
                setAdding(false);
                void nav(`/w/${w.id}/projects`);
              }
            }}
          >
            <Field
              label="워크스페이스 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: FollowUp 팀"
              required
              maxLength={80}
            />
            <Btn type="submit" busy={a.busy}>
              생성
            </Btn>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Projects() {
  const { workspaceId = '' } = useParams();
  const api = getRepository();
  const user = useIdentity().data!;
  const projects = useQuery({
    queryKey: ['followup', user.id, 'projects', workspaceId],
    queryFn: () => api.projects(workspaceId),
  });
  const ws = useWorkspaces();
  const name = ws.data?.find((w) => w.id === workspaceId)?.name;
  return (
    <>
      <GlobalHeader />
      <main className="page-container narrow page-enter">
        <div className="workspace-breadcrumb">
          <Layers size={14} />
          <Link to="/workspaces">{name || '워크스페이스'}</Link>
          <ChevronRight size={13} />
          프로젝트
        </div>
        <Header
          title="프로젝트"
          subtitle="참여 중인 프로젝트를 선택하세요."
          action={
            <Link to={`/w/${workspaceId}/projects/new`} className="link-button">
              <Btn>
                <Plus size={16} />새 프로젝트
              </Btn>
            </Link>
          }
        />
        {projects.isPending ? (
          <Loading />
        ) : projects.error ? (
          <ErrorState error={projects.error} retry={() => projects.refetch()} />
        ) : projects.data.length ? (
          <div className="list-stack">
            {projects.data.map((p, i) => (
              <Link
                to={`/p/${p.id}/dashboard`}
                className="project-row"
                key={p.id}
              >
                <div className={`project-tile tile-${i % 3}`}>
                  <Folder size={24} />
                </div>
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.description || '아직 설명이 없어요.'}</p>
                  <div className="project-meta">
                    <Users size={13} />
                    {p.memberIds.length}명 <span>·</span>
                    {new Intl.DateTimeFormat('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                    }).format(new Date(p.updatedAt))}{' '}
                    활동
                  </div>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="첫 프로젝트를 시작해보세요"
            description="회의와 후속 업무를 한곳에서 관리할 수 있어요."
            action={
              <Link to={`/w/${workspaceId}/projects/new`}>
                <Btn>
                  <Plus size={16} />
                  프로젝트 만들기
                </Btn>
              </Link>
            }
          />
        )}
        <div className="workspace-footnote">
          <Logo symbol />
          <span>하나의 대화가 다음 행동으로 이어지는 공간.</span>
        </div>
      </main>
    </>
  );
}
export function CreateProject() {
  const { workspaceId = '' } = useParams();
  const nav = useNavigate();
  const users = useDirectory();
  const user = useIdentity().data!;
  const a = useAction();
  const form = useForm<ProjectInput>({
    resolver: zodResolver(ProjectInputSchema),
    defaultValues: { name: '', description: '', memberIds: [user.id] },
  });
  const selected = form.watch('memberIds');
  const submit = form.handleSubmit(async (v) => {
    const p = await a.run(
      () => getRepository().createProject(workspaceId, v),
      '프로젝트가 만들어졌어요.',
    );
    if (p) void nav(`/p/${p.id}/dashboard`);
  });
  return (
    <>
      <GlobalHeader />
      <main className="page-container form-page page-enter">
        <Back onClick={() => void nav(`/w/${workspaceId}/projects`)}>
          프로젝트 목록
        </Back>
        <Header
          title="새 프로젝트"
          subtitle="회의와 후속 업무를 함께 관리할 공간을 만들어요."
        />
        <form className="form-stack" onSubmit={submit}>
          <Field
            label="프로젝트명"
            placeholder="예: FollowUp 팀 프로젝트"
            {...form.register('name')}
            error={form.formState.errors.name?.message}
          />
          <label className="field">
            설명
            <textarea
              className="fu-textarea"
              {...form.register('description')}
              placeholder="이 프로젝트가 무엇을 위한 것인지 적어주세요."
              maxLength={1000}
            />
          </label>
          <div className="field">
            <span>구성원 초대</span>
            <p className="field-help">
              이름이나 이메일로 구성원을 검색해 추가하세요.
            </p>
            {users.isPending ? (
              <Loading />
            ) : users.error ? (
              <ErrorState error={users.error} retry={() => users.refetch()} />
            ) : (
              <MemberPicker
                pool={users.data}
                selected={selected}
                locked={[user.id]}
                onChange={(v) => form.setValue('memberIds', v)}
              />
            )}
          </div>
          <div className="form-actions">
            <Btn secondary type="button" onClick={() => void nav(-1)}>
              취소
            </Btn>
            <Btn type="submit" busy={a.busy} disabled={!selected.length}>
              <Plus size={15} />
              생성
            </Btn>
          </div>
        </form>
      </main>
    </>
  );
}
export function usePageMotion() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    document
      .querySelectorAll('.feature-card,.how-step,.price-card,.cta-inner')
      .forEach((el) => {
        el.classList.add('reveal-ready');
        observer.observe(el);
      });
    return () => observer.disconnect();
  }, []);
}
