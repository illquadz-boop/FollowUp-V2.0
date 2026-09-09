'use client';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AppError, StatusSchema } from '@/lib/contracts';
import { useProject } from './data';
interface ModelContext {
  registerTool(
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export function ProjectTools() {
  const project = useProject();
  const ref = useRef(project);
  useEffect(() => {
    ref.current = project;
  }, [project]);
  const qc = useQueryClient();
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'list_followup_tasks',
        title: '프로젝트 업무 조회',
        description:
          '현재 로그인한 사용자의 선택된 프로젝트 업무를 조회합니다.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input: unknown) => {
          z.object({}).strict().parse(input);
          const { api, project: p } = ref.current;
          const tasks = await api.tasks(p.id);
          return {
            projectId: p.id,
            tasks: tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              assigneeId: t.assigneeId,
              dueDate: t.dueDate,
            })),
          };
        },
      },
      {
        name: 'update_followup_task_status',
        title: '업무 상태 변경',
        description:
          '현재 프로젝트의 지정한 업무를 예정, 진행 중, 완료로 변경하고 화면을 갱신합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
          },
          required: ['taskId', 'status'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const value = z
            .object({ taskId: z.string(), status: StatusSchema })
            .strict()
            .parse(input);
          const { api, project: p } = ref.current;
          const task = (await api.tasks(p.id)).find(
            (t) => t.id === value.taskId,
          );
          if (!task)
            throw new AppError('현재 프로젝트에 해당 업무가 없어요.', 404);
          const changed = await api.updateTask(task.id, {
            ...task,
            status: value.status,
          });
          await qc.invalidateQueries({ queryKey: ['followup'] });
          await new Promise((resolve) => requestAnimationFrame(resolve));
          return {
            id: changed.id,
            status: changed.status,
            completedAt: changed.completedAt,
          };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, [qc]);
  return null;
}
