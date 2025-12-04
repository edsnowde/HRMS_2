import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Users, Plus, Edit, Trash2, Search } from 'lucide-react';

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');

  const users = [
    { id: 1, name: 'John Smith', email: 'john@company.com', role: 'HR', status: 'Active' },
    { id: 2, name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Recruiter', status: 'Active' },
    { id: 3, name: 'Mike Chen', email: 'mike@company.com', role: 'Employee', status: 'Active' },
    { id: 4, name: 'Emma Wilson', email: 'emma@company.com', role: 'HR', status: 'Inactive' },
  ];

  return (
    <div className="min-h-screen relative">
      <AuroraBackground />
      
      <div className="relative z-10 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="text-muted-foreground mt-2">Manage system users and roles</p>
            </div>
            <GlassButton className="gap-2">
              <Plus className="w-4 h-4" />
              Add New User
            </GlassButton>
          </div>

          <GlassCard className="mb-6">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </GlassCard>

          <GlassCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-2">Name</th>
                    <th className="text-left py-4 px-2">Email</th>
                    <th className="text-left py-4 px-2">Role</th>
                    <th className="text-left py-4 px-2">Status</th>
                    <th className="text-left py-4 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-4 px-2">{user.name}</td>
                      <td className="py-4 px-2 text-muted-foreground">{user.email}</td>
                      <td className="py-4 px-2">
                        <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-2">
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          user.status === 'Active' 
                            ? 'bg-accent/20 text-accent' 
                            : 'bg-destructive/20 text-destructive'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex gap-2">
                          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:bg-destructive/20 rounded-lg transition-colors text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
