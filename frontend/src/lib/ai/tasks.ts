import { TaskDefinition } from './types';
import { RepositoryEvidencePackage } from '../github/types';
import {
  ProjectRepositoryContextOutput,
  REPOSITORY_CONTEXT_SCHEMA_VERSION,
  validateProjectRepositoryContext,
} from './schemas/repository-context';
import {
  buildRepositoryContextPrompt,
  REPOSITORY_CONTEXT_PROMPT_VERSION,
} from './prompts/repository-context';

export const projectRepositoryContextTask: TaskDefinition<
  RepositoryEvidencePackage,
  ProjectRepositoryContextOutput
> = {
  name: 'project.repository_context',
  description: 'Analyzes repository evidence package to generate structured project context',
  promptVersion: REPOSITORY_CONTEXT_PROMPT_VERSION,
  schemaVersion: REPOSITORY_CONTEXT_SCHEMA_VERSION,
  buildPrompt: buildRepositoryContextPrompt,
  validateOutput: validateProjectRepositoryContext,
};

export const AI_TASK_REGISTRY = {
  'project.repository_context': projectRepositoryContextTask,
} as const;

export type SupportedAITaskName = keyof typeof AI_TASK_REGISTRY;

export function getAITask(taskName: string): TaskDefinition<any, any> | null {
  return (AI_TASK_REGISTRY as Record<string, TaskDefinition<any, any>>)[taskName] || null;
}
