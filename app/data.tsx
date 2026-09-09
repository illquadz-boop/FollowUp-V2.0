'use client';
import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRepository } from '@/lib/api';
import type { User, Project, Task, Meeting } from '@/lib/contracts';
import type { Repository } from '@/lib/repository';
export function useIdentity() {
  const api = getRepository();
  return useQuery({
    queryKey: ['followup', 'me'],
    queryFn: () => api.me(),
    retry: false,
  });
}
export function useDirectory() {
  const api = getRepository();
  const user = useIdentity().data;
  return useQuery({
    queryKey: ['followup', user?.id, 'users'],
    queryFn: () => api.users(),
    enabled: !!user,
  });
}
export function useWorkspaces() {
  const api = getRepository();
  const user = useIdentity().data;
  return useQuery({
    queryKey: ['followup', user?.id, 'workspaces'],
    queryFn: () => api.workspaces(),
    enabled: !!user,
  });
}
export interface ProjectContextType {
  project: Project;
  tasks: Task[];
  meetings: Meeting[];
  members: User[];
  users: User[];
  user: User;
  api: Repository;
}
export const ProjectContext = createContext<ProjectContextType | null>(null);
export function useProject() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error('프로젝트를 먼저 선택해주세요.');
  return value;
}
