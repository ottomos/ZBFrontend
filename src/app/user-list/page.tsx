'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { User } from '../types/user';
import { entityLabel, roleLabel } from '../lib/displayLabels';

export default function UserListPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    role: '',
    status: 'Active',
    permissions: [] as string[],
    gsm: '',
    name: '',
    surname: '',
    password: '',
    entity: (typeof window !== 'undefined' && localStorage.getItem('user') && JSON.parse(localStorage.getItem('user') || '{}').role === 'Group Head Trader') ? 'KFH' : 'All',
  });

  const [editUser, setEditUser] = useState({
    id: '' as string | '',
    username: '',
    email: '',
    role: 'Entity Viewer',
    status: 'Active',
    permissions: [] as string[],
    gsm: '',
    name: '',
    surname: '',
    password: '',
    entity: (typeof window !== 'undefined' && localStorage.getItem('user') && JSON.parse(localStorage.getItem('user') || '{}').role === 'Group Head Trader') ? 'KFH' : 'All',
  });

  // Ensure editUser state is always initialized with defaults when editingUser changes
  useEffect(() => {
    if (showEditUserModal && editingUser) {
      setEditUser({
        id: String(editingUser.id),
        username: editingUser.username,
        email: editingUser.email,
        role: editingUser.role,
        status: editingUser.status,
        permissions: (editingUser.permissions || []) as string[],
        gsm: editingUser.gsm || '',
        name: editingUser.name || '',
        surname: editingUser.surname || '',
        password: '',
        entity: editingUser.entity || 'All',
      });
    }
  }, [showEditUserModal, editingUser]);

  const router = useRouter();

  // ---------- helpers ----------

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      console.log('DEBUG fetchUsers:', { ok: res.ok, success: data.success, data });
      if (!res.ok || !data.success) {
        console.error('Fetch users error:', data);
        setUsers([]);
        return;
      }
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setIsLoaded(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };


  const canManageUser = (targetUser: User) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Management') return false;
    if (currentUser.id === targetUser.id) return false;
    if (currentUser.role === 'CoE') return true;

    // Group Head Trader: can only manage KFH users (except CoE/Management/Group Head Trader)
    if (currentUser.role === 'Group Head Trader') {
      if (targetUser.entity !== 'KFH') return false;
      return !['CoE', 'Management', 'Group Head Trader'].includes(targetUser.role);
    }

    if (currentUser.role === 'Entity Admin') {
      if (targetUser.entity !== currentUser.entity && targetUser.entity !== 'All') return false;
      return (
        targetUser.role === 'Entity Trader' || targetUser.role === 'Entity Viewer' || targetUser.role === 'Dealer'
      );
    }
    return false;
  };


  const canAddUserWithRole = (role: string, entity: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Management') return false;
    // Dealer is an entity-level role; it cannot be assigned to the group ('All') scope.
    if (role === 'Dealer' && entity === 'All') return false;
    if (currentUser.role === 'CoE') {
      // Only CoE can create Group Head Trader
      if (role === 'Group Head Trader' && entity !== 'All') return false;
      return true;
    }

    // Group Head Trader: can only add KFH users (Entity Trader/Entity Viewer/Entity Admin/Dealer)
    if (currentUser.role === 'Group Head Trader') {
      if (entity !== 'KFH') return false;
      return ['Entity Trader', 'Entity Viewer', 'Entity Admin', 'Dealer'].includes(role);
    }

    if (currentUser.role === 'Entity Admin') {
      if (entity !== currentUser.entity) return false;
      return role === 'Entity Trader' || role === 'Entity Viewer' || role === 'Dealer';
    }
    return false;
  };

  const generatePassword = (length = 12) => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = upper + lower + digits + specials;
    let password = '';
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    for (let i = 4; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const rolePermissions = (role: string): string[] => {
    if (role === 'CoE') return ['All Access', 'System Admin'];
    if (role === 'Entity Admin') return ['Entity Management', 'User Management', 'Reports'];
    if (role === 'Entity Trader') return ['Trading Operations', 'View Reports'];
    if (role === 'Management') return ['Management Reports', 'Analytics', 'Oversight'];
    if (role === 'Dealer') return ['Sales Operations', 'View Reports'];
    return ['View Only'];
  };

  const getVisibleUsers = () => {
    if (!currentUser) return [];


    let visible: User[] = Array.isArray(users) ? users : [];

    if (currentUser.role === 'Entity Admin') {
      visible = visible.filter(u => u.entity === currentUser.entity);
    }
    // Group Head Trader can see all users

    return visible.filter(u =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.entity ? u.entity.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
      (u.status ? u.status.toLowerCase().includes(searchTerm.toLowerCase()) : false)
    );
  };

  const getStatsUsers = () => {
    if (!currentUser) return [];
    if (currentUser.entity === 'All') return users;
    return users.filter(
      u => u.entity === currentUser.entity && u.role !== 'CoE' && u.role !== 'Management'
    );
  };

  // ---------- effects ----------

  useEffect(() => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!userStr) {
      router.push('/login');
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'CoE' && user.role !== 'Entity Admin' && user.role !== 'Management' && user.role !== 'Group Head Trader') {
        alert('Access denied. Only CoE, Entity Admin, Group Head Trader, and Management can access User Management.');
        router.push('/');
        return;
      }
      if (user.role === 'Entity Admin') {
        const justLoggedIn =
          typeof window !== 'undefined' ? localStorage.getItem('justLoggedIn') : null;
        if (justLoggedIn === 'true') {
          localStorage.removeItem('justLoggedIn');
          router.push('/');
          return;
        }
      }
      setCurrentUser(user);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error parsing user data:', err);
      localStorage.removeItem('user');
      router.push('/login');
      return;
    }

    fetchUsers();
  }, [router]);

  useEffect(() => {
    if (currentUser && currentUser.role === 'Entity Admin') {
      setNewUser(prev => ({
        ...prev,
        entity: currentUser.entity || 'All',
      }));
    }
  }, [currentUser]);

  // ---------- actions ----------

  const handleAddUser = async () => {
      let roleToSend = newUser.role;
      // Always default to 'Entity Admin' for non-'All' entities, 'CoE' for 'All', unless explicitly set
      if (!roleToSend) {
        if (newUser.entity === 'All') {
          roleToSend = 'CoE';
        } else {
          roleToSend = 'Entity Admin';
        }
      }
      console.log('Attempting to add user with role:', roleToSend, 'and entity:', newUser.entity);
    if (!canAddUserWithRole(roleToSend, newUser.entity)) {
      if (currentUser?.role === 'Entity Admin') {
        alert('Entity Admins can only add Entity Traders, Entity Viewers and Dealers to their own entity.');
      } else {
        alert('You do not have permission to add this type of user.');
      }
      return;
    }

    if (!newUser.email || !newUser.gsm || !newUser.name || !newUser.surname) {
      alert('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      alert('Please enter a valid email address');
      return;
    }

    const existingUser = users.find(
      u => u.email.toLowerCase() === newUser.email.toLowerCase()
    );
    if (existingUser) {
      alert('A user with this email address already exists');
      return;
    }

      const username = `${newUser.name.toLowerCase()}.${newUser.surname.toLowerCase()}`;

    // Ensure role is set correctly for 'All' entity
    if (newUser.entity === 'All' && !roleToSend) {
      roleToSend = 'CoE';
    }
    const generatedPassword = generatePassword();
    const permissions = rolePermissions(roleToSend);

      // Log the generated password to the console
      console.log('Generated password for new user:', generatedPassword);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email: newUser.email,
          password: generatedPassword,
          role: roleToSend,
          name: newUser.name,
          surname: newUser.surname,
          gsm: newUser.gsm,
          entity: newUser.entity,
          status: newUser.status,
          permissions,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error('Add user error response:', data);
        if (data.error && data.error.includes('email')) {
          alert('A user with this email address already exists. Please use a different email.');
        } else {
          alert(data.error || 'Failed to add user');
        }
        setShowAddUserModal(false);
        return;
      }

      setUsers(prev => [...prev, data.user]);
      await fetchUsers();
      alert('User added and password sent to email.');

        setNewUser({
          username: '',
          email: '',
          role: '',
          status: 'Active',
          permissions: [],
          gsm: '',
          name: '',
          surname: '',
          password: '',
          entity: currentUser?.role === 'Entity Admin' ? currentUser.entity || '' : 'All',
        });
      setShowAddUserModal(false);
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert('Error adding user: ' + (error?.message || error));
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    // Always ensure entity and role are set to defaults if empty
    let entityToSend = editUser.entity || (editingUser.entity || 'All');
    let roleToSend = editUser.role || (entityToSend === 'All' ? 'CoE' : 'Entity Admin');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          username: editUser.username,
          email: editUser.email,
          gsm: editUser.gsm,
          name: editUser.name,
          surname: editUser.surname,
          role: roleToSend,
          password: editUser.password, // only applied if non-empty
          entity: entityToSend,
          status: editUser.status,
          permissions: editUser.permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error('Update user error response:', data);
        alert(data.error || 'Failed to update user');
        return;
      }

      setUsers(prev =>
        prev.map(u => (u.id === data.user.id ? { ...u, ...data.user } : u))
      );
      await fetchUsers();
      setShowEditUserModal(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert('Error updating user: ' + (error?.message || error));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    const userToRemove = users.find(u => String(u.id) === userId);
    if (!userToRemove) return;

    if (!canManageUser(userToRemove)) {
      if (currentUser && String(currentUser.id) === userId) {
        alert('You cannot remove your own account.');
      } else if (currentUser?.role === 'Entity Admin') {
        alert('Entity Admins can only remove Entity Traders, Entity Viewers and Dealers from their own entity.');
      } else {
        alert('You do not have permission to remove this user.');
      }
      return;
    }

    if (!window.confirm('Are you sure you want to remove this user?')) return;

    try {
      // Use POST with explicit delete action because some networks block HTTP DELETE
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: userToRemove.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error('Delete user error response:', data);
        alert(data.error || 'Failed to delete user');
        return;
      }
      await fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert('Error deleting user: ' + (error?.message || error));
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    const userToToggle = users.find(u => String(u.id) === userId);
    if (!userToToggle) return;

    if (!canManageUser(userToToggle)) {
      if (currentUser && String(currentUser.id) === userId && userToToggle.status === 'Active') {
        alert('You cannot deactivate your own account.');
      } else if (currentUser?.role === 'Entity Admin') {
        alert('Entity Admins can only manage Entity Traders, Entity Viewers and Dealers from their own entity.');
      } else {
        alert('You do not have permission to change this user\'s status.');
      }
      return;
    }

    const newStatus = userToToggle.status === 'Active' ? 'Inactive' : 'Active';

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userToToggle.id,
          username: userToToggle.username,
          email: userToToggle.email,
          gsm: userToToggle.gsm,
          name: userToToggle.name,
          surname: userToToggle.surname,
          role: userToToggle.role,
          password: '', // no password change
          entity: userToToggle.entity,
          status: newStatus,
          permissions: userToToggle.permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error('Toggle status error response:', data);
        alert(data.error || 'Failed to update user status');
        return;
      }
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user status:', error);
      alert('Error updating user status: ' + (error?.message || error));
    }
  };

  const filteredUsers = getVisibleUsers();
  const statsUsers = getStatsUsers();

  if (!isLoaded || !isAuthenticated) {
    return (
      <div className="h-full overflow-auto bg-[#0A1929] text-white">
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#0A1929] text-white">

      {/* Header */}
      <div className="bg-[#102236] border-b border-gray-700 px-3 py-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xs font-bold text-white">User Management</h1>
          <button
            onClick={() => {
              if (!showAddUserModal && !showEditUserModal) {
                if (currentUser?.role === 'Group Head Trader') {
                  setNewUser({
                    username: '',
                    email: '',
                    role: 'Entity Admin',
                    status: 'Active',
                    permissions: [],
                    gsm: '',
                    name: '',
                    surname: '',
                    password: '',
                    entity: 'KFH',
                  });
                } else {
                  setNewUser({
                    username: '',
                    email: '',
                    role: '',
                    status: 'Active',
                    permissions: [],
                    gsm: '',
                    name: '',
                    surname: '',
                    password: '',
                    entity: currentUser?.entity || 'All',
                  });
                }
                setShowAddUserModal(true);
                setShowEditUserModal(false);
              }
            }}
            disabled={
              showAddUserModal || showEditUserModal || currentUser?.role === 'Management'
            }
            className={`bg-[#2C5680] text-white px-2 py-1 text-xs font-medium rounded transition-colors ${
              showAddUserModal || showEditUserModal || currentUser?.role === 'Management'
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:bg-[#61AAD9]'
            }`}
          >
            Add User
          </button>
        </div>
      </div>

      {/* Add User Form */}
      {showAddUserModal && (
        <div className="bg-[#1A334C] border-b border-gray-700 px-3 py-2">
          <div className="mb-1">
            <span className="text-xs font-medium text-white">Add New User</span>
          </div>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleAddUser();
            }}
            className="space-y-2"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e =>
                    setNewUser(prev => ({ ...prev, email: e.target.value }))
                  }
                  className={`w-full px-2 py-1 ${
                    currentUser?.role === 'Management'
                      ? 'bg-[#0A1929] text-gray-400 cursor-not-allowed'
                      : 'bg-[#102236] text-white'
                  } border border-gray-600 rounded text-xs placeholder-gray-400 focus:outline-none focus:border-[#2C5680]`}
                  placeholder="user@example.com"
                  required
                  disabled={currentUser?.role === 'Management'}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={newUser.gsm}
                  onChange={e =>
                    setNewUser(prev => ({ ...prev, gsm: e.target.value }))
                  }
                  className={`w-full px-2 py-1 ${
                    currentUser?.role === 'Management'
                      ? 'bg-[#0A1929] text-gray-400 cursor-not-allowed'
                      : 'bg-[#102236] text-white'
                  } border border-gray-600 rounded text-xs placeholder-gray-400 focus:outline-none focus:border-[#2C5680]`}
                  placeholder="+1234567890"
                  required
                  disabled={currentUser?.role === 'Management'}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={e =>
                    setNewUser(prev => ({ ...prev, name: e.target.value }))
                  }
                  className={`w-full px-2 py-1 ${
                    currentUser?.role === 'Management'
                      ? 'bg-[#0A1929] text-gray-400 cursor-not-allowed'
                      : 'bg-[#102236] text-white'
                  } border border-gray-600 rounded text-xs placeholder-gray-400 focus:outline-none focus:border-[#2C5680]`}
                  placeholder="John"
                  required
                  disabled={currentUser?.role === 'Management'}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Surname *</label>
                <input
                  type="text"
                  value={newUser.surname}
                  onChange={e =>
                    setNewUser(prev => ({ ...prev, surname: e.target.value }))
                  }
                  className={`w-full px-2 py-1 ${
                    currentUser?.role === 'Management'
                      ? 'bg-[#0A1929] text-gray-400 cursor-not-allowed'
                      : 'bg-[#102236] text-white'
                  } border border-gray-600 rounded text-xs placeholder-gray-400 focus:outline-none focus:border-[#2C5680]`}
                  placeholder="Doe"
                  required
                  disabled={currentUser?.role === 'Management'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Entity</label>
                {currentUser?.role === 'Group Head Trader' ? (
                  <select
                    value="KFH"
                    disabled
                    className="w-full px-2 py-1 bg-[#0A1929] text-gray-400 cursor-not-allowed border border-gray-600 rounded text-xs focus:outline-none focus:border-[#2C5680]"
                  >
                    <option value="KFH">KFH</option>
                  </select>
                ) : currentUser?.role === 'CoE' ? (
                  <select
                    value={newUser.entity}
                    onChange={e => {
                      const entity = e.target.value;
                      setNewUser(prev => {
                        if (currentUser?.role === 'CoE') {
                          if (entity === 'All') {
                            return { ...prev, entity, role: 'CoE' };
                          } else if (!prev.role || prev.role === 'CoE' || prev.role === 'Management' || prev.role === 'Group Head Trader') {
                            return { ...prev, entity, role: 'Entity Admin' };
                          }
                        }
                        return { ...prev, entity };
                      });
                    }}
                    className="w-full px-2 py-1 bg-[#102236] text-white border border-gray-600 rounded text-xs focus:outline-none focus:border-[#2C5680]"
                  >
                    <option value="All">KFH Group</option>
                    <option value="KT">KT</option>
                    <option value="KFH">KFH</option>
                    <option value="AUB">AUB</option>
                  </select>
                ) : (
                  <select
                    value={newUser.entity}
                    onChange={e => setNewUser(prev => ({ ...prev, entity: e.target.value }))}
                    className="w-full px-2 py-1 bg-[#0A1929] text-gray-400 cursor-not-allowed border border-gray-600 rounded text-xs focus:outline-none focus:border-[#2C5680]"
                    disabled
                  >
                    <option value={currentUser?.entity || 'All'}>{entityLabel(currentUser?.entity)}</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                  className={`w-full px-2 py-1 ${currentUser?.role === 'Management' ? 'bg-[#0A1929] text-gray-400 cursor-not-allowed' : 'bg-[#102236] text-white'} border border-gray-600 rounded text-xs focus:outline-none focus:border-[#2C5680]`}
                  disabled={currentUser?.role === 'Management'}
                >
                  {currentUser?.role === 'Group Head Trader' ? (
                    <>
                      <option value="Entity Admin">Admin</option>
                      <option value="Entity Trader">Trader</option>
                      <option value="Entity Viewer">Viewer</option>
                      <option value="Dealer">Dealer</option>
                    </>
                  ) : currentUser?.role === 'CoE' && newUser.entity === 'All' ? (
                    <>
                      <option value="CoE">CoE</option>
                      <option value="Management">Management</option>
                      <option value="Group Head Trader">Head Trader</option>
                    </>
                  ) : currentUser?.role === 'CoE' && newUser.entity !== 'All' ? (
                    <>
                      <option value="Entity Admin">Admin</option>
                      <option value="Entity Trader">Trader</option>
                      <option value="Entity Viewer">Viewer</option>
                      <option value="Dealer">Dealer</option>
                    </>
                  ) : currentUser?.role === 'Entity Admin' ? (
                    <>
                      <option value="Entity Admin">Admin</option>
                      <option value="Entity Trader">Trader</option>
                      <option value="Entity Viewer">Viewer</option>
                      <option value="Dealer">Dealer</option>
                    </>
                  ) : null}
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-2 gap-2">
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#2C5680] text-white rounded hover:bg-[#61AAD9] transition-colors text-xs font-medium max-w-[90px] w-auto"
                disabled={currentUser?.role === 'Management'}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="px-3 py-1.5 bg-[#F47C6A] text-white rounded hover:bg-[#d63f51] transition-colors text-xs font-medium max-w-[90px] w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Table */}
      <div className="px-3 py-1">
        <div className="bg-[#102236] border border-gray-700 overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-[#1A334C]">
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-600">
                  User
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-600">
                  Entity
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-600">
                  Role
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-600 w-16">
                  Status
                </th>
                <th className="px-2 py-1 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <React.Fragment key={user.id}>
                  <tr
                    className={`${
                      index % 2 === 0 ? 'bg-[#0A1929]' : 'bg-[#102236]'
                    } hover:bg-[#1A334C]/50 transition-colors border-b border-gray-700`}
                  >
                    <td className="px-2 py-1 whitespace-nowrap border-r border-gray-600">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-5 w-5">
                          <div className="h-5 w-5 rounded-full bg-[#2C5680] flex items-center justify-center text-white text-xs font-medium">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-2">
                          <div className="text-xs font-medium text-white">
                            {user.username}
                          </div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap border-r border-gray-600">
                      <span className="text-xs text-gray-300">
                        {entityLabel(user.entity)}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap border-r border-gray-600">
                      <span className="text-xs text-gray-300">{roleLabel(user.role)}</span>
                    </td>
                    <td
                      className={`px-0 py-0 whitespace-nowrap border-r border-gray-600 ${
                        user.status === 'Active' ? 'bg-[#2ECC71]' : 'bg-[#FF4757]'
                      }`}
                    >
                      <div className="px-2 py-1 font-semibold text-white text-center text-xs">
                        {user.status}
                      </div>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <div className="flex gap-1 items-center">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setEditUser({
                              id: String(user.id),
                              username: user.username,
                              email: user.email,
                              role: user.role,
                              status: user.status,
                              permissions: (user.permissions || []) as string[],
                              gsm: user.gsm || '',
                              name: user.name || '',
                              surname: user.surname || '',
                              password: '',
                              entity: user.entity || 'All',
                            });
                            setShowEditUserModal(true);
                          }}
                          disabled={
                            !!(!canManageUser(user) || currentUser?.id === user.id || currentUser?.role === 'Management' ||
                            (showEditUserModal && editingUser && String(editingUser.id) === String(user.id)))
                          }
                          className={`px-1 py-0.5 rounded text-xs transition-colors min-w-[35px] flex items-center justify-center ${
                            !canManageUser(user) || currentUser?.id === user.id || currentUser?.role === 'Management' ||
                            (showEditUserModal && editingUser && editingUser.id === user.id)
                              ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                              : 'bg-[#2C5680] text-white hover:bg-[#61AAD9]'
                          }`}
                          title={
                            !canManageUser(user) || currentUser?.id === user.id || currentUser?.role === 'Management' ||
                            (showEditUserModal && editingUser && editingUser.id === user.id)
                              ? 'You cannot edit your own account or this user'
                              : ''
                          }
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(String(user.id))}
                          disabled={!canManageUser(user) || currentUser?.role === 'Management' || currentUser?.id === user.id}
                          className={`px-1 py-0.5 rounded text-xs transition-colors min-w-[40px] flex items-center justify-center ${
                            !canManageUser(user) || currentUser?.role === 'Management' || currentUser?.id === user.id
                              ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                              : 'bg-yellow-500 text-white hover:bg-yellow-600'
                          }`}
                          title={
                            !canManageUser(user) || currentUser?.role === 'Management' || currentUser?.id === user.id
                              ? 'You cannot block or enable your own account or this user'
                              : ''
                          }
                        >
                          {user.status === 'Active' ? 'Block' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleRemoveUser(String(user.id))}
                          disabled={!canManageUser(user) || currentUser?.role === 'Management' || currentUser?.id === user.id}
                          className={`px-1 py-0.5 rounded text-xs transition-colors min-w-[40px] flex items-center justify-center ${
                            !canManageUser(user) || currentUser?.role === 'Management' || currentUser?.id === user.id
                              ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                              : 'bg-[#FF4757] text-white hover:bg-[#d63f51]'
                          }`}
                          title={
                            !canManageUser(user) || currentUser?.role === 'Management' || currentUser?.id === user.id
                              ? 'You cannot remove your own account or this user'
                              : ''
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {showEditUserModal && editingUser && editingUser.id === user.id && (
                    <tr>
                      <td
                        colSpan={5}
                        className="bg-[#1A334C] border-b border-gray-700 px-3 py-2"
                      >
                        <div className="mb-1">
                          <span className="text-xs font-medium text-white">
                            Edit: {editingUser.username}
                          </span>
                        </div>
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            handleEditUser();
                          }}
                          className="space-y-2"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-xs text-gray-300 mb-1">
                                Email *
                              </label>
                              <input
                                type="email"
                                value={editUser.email}
                                disabled
                                className="w-full px-2 py-1 bg-[#0A1929] border border-gray-600 rounded text-xs text-gray-400 placeholder-gray-500 focus:outline-none cursor-not-allowed"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-300 mb-1">
                                Phone *
                              </label>
                              <input
                                type="tel"
                                value={editUser.gsm}
                                disabled
                                className="w-full px-2 py-1 bg-[#0A1929] border border-gray-600 rounded text-xs text-gray-400 placeholder-gray-500 focus:outline-none cursor-not-allowed"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-300 mb-1">
                                Name *
                              </label>
                              <input
                                type="text"
                                value={editUser.name}
                                disabled
                                className="w-full px-2 py-1 bg-[#0A1929] border border-gray-600 rounded text-xs text-gray-400 placeholder-gray-500 focus:outline-none cursor-not-allowed"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-300 mb-1">
                                Surname *
                              </label>
                              <input
                                type="text"
                                value={editUser.surname}
                                disabled
                                className="w-full px-2 py-1 bg-[#0A1929] border border-gray-600 rounded text-xs text-gray-400 placeholder-gray-500 focus:outline-none cursor-not-allowed"
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-gray-300 mb-1">
                                Entity
                              </label>
                              {currentUser?.role === 'Group Head Trader' ? (
                                <select
                                  value="KFH"
                                  disabled
                                  className="w-full px-2 py-1 bg-[#0A1929] text-gray-400 cursor-not-allowed border border-gray-600 rounded text-xs focus:outline-none focus:border-[#2C5680]"
                                >
                                  <option value="KFH">KFH</option>
                                </select>
                              ) : currentUser?.role === 'CoE' ? (
                                <select
                                  value={editUser.entity}
                                  onChange={e => {
                                    const newEntity = e.target.value;
                                    let newRole = editUser.role;
                                    if (newEntity === 'All') {
                                      newRole = 'CoE';
                                    } else {
                                      if (editUser.role === 'CoE' || editUser.role === 'Management' || editUser.role === 'Group Head Trader') {
                                        newRole = 'Entity Admin';
                                      }
                                    }
                                    setEditUser(prev => ({
                                      ...prev,
                                      entity: newEntity,
                                      role: newRole,
                                    }));
                                  }}
                                  className="w-full px-2 py-1 bg-[#102236] text-white border border-gray-600 rounded text-xs focus:outline-none focus:border-[#2C5680]"
                                >
                                  <option value="All">KFH Group</option>
                                  <option value="KT">KT</option>
                                  <option value="KFH">KFH</option>
                                  <option value="AUB">AUB</option>
                                </select>
                              ) : (
                                <select
                                  value={editUser.entity}
                                  onChange={e => {
                                    setEditUser(prev => ({ ...prev, entity: e.target.value }));
                                  }}
                                  className="w-full px-2 py-1 bg-[#0A1929] text-gray-400 cursor-not-allowed border border-gray-600 rounded text-xs focus:outline-none focus:border-[#2C5680]"
                                  disabled
                                >
                                  <option value={currentUser?.entity || 'All'}>{entityLabel(currentUser?.entity)}</option>
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs text-gray-300 mb-1">
                                Role
                              </label>
                              <select
                                value={editUser.role}
                                onChange={e =>
                                  setEditUser(prev => ({
                                    ...prev,
                                    role: e.target.value,
                                  }))
                                }
                                className="w-full px-2 py-1 bg-[#102236] border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-[#2C5680]"
                                disabled={
                                  (editingUser && currentUser?.id === editingUser.id) ||
                                  currentUser?.role === 'Management'
                                }
                              >
                                {editUser.entity === 'All' ? (
                                  <>
                                    <option value="CoE">CoE</option>
                                    <option value="Management">Management</option>
                                    <option value="Group Head Trader">Head Trader</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Entity Admin">Admin</option>
                                    <option value="Entity Trader">Trader</option>
                                    <option value="Entity Viewer">Viewer</option>
                                    <option value="Dealer">Dealer</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-[#2C5680] text-white rounded hover:bg-[#61AAD9] transition-colors text-xs font-medium max-w-[90px] w-auto"
                              disabled={currentUser?.role === 'Management'}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowEditUserModal(false)}
                              className="px-3 py-1.5 bg-[#F47C6A] text-white rounded hover:bg-[#d63f51] transition-colors text-xs font-medium max-w-[90px] w-auto"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics */}
      <div className="px-3 py-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="bg-[#102236] rounded p-2">
            <div className="text-xs text-gray-400">Total Users</div>
            <div className="text-sm font-bold text-white">{statsUsers.length}</div>
          </div>
          <div className="bg-[#102236] rounded p-2">
            <div className="text-xs text-gray-400">Active Users</div>
            <div className="text-sm font-bold text-[#2ECC71]">
              {Array.isArray(statsUsers)
                ? statsUsers.filter(u => u.status === 'Active').length
                : 0}
            </div>
          </div>
          <div className="bg-[#102236] rounded p-2">
            <div className="text-xs text-gray-400">Inactive Users</div>
            <div className="text-sm font-bold text-[#FF4757]">
              {Array.isArray(statsUsers)
                ? statsUsers.filter(u => u.status === 'Inactive').length
                : 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
