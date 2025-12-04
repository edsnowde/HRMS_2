import React, { useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { RoleSidebar } from '@/components/RoleSidebar';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  userEmail: string;
  details: string;
  resourceType: string;
  resourceId: string;
}

export default function AuditLogs() {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['auditLogs', filter, page],
    queryFn: async () => {
      return apiClient.getAuditLogs({
        filter,
        page,
        limit: 20,
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <RoleSidebar />
      
      <main className="p-8 md:pr-72">
        <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>

        <div className="space-y-6">
          <div className="flex gap-4 mb-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="glass px-4 py-2 rounded-lg"
            >
              <option value="all">All Actions</option>
              <option value="auth">Authentication</option>
              <option value="user">User Management</option>
              <option value="job">Job Postings</option>
              <option value="application">Applications</option>
              <option value="screening">AI Screening</option>
            </select>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Resource</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center">
                        Loading...
                      </td>
                    </tr>
                  ) : logs?.items?.length ? (
                    logs.items.map((log: AuditLog) => (
                      <tr key={log.id} className="hover:bg-accent/5">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{log.action}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{log.userEmail}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {log.resourceType} {log.resourceId}
                        </td>
                        <td className="px-6 py-4 text-sm">{log.details}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-muted-foreground">
                        No audit logs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {logs?.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-border/50 flex justify-between items-center">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 glass rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {logs.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(logs.totalPages, p + 1))}
                  disabled={page === logs.totalPages}
                  className="px-4 py-2 glass rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </GlassCard>
        </div>
      </main>
    </div>
  );
}