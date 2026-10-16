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
import { Plus, Shield, Mail, Calendar, ArrowLeft, KeyRound, Trash2, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { UserAccessDrawer } from '../components/access-control/UserAccessDrawer';
import { RolePermissionMatrixModal } from '../components/access-control/RolePermissionMatrixModal';

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

  // Delete User Confirmation State
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserMasterDto | null>(null);
  const [reassignHistorical, setReassignHistorical] = useState(false);
  const [historicalNotice, setHistoricalNotice] = useState<string | null>(null);

  // Access Control Drawer State
  const [accessDrawerTarget, setAccessDrawerTarget] = useState<UserMasterDto | null>(null);

  // Role Permission Matrix Modal State
  const [isRoleMatrixOpen, setIsRoleMatrixOpen] = useState(false);

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

  const deleteUserMutation = useMutation({
    mutationFn: ({ id, reassignToAdmin }: { id: string; reassignToAdmin?: boolean }) =>
      userMasterApi.deleteUser(id, reassignToAdmin),
    onSuccess: (res) => {
      toast.success(res?.message || 'User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['users-master'] });
      setDeleteUserTarget(null);
      setReassignHistorical(false);
      setHistoricalNotice(null);
    },
    onError: (err: any) => {
      const msg = err?.message || 'Failed to delete user';
      toast.error(msg);
      if (msg.includes('authored historical records')) {
        setHistoricalNotice(msg);
        setReassignHistorical(true);
      } else {
        setDeleteUserTarget(null);
        setReassignHistorical(false);
        setHistoricalNotice(null);
      }
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
              className="text-xs border border-gray-200 dark:border-[#1e233d] rounded-md px-2 py-1 bg-white dark:bg-[#0e111f] text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-[#2b3254] focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium"
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
                className="text-[11px] text-gray-400 dark:text-[#55627a] font-medium italic cursor-not-allowed"
                title="Administrators cannot deactivate their own account (Self-lock guard)"
              >
                Locked
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setToggleUserTarget(u)}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all cursor-pointer ${
                  u.isActive
                    ? 'border-red-200 dark:border-rose-500/30 text-red-700 dark:text-rose-400 bg-red-50/50 dark:bg-rose-500/10 hover:bg-red-100 dark:hover:bg-rose-500/20'
                    : 'border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                }`}
              >
                {u.isActive ? 'Deactivate' : 'Activate'}
              </button>
            )}

            {currentUser?.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setResetPasswordTarget(u)}
                className="text-xs px-2.5 py-1 rounded-md font-semibold border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
                title="Reset password to system default"
              >
                <KeyRound className="w-3 h-3" />
                <span>Reset PWD</span>
              </button>
            )}

            {currentUser?.role === 'ADMIN' && !isSelf && (
              <button
                type="button"
                onClick={() => {
                  setDeleteUserTarget(u);
                  setReassignHistorical(false);
                  setHistoricalNotice(null);
                }}
                className="text-xs px-2.5 py-1 rounded-md font-semibold border border-red-200 dark:border-rose-500/30 text-red-700 dark:text-rose-400 bg-red-50/50 dark:bg-rose-500/10 hover:bg-red-100 dark:hover:bg-rose-500/20 transition-all flex items-center gap-1 cursor-pointer"
                title="Permanently delete user account"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: 'accessControl',
      header: 'Access Permissions',
      render: (u) => (
        <button
          type="button"
          onClick={() => setAccessDrawerTarget(u)}
          className="text-xs px-2.5 py-1.5 rounded-md font-semibold bg-blue-50 dark:bg-indigo-500/10 border border-blue-200 dark:border-indigo-500/30 text-blue-700 dark:text-indigo-400 hover:bg-blue-100 dark:hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          title="Configure module visibility and permissions for this user"
        >
          <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-indigo-400" />
          <span>Manage Access</span>
        </button>
      ),
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
              <div className="flex items-center gap-2.5">
                <Button
                  variant="secondary"
                  onClick={() => setIsRoleMatrixOpen(true)}
                  className="flex items-center space-x-1.5 border-slate-300 dark:border-[#1e233d] hover:bg-slate-50 dark:hover:bg-[#161a2e] text-slate-700 dark:text-slate-200 bg-white dark:bg-[#121526]"
                >
                  <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Role Access Matrix</span>
                </Button>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-900/30"
                >
                  <Plus className="w-4 h-4" />
                  <span>New User</span>
                </Button>
              </div>
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

      {/* User Access Control SlideOver Drawer */}
      <UserAccessDrawer
        user={accessDrawerTarget}
        isOpen={!!accessDrawerTarget}
        onClose={() => setAccessDrawerTarget(null)}
      />

      {/* Role Permission Matrix Modal */}
      <RolePermissionMatrixModal
        isOpen={isRoleMatrixOpen}
        onClose={() => setIsRoleMatrixOpen(false)}
      />

      {/* Confirm User Deletion Dialog */}
      <ConfirmDialog
        isOpen={!!deleteUserTarget}
        onClose={() => {
          setDeleteUserTarget(null);
          setReassignHistorical(false);
          setHistoricalNotice(null);
        }}
        onConfirm={() => {
          if (deleteUserTarget) {
            deleteUserMutation.mutate({
              id: deleteUserTarget.id,
              reassignToAdmin: reassignHistorical,
            });
          }
        }}
        title="Delete User Account"
        message={
          <div className="space-y-3">
            <p>
              Are you sure you want to permanently delete user{' '}
              <strong className="text-gray-900 dark:text-white">
                {deleteUserTarget?.name}
              </strong>{' '}
              ({deleteUserTarget?.email})? This action cannot be undone.
            </p>
            {historicalNotice && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs text-red-800 dark:text-red-300">
                <p className="font-semibold mb-1">Historical Records Detected</p>
                <p>{historicalNotice}</p>
              </div>
            )}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reassignHistorical}
                  onChange={(e) => setReassignHistorical(e.target.checked)}
                  className="rounded border-amber-300 text-primary focus:ring-primary h-4 w-4 mt-0.5"
                />
                <span className="font-medium text-amber-900 dark:text-amber-200">
                  Reassign historical records (DCs, Requisitions, Issues, Stock) to my admin account
                </span>
              </label>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 pl-6 leading-relaxed">
                If enabled, operational records authored by this user will be transferred to your administrator account so audit history is preserved while deleting this login.
              </p>
            </div>
          </div>
        }
        confirmText={reassignHistorical ? 'Reassign & Delete' : 'Delete User'}
        isDanger={true}
      />
    </div>
  );
}
