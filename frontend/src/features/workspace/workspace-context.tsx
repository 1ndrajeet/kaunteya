'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { WorkspaceRole } from '@/types/database';

export interface WorkspaceContextType {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: WorkspaceRole | null;
  user: User | null;
  isCreateTaskOpen: boolean;
  setIsCreateTaskOpen: (open: boolean) => void;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}

export { WorkspaceContext };
