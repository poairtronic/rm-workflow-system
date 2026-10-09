import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { userMasterApi } from '../services/userMaster.service';
import type {
  UserMasterDto,
  CreateUserMasterDto,
  UserRoleType,
} from '../types/user-master.dto';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  ConfirmDialog,
  FormField,
  TextInput,
  Select,
  Checkbox,
  Button,
} from '../components/ui';
import type { ColumnDef } from '../components/ui';
import { Plus, Shield, Mail, Calendar, ArrowLeft, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

const SYSTEM_ROLES: { value: UserRoleType; label: string; desc: string }[] = [
  { value: 'ADMIN', label: 'Admin', desc: 'Full administrative access and user management' },
  { value: 'DESIGNER', label: 'Designer', desc: 'Creates RM requisitions and specs' },
  { value: 'STORES', label: 'Stores Manager', desc: 'Manages inventory, material issues, and DCs' },
  { value: 'PRODUCTION', label: 'Production Operator', desc: 'Receives and consumes materials' },
  { value: 'SENIOR_MANAGER', label: 'Senior Manager', desc: 'Monitors operations, SLAs, and reports' },
  { value: 'GENERAL_MANAGER', label: 'General Manager', desc: 'Executive governance, SLAs, and master writes' },
];

export function UserMasterWorkspace() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserMasterDto>({
    name: '',
    email: '',
    role: 'STORES',
    department: '',
    isActive: true,
  });

  // Active Toggle Confirmation State
  const [toggleUserTarget, setToggleUserTarget] = useState<UserMasterDto | null>(null);

  // Role Change Confirmation State
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    user: UserMasterDto;
    newRole: UserRoleType;
  } | null>(null);

  // Reset Password Confirmation State
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserMasterDto | null>(null);

  // Fetch Users
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users-master'],
    queryFn: () => userMasterApi.getAll(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateUserMasterDto) => userMasterApi.create(dto),
    onSuccess: (newUser) => {
      toast.success(`User "${newUser.name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: ['users-master'] });
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create user');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive?: boolean }) =>
      userMasterApi.toggleActive(id, isActive),
    onSuccess: (updated) => {
      toast.success(
        `User "${updated.name}" is now ${updated.isActive ? 'Active' : 'Inactive'}`,
      );
      queryClient.invalidateQueries({ queryKey: ['users-master'] });
      setToggleUserTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update user status');
      setToggleUserTarget(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRoleType }) =>
      userMasterApi.updateRole(id, role),
    onSuccess: (updated) => {
      toast.success(`Role for "${updated.name}" updated to ${updated.role?.name || ''}`);
      queryClient.invalidateQueries({ queryKey: ['users-master'] });
      setRoleChangeTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update user role');
      setRoleChangeTarget(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => userMasterApi.resetPassword(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Password reset successfully');
      queryClient.invalidateQueries({ queryKey: ['users-master'] });
      setResetPasswordTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to reset password');
      setResetPasswordTarget(null);
    },
  });

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      email: '',
      role: 'STORES',
      department: '',
      isActive: true,
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast.error('Name and Email are required');
      return;
    }

    createMutation.mutate({
      name: createForm.name.trim(),
      email: createForm.email.trim().toLowerCase(),
      role: createForm.role,
      department: createForm.department?.trim() || undefined,
      isActive: createForm.isActive,
    });
  };

  const isCurrentAdmin = (targetUser: UserMasterDto) => {
    return (
      currentUser?.id === targetUser.id ||
      currentUser?.email?.toLowerCase() === targetUser.email.toLowerCase()
    );
  };

  const columns: ColumnDef<UserMasterDto>[] = [
    {
      key: 'name',
      header: 'User / Department',
      sortable: true,
      render: (u) => (
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-gray-900">{u.name}</span>
            {isCurrentAdmin(u) && (
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                YOU
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {u.department || <span className="italic text-gray-400">No Department</span>}
          </span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email Address',
      sortable: true,
      render: (u) => (
        <div className="flex items-center text-sm text-gray-700">
          <Mail className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
          <span>{u.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      sortable: true,
      render: (u) => {
        const roleName = (u.role?.name || 'DESIGNER') as UserRoleType;
        return (
          <div className="flex items-center space-x-2">
            <StatusBadge status={roleName} />
            <select
              value={roleName}
              onChange={(e) => {
                const newRole = e.target.value as UserRoleType;
                if (newRole !== roleName) {
                  setRoleChangeTarget({ user: u, newRole });
                }
              }}
              className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              title="Click to change role"
            >
              {SYSTEM_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  Change to {r.label}
                </option>
              ))}
            </select>
          </div>
        );
      },
    },
    {
      key: 'isActive',
      header: 'Active Status',
      sortable: true,
      render: (u) => {
        const isSelf = isCurrentAdmin(u);

        return (
          <div className="flex items-center space-x-2">
            <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
            
            {isSelf ? (
              <span
                className="text-[11px] text-gray-400 font-medium italic cursor-not-allowed"
                title="Administrators cannot deactivate their own account (Self-lock guard)"
              >
                Locked
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setToggleUserTarget(u)}
                className={`text-xs px-2 py-1 rounded font-medium border transition-colors ${
                  u.isActive
                    ? 'border-red-200 text-red-700 hover:bg-red-50'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {u.isActive ? 'Deactivate' : 'Activate'}
              </button>
            )}

            {currentUser?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setResetPasswordTarget(u)}
                className="text-xs px-2 py-1 rounded font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1"
                title="Reset password to system default"
              >
                <KeyRound className="w-3 h-3" />
                <span>Reset PWD</span>
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Member Since / Last Login',
      sortable: true,
      render: (u) => (
        <div className="flex flex-col text-xs text-gray-500">
          <div className="flex items-center">
            <Calendar className="w-3 h-3 mr-1 text-gray-400" />
            <span>
              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <span className="text-[10px] text-gray-400">
            Login tracking: Via JWT session
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {isCreateOpen ? (
        <div className="max-w-2xl mx-auto w-full pb-12">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Users List</span>
            </button>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              New User
            </span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Create New User Account</h2>
              <p className="text-xs text-slate-500 mt-0.5">Provision an employee account with role-based access.</p>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 p-6">
              <FormField label="Full Name" required id="name">
                <TextInput
                  id="name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Chandra"
                  required
                />
              </FormField>

              <FormField label="Email Address" required id="email" hint="Must be unique. Used for system login.">
                <TextInput
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="name@airtronic.com"
                  required
                />
              </FormField>

              <FormField label="System Role" required id="role">
                <Select
                  id="role"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, role: e.target.value as UserRoleType })
                  }
                >
                  {SYSTEM_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.desc}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Department" id="department" hint="Optional department categorization">
                <TextInput
                  id="department"
                  value={createForm.department || ''}
                  onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                  placeholder="e.g. Stores & Inventory, Machining, Design"
                />
              </FormField>

              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center">
                  <Shield className="w-3.5 h-3.5 mr-1" />
                  Default Initial Password
                </p>
                <p>
                  New users are assigned the system default password (
                  <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">
                    airtronic123A@
                  </code>
                  ). Self-service invite/reset will be enabled in a future release.
                </p>
              </div>

              <div className="pt-2">
                <Checkbox
                  id="isActiveUser"
                  label="Active Account"
                  description="User will be able to log in immediately upon creation"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                />
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetCreateForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createMutation.isPending ? 'Creating User...' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <>
          <PageHeader
            title="Users Master & Access Control"
            subtitle="Manage employee accounts, assign system roles, configure departments, and control active access."
            actionSlot={
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
                <span>New User</span>
              </Button>
            }
          />

          {/* Main Table */}
          <DataTable
            columns={columns}
            data={users}
            isLoading={isLoading}
            isError={isError}
            errorMsg={(error as any)?.message || 'Failed to load users'}
            onRetry={refetch}
            searchable={true}
            searchKeys={['name', 'email', 'department']}
            pagination={true}
            defaultPageSize={10}
          />
        </>
      )}

      {/* Confirm Active Toggle Dialog */}
      <ConfirmDialog
        isOpen={!!toggleUserTarget}
        onClose={() => setToggleUserTarget(null)}
        onConfirm={() => {
          if (toggleUserTarget) {
            toggleActiveMutation.mutate({
              id: toggleUserTarget.id,
              isActive: !toggleUserTarget.isActive,
            });
          }
        }}
        title={toggleUserTarget?.isActive ? 'Deactivate User' : 'Activate User'}
        message={
          toggleUserTarget?.isActive ? (
            <span>
              Are you sure you want to deactivate{' '}
              <strong className="text-gray-900">{toggleUserTarget?.name}</strong> (
              {toggleUserTarget?.email})? The user will immediately be rejected on
              future login attempts (401 Unauthorized).
            </span>
          ) : (
            <span>
              Activate account for{' '}
              <strong className="text-gray-900">{toggleUserTarget?.name}</strong>?
              The user will regain login access immediately.
            </span>
          )
        }
        confirmText={toggleUserTarget?.isActive ? 'Deactivate User' : 'Activate User'}
        isDanger={toggleUserTarget?.isActive}
      />

      {/* Confirm Role Change Dialog */}
      <ConfirmDialog
        isOpen={!!roleChangeTarget}
        onClose={() => setRoleChangeTarget(null)}
        onConfirm={() => {
          if (roleChangeTarget) {
            updateRoleMutation.mutate({
              id: roleChangeTarget.user.id,
              role: roleChangeTarget.newRole,
            });
          }
        }}
        title="Confirm Role Change"
        message={
          <span>
            Change role for{' '}
            <strong className="text-gray-900">{roleChangeTarget?.user.name}</strong> from{' '}
            <span className="font-semibold text-gray-700">
              {roleChangeTarget?.user.role?.name}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-blue-700">
              {roleChangeTarget?.newRole}
            </span>
            ? This will immediately alter their UI navigation and permissions on next
            request.
          </span>
        }
        confirmText="Change Role"
      />

      {/* Confirm Password Reset Dialog */}
      <ConfirmDialog
        isOpen={!!resetPasswordTarget}
        onClose={() => setResetPasswordTarget(null)}
        onConfirm={() => {
          if (resetPasswordTarget) {
            resetPasswordMutation.mutate(resetPasswordTarget.id);
          }
        }}
        title="Reset User Password"
        message={
          <span>
            Reset password for <strong className="text-gray-900">{resetPasswordTarget?.name}</strong> (
            {resetPasswordTarget?.email}) to the default system password?
          </span>
        }
        confirmText="Reset Password"
        isDanger={true}
      />
    </div>
  );
}
