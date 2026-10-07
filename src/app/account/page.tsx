'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '../types/user';
import { entityLabel, roleLabel } from '../lib/displayLabels';

const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { id: 'upper', label: 'One upper-case letter', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'One lower-case letter', test: (v: string) => /[a-z]/.test(v) },
  { id: 'number', label: 'One number', test: (v: string) => /\d/.test(v) },
  { id: 'special', label: 'One special character', test: (v: string) => /[!@#$%^&*()_+\-=[\]{}|;:',.<>/?]/.test(v) },
];

const TURKISH_CHARS = /[çğıöşüÇĞİÖŞÜ]/;

function initialsOf(user: User | null): string {
  const first = String(user?.name || user?.username || '').trim();
  return first ? first.charAt(0).toUpperCase() : '?';
}

export default function AccountPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editUser, setEditUser] = useState({
    gsm: '',
    name: '',
    surname: '',
  });

  // Change password modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/users/me');
        const data = await res.json();
        if (!res.ok || !data.success || !data.user) {
          router.push('/login');
          return;
        }
        setCurrentUser(data.user);
        setEditUser({
          gsm: data.user.gsm || '',
          name: data.user.name || '',
          surname: data.user.surname || '',
        });
        setIsLoaded(true);
      } catch {
        router.push('/login');
      }
    };
    fetchCurrentUser();
  }, [router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0A1929] text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUser.id,
          gsm: editUser.gsm,
          name: editUser.name,
          surname: editUser.surname,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setProfileError(data.error || 'Failed to update account');
        return;
      }
      const updated = { ...currentUser, gsm: editUser.gsm, name: editUser.name, surname: editUser.surname };
      setCurrentUser(updated);
      // Keep the cached copies used by the top navigation in sync.
      try { sessionStorage.setItem('ui.currentUser', JSON.stringify(updated)); } catch {}
      try {
        const raw = localStorage.getItem('user');
        if (raw) localStorage.setItem('user', JSON.stringify({ ...JSON.parse(raw), gsm: updated.gsm, name: updated.name, surname: updated.surname }));
      } catch {}
      globalThis.dispatchEvent(new CustomEvent('ui:user-updated', { detail: updated }));
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error: any) {
      setProfileError(error?.message || 'Error updating account');
    } finally {
      setSavingProfile(false);
    }
  };

  const openPwModal = () => {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setPwSuccess(false);
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setShowPwModal(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!currentPw) { setPwError('Current password is required.'); return; }
    if (TURKISH_CHARS.test(newPw)) { setPwError('Password must not contain Turkish characters.'); return; }
    const unmet = PASSWORD_RULES.find(rule => !rule.test(newPw));
    if (unmet) { setPwError(`Password must have: ${unmet.label.toLowerCase()}.`); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    if (newPw === currentPw) { setPwError('New password must be different from the current password.'); return; }

    setPwSaving(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          currentPassword: currentPw,
          newPassword: newPw,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPwError(data.error || 'Failed to change password.');
        return;
      }
      setPwSuccess(true);
      setTimeout(() => setShowPwModal(false), 2800);
    } catch {
      setPwError('An error occurred. Please try again.');
    } finally {
      setPwSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-[#2C5680]/60 bg-[#0B1D33] px-3 py-2 text-white placeholder-[#6E8CAA] focus:border-[#61AAD9] focus:outline-none';
  const readOnlyClass =
    'w-full rounded-lg border border-[#2C5680]/40 bg-[#0B1D33]/70 px-3 py-2 text-[#9FB6CC] cursor-not-allowed';
  const labelClass = 'mb-1 block text-[13px] font-semibold text-[#DCE8F5]';

  return (
    <div
      className="h-full overflow-auto bg-[#0A1929] px-4 py-10 text-white"
      style={{ fontFamily: 'Segoe UI, Arial, sans-serif' }}
    >
      <div className="mx-auto w-full max-w-3xl">
        {/* One card: the profile panel is nested at the top-left, flush with the card edges */}
        <div className="relative flex overflow-hidden rounded-2xl border border-[#2C5680]/45 bg-[#102236]/85 shadow-2xl">
          {/* Profile panel */}
          <div className="w-[178px] shrink-0 self-start rounded-tl-2xl border-b border-r border-[#2C5680]/45 bg-[#14304C] px-4 py-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#61AAD9]/45 bg-[#1C3E63] text-3xl font-semibold text-[#DCE8F5]">
              {initialsOf(currentUser)}
            </div>
            <div className="mt-3 text-[15px] font-semibold text-white">
              {[currentUser.name, currentUser.surname].filter(Boolean).join(' ') || currentUser.username}
            </div>
            <div className="mt-1 text-[13px] text-[#8FB0CC]">
              {entityLabel(currentUser?.entity)} &middot; {roleLabel(currentUser?.role)}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="flex-1 p-6">
            <h2 className="mb-5 text-2xl font-semibold text-white">Account Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="acct-email">Email</label>
                <input id="acct-email" type="email" value={currentUser.email} readOnly className={readOnlyClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="acct-phone">Phone *</label>
                <input
                  id="acct-phone"
                  type="tel"
                  value={editUser.gsm}
                  onChange={e => setEditUser(prev => ({ ...prev, gsm: e.target.value }))}
                  className={inputClass}
                  required
                  inputMode="tel"
                  pattern="^(\+|00)?[1-9][0-9]{6,15}$"
                  placeholder="+905301234567"
                  title="Digits only, optionally starting with + or 00."
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="acct-first-name">First Name</label>
                <input
                  id="acct-first-name"
                  type="text"
                  value={editUser.name}
                  onChange={e => setEditUser(prev => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="acct-last-name">Last Name</label>
                <input
                  id="acct-last-name"
                  type="text"
                  value={editUser.surname}
                  onChange={e => setEditUser(prev => ({ ...prev, surname: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            {profileError && <div className="mt-3 text-[13px] text-[#FF9C9C]">{profileError}</div>}
            {profileSaved && (
              <div
                role="status"
                aria-live="polite"
                className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold text-[#D6FFE4]"
                style={{ background: 'rgba(22,101,52,0.5)', borderColor: 'rgba(74,222,128,0.5)' }}
              >
                <CheckIcon /> Your account information has been saved.
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={openPwModal}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#61AAD9]/45 bg-[#16324F]/70 py-2.5 text-white hover:bg-[#1D4269]"
              >
                <LockIcon />
                <span style={{ fontSize: '15px', fontWeight: 600 }}>Change Password</span>
              </button>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-lg bg-[#2C5680] px-6 py-2 text-white hover:bg-[#61AAD9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span style={{ fontSize: '15px', fontWeight: 600 }}>{savingProfile ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showPwModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="Change Password"
        >
          <div
            className="max-h-full w-full max-w-[520px] overflow-auto rounded-2xl border p-6 shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(7,49,96,0.97) 0%, rgba(5,36,74,0.98) 100%)',
              borderColor: 'rgba(97,170,217,0.45)',
              fontFamily: 'Segoe UI, Arial, sans-serif',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/ziraat-katilim-seeklogo.png" alt="Ziraat Katilim" className="h-10 w-auto object-contain" />
              </div>
              <button
                type="button"
                onClick={() => setShowPwModal(false)}
                aria-label="Close"
                className="rounded p-1 text-[#9EB6CF] hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <h3 className="mb-4 text-xl font-semibold text-white">Change Password</h3>

            <div className="mb-5 rounded-xl border border-[#2C5680]/50 bg-[#0F2B4A]/60 p-4 text-center">
              <div className="text-[13px] font-semibold text-[#B6D8F0]">Account Information</div>
              <div className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full border border-[#61AAD9]/45 bg-[#1C3E63] text-2xl font-semibold text-[#DCE8F5]">
                {initialsOf(currentUser)}
              </div>
              <div className="mt-2 text-[15px] font-semibold text-white">
                {[currentUser.name, currentUser.surname].filter(Boolean).join(' ') || currentUser.username}
              </div>
              <div className="text-[13px] text-[#8FB0CC]">{entityLabel(currentUser?.entity)} - {roleLabel(currentUser?.role)}</div>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="mb-4">
                <label className={labelClass} htmlFor="pw-current">Current Password *</label>
                <PasswordInput
                  id="pw-current"
                  value={currentPw}
                  onChange={setCurrentPw}
                  visible={showCurrentPw}
                  onToggle={() => setShowCurrentPw(v => !v)}
                  disabled={pwSaving || pwSuccess}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="pw-new">New Password *</label>
                  <PasswordInput
                    id="pw-new"
                    value={newPw}
                    onChange={setNewPw}
                    visible={showNewPw}
                    onToggle={() => setShowNewPw(v => !v)}
                    disabled={pwSaving || pwSuccess}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="pw-confirm">Confirm New Password *</label>
                  <PasswordInput
                    id="pw-confirm"
                    value={confirmPw}
                    onChange={setConfirmPw}
                    visible={showConfirmPw}
                    onToggle={() => setShowConfirmPw(v => !v)}
                    disabled={pwSaving || pwSuccess}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-start justify-between gap-4">
                <ul className="space-y-1">
                  {PASSWORD_RULES.map(rule => {
                    const met = rule.test(newPw);
                    return (
                      <li key={rule.id} className="flex items-center gap-2 text-[13px]">
                        <span
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                          style={{ background: met ? '#22C55E' : '#4B5A6B' }}
                          aria-hidden="true"
                        >
                          {met && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#0A1929"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </span>
                        <span className={met ? 'text-[#CFE8D8]' : 'text-[#8FA6BC]'}>{rule.label}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="whitespace-nowrap pt-1 text-[13px] text-[#8FB0CC]">* Mandatory fields</div>
              </div>

              {pwError && <div className="mt-3 text-[13px] text-[#FF9C9C]">{pwError}</div>}
              {pwSuccess && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold text-[#D6FFE4]"
                  style={{ background: 'rgba(22,101,52,0.55)', borderColor: 'rgba(74,222,128,0.5)' }}
                >
                  <CheckIcon /> Your password has been changed successfully.
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={pwSaving || pwSuccess}
                  className="rounded-lg bg-[#3B7BC8] px-6 py-2 text-white hover:bg-[#61AAD9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span style={{ fontSize: '15px', fontWeight: 600 }}>{pwSaving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  visible,
  onToggle,
  disabled,
  className,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${className} pr-10`}
        required
        disabled={disabled}
        autoComplete={id === 'pw-current' ? 'current-password' : 'new-password'}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9EB6CF]"
        tabIndex={-1}
        onClick={onToggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5C7.305 4.5 3.135 7.305 1.5 12c1.635 4.695 5.805 7.5 10.5 7.5s8.865-2.805 10.5-7.5C20.865 7.305 16.695 4.5 12 4.5z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5C7.305 4.5 3.135 7.305 1.5 12c1.635 4.695 5.805 7.5 10.5 7.5s8.865-2.805 10.5-7.5C20.865 7.305 16.695 4.5 12 4.5z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} /><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" /></svg>
        )}
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="10" width="16" height="10" rx="2" strokeWidth={1.6} />
      <path strokeLinecap="round" strokeWidth={1.6} d="M8 10V7a4 4 0 118 0v3" />
    </svg>
  );
}
