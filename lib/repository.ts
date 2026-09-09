import type {
  User,
  Workspace,
  Project,
  ProjectInput,
  Meeting,
  MeetingInput,
  Task,
  TaskInput,
  Draft,
} from './contracts';

export interface Repository {
  me(): Promise<User | null>;
  signup(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<User>;
  login(input: { email: string; password: string }): Promise<User>;
  demoLogin(): Promise<User>;
  logout(): Promise<void>;
  updateProfile(input: { name: string; role: string }): Promise<User>;
  users(): Promise<User[]>;
  workspaces(): Promise<Workspace[]>;
  createWorkspace(name: string): Promise<Workspace>;
  projects(workspaceId: string): Promise<Project[]>;
  project(id: string): Promise<Project>;
  createProject(workspaceId: string, input: ProjectInput): Promise<Project>;
  updateProject(id: string, input: ProjectInput): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  addMembers(id: string, ids: string[]): Promise<Project>;
  removeMember(id: string, userId: string): Promise<Project>;
  meetings(projectId: string): Promise<Meeting[]>;
  createMeeting(projectId: string, input: MeetingInput): Promise<Meeting>;
  updateMeeting(id: string, input: MeetingInput): Promise<Meeting>;
  deleteMeeting(id: string): Promise<void>;
  analyzeMeeting(id: string): Promise<Meeting>;
  saveDraft(id: string, draft: Draft): Promise<Meeting>;
  confirmMeeting(id: string, draft: Draft): Promise<Meeting>;
  tasks(projectId: string): Promise<Task[]>;
  createTask(projectId: string, input: TaskInput): Promise<Task>;
  updateTask(id: string, input: TaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
}
