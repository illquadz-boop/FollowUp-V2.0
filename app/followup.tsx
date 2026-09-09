'use client';
import {
  Component,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
  Outlet,
  Link,
} from 'react-router-dom';
import { Toaster } from '@/components/ui/toast';
import { getRepository, isDemo } from '@/lib/api';
import { AppError } from '@/lib/contracts';
import { Landing } from './landing';
import {
  Auth,
  Projects,
  CreateProject,
  Workspaces,
  Start,
  usePageMotion,
} from './account';
import { ProjectShell, Dashboard, Members, SettingsPage } from './project';
import { MeetingList, MeetingDetail, MeetingEditorRoute } from './meetings';
import { TaskBoard } from './tasks';
import { useIdentity } from './data';
import { Loading, ErrorState, EmptyState, Btn, useAction } from './ui';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="page-container">
        <ErrorState
          error={
            new AppError(
              '화면을 불러오지 못했어요. 다시 열어주세요. 저장된 데이터는 유지돼요.',
            )
          }
          retry={() => window.location.reload()}
        />
      </main>
    ) : (
      this.props.children
    );
  }
}
function Guard() {
  const user = useIdentity();
  const loc = useLocation();
  if (user.isPending)
    return (
      <main className="page-container">
        <Loading />
      </main>
    );
  if (user.error)
    return (
      <main className="page-container">
        <ErrorState error={user.error} retry={() => user.refetch()} />
      </main>
    );
  return user.data ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: loc.pathname }} />
  );
}
function LandingRoute() {
  const nav = useNavigate();
  const a = useAction();
  usePageMotion();
  return (
    <Landing
      onLogin={() => void nav('/login')}
      onSignup={() => void nav('/signup')}
      onDemo={async () => {
        if (!isDemo) {
          void nav('/login');
          return;
        }
        const u = await a.run(() => getRepository().demoLogin());
        if (u) void nav('/p/p-followup/dashboard');
      }}
    />
  );
}
function Routing() {
  const nav = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const titles: Record<string, string> = {
      login: '로그인',
      signup: '회원가입',
      dashboard: '대시보드',
      meetings: '회의',
      tasks: '후속 업무',
      members: '구성원',
      settings: '설정',
      workspaces: '워크스페이스',
      projects: '프로젝트',
    };
    const key = location.pathname.split('/').findLast((s) => s in titles);
    document.title = key
      ? `${titles[key]} · FollowUp`
      : 'FollowUp — 회의에서 다음 행동으로';
  }, [location.pathname]);
  useEffect(() => {
    const expired = () => {
      qc.clear();
      void nav('/login', { replace: true });
    };
    const storage = (e: StorageEvent) => {
      if (e.key === 'followup.demo.v1')
        void qc.invalidateQueries({ queryKey: ['followup'] });
    };
    window.addEventListener('followup:unauthorized', expired);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('followup:unauthorized', expired);
      window.removeEventListener('storage', storage);
    };
  }, [qc, nav]);
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<Auth key="login" />} />
      <Route path="/signup" element={<Auth key="signup" signup />} />
      <Route element={<Guard />}>
        <Route path="/start" element={<Start />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/w/:workspaceId/projects" element={<Projects />} />
        <Route
          path="/w/:workspaceId/projects/new"
          element={<CreateProject />}
        />
        <Route path="/p/:projectId" element={<ProjectShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="meetings" element={<MeetingList />} />
          <Route path="meetings/new" element={<MeetingEditorRoute />} />
          <Route path="meetings/:meetingId" element={<MeetingDetail />} />
          <Route
            path="meetings/:meetingId/edit"
            element={<MeetingEditorRoute />}
          />
          <Route path="tasks" element={<TaskBoard />} />
          <Route path="members" element={<Members />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <main className="page-container">
            <EmptyState
              title="페이지를 찾을 수 없어요"
              action={
                <Link to="/start">
                  <Btn>작업 공간으로</Btn>
                </Link>
              }
            />
          </main>
        }
      />
    </Routes>
  );
}
const subscribeHydration = () => () => {};
export default function FollowUpApp() {
  const ready = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15000,
            refetchOnWindowFocus: true,
            retry: (count, error) =>
              count < 1 &&
              (!(error instanceof AppError) || error.status >= 500),
          },
          mutations: { retry: false },
        },
      }),
  );
  if (!ready)
    return (
      <Landing
        onLogin={() => {
          window.location.hash = '/login';
        }}
        onSignup={() => {
          window.location.hash = '/signup';
        }}
        onDemo={() => {
          window.location.hash = '/login';
        }}
      />
    );
  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <Toaster>
          <HashRouter>
            <Routing />
          </HashRouter>
        </Toaster>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
