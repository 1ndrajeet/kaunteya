'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { Loader2 } from 'lucide-react';

export default function WorkspaceIndexPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.workspaceId;
  const router = useRouter();
  const { role } = useWorkspace();

  useEffect(() => {
    if (role === 'admin') {
      router.replace(`/workspace/${workspaceId}/admin`);
    } else if (role === 'lead') {
      router.replace(`/workspace/${workspaceId}/lead`);
    } else if (role === 'member') {
      router.replace(`/workspace/${workspaceId}/member`);
    } else {
      router.replace(`/workspace/${workspaceId}/tasks`);
    }
  }, [role, router, workspaceId]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-500 gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      <span className="text-xs font-mono">Routing to role dashboard...</span>
    </div>
  );
}
