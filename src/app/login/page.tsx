"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// ---- Login logo size ----
// Change this single number to resize the Ziraat Katilim logo on the login card.
// It is a percentage of the card's inner (padded) width, so it scales with the
// card. 150% of the 540px card keeps the artwork at the same rendered size it
// had at 173% of the old 420px card, while now fitting inside the card border.
const LOGO_SIZE_PERCENT = 100;

// Trims the transparent padding baked into the logo PNG (percent of card width).
// Increase to pull the content below the logo closer, decrease for more space.
const LOGO_TRIM_TOP_PERCENT = 0;

// Gap (px) between the bottom of the logo artwork and the first input. Matches
// the `mb-4` (16px) spacing used between the email and password fields; the PNG
// carries ~4px of transparent padding at its bottom, which is subtracted here.
const LOGO_GAP_BELOW_PX = 32;

// Horizontal adjustment for the logo artwork within the login card.
const LOGO_OFFSET_X_PERCENT = 0;

// Extra pull-up (px) applied only to the "Change Password" heading, so the
// change-password view has the same logo gap as the normal login view.
// Increase to tighten the gap, decrease (or use 0) for more space.
const CHANGE_TITLE_PULL_UP_PX = 0;

// How long the green success box stays up before the card moves on.
const SUCCESS_DELAY_MS = 3800;
const TURKISH_CHARS = /[\u011f\u00fc\u015f\u00f6\u00e7\u0131\u0130\u011e\u00dc\u015e\u00d6\u00c7]/;

const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { id: 'upper', label: 'One upper-case letter', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'One lower-case letter', test: (v: string) => /[a-z]/.test(v) },
  { id: 'number', label: 'One number', test: (v: string) => /\d/.test(v) },
  { id: 'special', label: 'One special character', test: (v: string) => /[!@#$%^&*()_+\-=[\]{}|;:',.<>/?]/.test(v) },
  { id: 'turkish', label: 'No Turkish characters', test: (v: string) => v.length > 0 && !TURKISH_CHARS.test(v) },
];
export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  // 'change' = forced first-login password change, 'forgot' = password reset.
  // Both replace the login form inside the same card rather than opening a panel.
  const [mode, setMode] = useState<'login' | 'change' | 'forgot'>('login');
  const [newPw, setNewPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [confirmPw, setConfirmPw] = useState("");
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changePwError, setChangePwError] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Get current user list from localStorage
      let userList = null;
      try {
        const savedUsers = localStorage.getItem('ktgui-users');
        if (savedUsers) {
          userList = JSON.parse(savedUsers);
        }
      } catch (error) {
        console.error('Error parsing saved users:', error);
      }

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, userList }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Accounts still using a system-issued (temporary) password must change it
        // before entering — show the change form instead of redirecting.
        if (data.mustChangePassword === true || data.user?.mustChangePassword === true || data.user?.mustChangePassword === 1) {
          setNewPw("");
          setConfirmPw("");
          setChangePwError("");
          setMode('change');
          setIsLoading(false);
          return;
        }
        finishLogin(data.user);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function finishLogin(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
    try {
      sessionStorage.setItem('ui.currentUser', JSON.stringify(user));
      const role = String(user?.role || '').trim();
      const canManage = role === 'CoE' || role === 'Entity Admin' || role === 'Management' || role === 'Group Head Trader';
      sessionStorage.setItem('ui.canAccessUserList', canManage ? '1' : '0');
    } catch {}
    const normalizedEntity = String(user?.entity || '').trim().toUpperCase();
    const normalizedRole = String(user?.role || '').trim().toUpperCase();
    const isCoE = normalizedEntity === 'ALL';
    const isGroupHeadTrader = normalizedRole === 'GROUP HEAD TRADER';
    if (!isCoE && !isGroupHeadTrader && normalizedEntity) {
      localStorage.setItem('selectedEntity', normalizedEntity);
    }
    // Dealers land on the Sales section; every other role starts on Trade.
    router.replace(normalizedRole === 'DEALER' ? '/sales/deal' : '/');
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangePwError("");
    const pw = newPw;
    const turkishChars = /[\u011f\u00fc\u015f\u00f6\u00e7\u0131\u0130\u011e\u00dc\u015e\u00d6\u00c7]/;
    if (pw.length < 8) { setChangePwError("Password must be at least 8 characters."); return; }
    if (turkishChars.test(pw)) { setChangePwError("Password must not contain Turkish characters."); return; }
    if (!/[A-Z]/.test(pw)) { setChangePwError("Password must contain at least one uppercase letter."); return; }
    if (!/[a-z]/.test(pw)) { setChangePwError("Password must contain at least one lowercase letter."); return; }
    if (!/\d/.test(pw)) { setChangePwError("Password must contain at least one number."); return; }
    if (!/[!@#$%^&*()_+\-=[\]{}|;:',.<>/?]/.test(pw)) { setChangePwError("Password must contain at least one special character."); return; }
    if (pw !== confirmPw) { setChangePwError("Passwords do not match."); return; }
    setChangeLoading(true);
    try {
      // 1) change the password (backend verifies the temporary one)
      const changeRes = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword: password, newPassword: pw }),
      });
      const changeData = await changeRes.json();
      if (!changeRes.ok || !changeData.success) {
        setChangePwError(changeData.error || "Failed to change password.");
        setChangeLoading(false);
        return;
      }
      // 2) sign in with the new password to establish the session
      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.success && !loginData.mustChangePassword) {
        setChangeSuccess(true);
        setTimeout(() => finishLogin(loginData.user), SUCCESS_DELAY_MS);
        return;
      }
      setChangeLoading(false);
      setChangeSuccess(true);
      setTimeout(() => {
        setChangeSuccess(false);
        setMode('login');
        setPassword("");
        setError("Password changed. Please sign in with your new password.");
      }, SUCCESS_DELAY_MS);
    } catch {
      setChangePwError("An error occurred. Please try again.");
      setChangeLoading(false);
    }
  }

  function openForgotPassword() {
    setForgotEmail(email);
    setForgotMsg("");
    setForgotSuccess(false);
    setMode('forgot');
  }

  function backToLogin() {
    setForgotMsg("");
    setForgotSuccess(false);
    setMode('login');
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotMsg("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setForgotMsg("A new password has been sent to your email.");
        setForgotSuccess(true);
        setTimeout(backToLogin, SUCCESS_DELAY_MS);
      } else {
        setForgotMsg(data.error || "No user found with that email.");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setForgotMsg("An error occurred. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        backgroundImage: "url('/arkaplan.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="w-full max-w-[540px] rounded-3xl border p-8 shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(7,49,96,0.88) 0%, rgba(5,36,74,0.92) 100%)',
          borderColor: 'rgba(97,170,217,0.45)',
          color: '#fff',
          backdropFilter: 'blur(2px)',
          fontFamily: 'Segoe UI, Arial, sans-serif',
        }}
      >
        <div className="flex flex-col items-center">
          <img
            src="/ziraat-katilim-seeklogo.png"
            alt="Ziraat Katilim"
            className="object-contain"
            style={{
              width: `${LOGO_SIZE_PERCENT}%`,
              maxWidth: 'none',
              height: 'auto',
              marginTop: `-${LOGO_TRIM_TOP_PERCENT}%`,
              marginBottom: `${LOGO_GAP_BELOW_PX}px`,
              transform: `translateX(${LOGO_OFFSET_X_PERCENT}%)`,
            }}
          />
        </div>

        {mode === 'change' && (
          <form onSubmit={handleChangePassword}>
            <div
              className="mb-2 text-center text-lg font-semibold text-white"
              style={{ marginTop: `-${CHANGE_TITLE_PULL_UP_PX}px` }}
            >
              Change Password
            </div>
            <p className="mb-4 text-sm leading-relaxed text-[#B6D8F0]">This is your first login. For your security, you must update your password.</p>
            <div className="relative mb-4">
              <input
                type={showNewPw ? "text" : "password"}
                placeholder="New Password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 pr-10 text-white placeholder-[#84A8C5] focus:outline-none focus:ring-2"
                style={{ background: 'rgba(10,40,76,0.55)', borderColor: 'rgba(97,170,217,0.35)', focusRingColor: '#2C5680' } as React.CSSProperties}
                required
                disabled={changeLoading}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9EB6CF]" tabIndex={-1} onClick={() => setShowNewPw((v) => !v)} aria-label={showNewPw ? "Hide password" : "Show password"}>
                {showNewPw ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5C7.305 4.5 3.135 7.305 1.5 12c1.635 4.695 5.805 7.5 10.5 7.5s8.865-2.805 10.5-7.5C20.865 7.305 16.695 4.5 12 4.5z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5C7.305 4.5 3.135 7.305 1.5 12c1.635 4.695 5.805 7.5 10.5 7.5s8.865-2.805 10.5-7.5C20.865 7.305 16.695 4.5 12 4.5z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} /><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" /></svg>
                )}
              </button>
            </div>
            <div className="mb-1 text-sm text-[#B6D8F0]">Enter password again</div>
            <div className="relative mb-4">
              <input
                type={showConfirmPw ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 pr-10 text-white placeholder-[#84A8C5] focus:outline-none focus:ring-2"
                style={{ background: 'rgba(10,40,76,0.55)', borderColor: 'rgba(97,170,217,0.35)', focusRingColor: '#2C5680' } as React.CSSProperties}
                required
                disabled={changeLoading}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9EB6CF]" tabIndex={-1} onClick={() => setShowConfirmPw((v) => !v)} aria-label={showConfirmPw ? "Hide password" : "Show password"}>
                {showConfirmPw ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5C7.305 4.5 3.135 7.305 1.5 12c1.635 4.695 5.805 7.5 10.5 7.5s8.865-2.805 10.5-7.5C20.865 7.305 16.695 4.5 12 4.5z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5C7.305 4.5 3.135 7.305 1.5 12c1.635 4.695 5.805 7.5 10.5 7.5s8.865-2.805 10.5-7.5C20.865 7.305 16.695 4.5 12 4.5z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} /><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" /></svg>
                )}
              </button>
            </div>
            {changePwError && <div className="mb-3 text-sm text-[#FF9C9C]">{changePwError}</div>}
            {changeSuccess && (
              <div
                role="status"
                aria-live="polite"
                className="mb-3 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-[#D6FFE4]"
                style={{ background: 'rgba(22,101,52,0.55)', borderColor: 'rgba(74,222,128,0.5)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Your password has been changed successfully.
              </div>
            )}
            <button
              type="submit"
              disabled={changeLoading}
              className={`w-full rounded-xl py-3 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                changeLoading ? 'bg-[#6B7280]' : 'bg-[#2C5680] hover:bg-[#61AAD9]'
              }`}
            >
              <span style={{ fontSize: '15px', lineHeight: 1.3, fontWeight: 600 }}>
                {changeLoading ? "Saving..." : "Save"}
              </span>
            </button>
            <ul className="mt-3 space-y-1">
              {PASSWORD_RULES.map(rule => {
                const met = rule.test(newPw);
                return (
                  <li key={rule.id} className="flex items-center gap-2 text-[13px]">
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: met ? '#FFFFFF' : 'rgba(10,40,76,0.75)',
                        border: `1px solid ${met ? '#FFFFFF' : 'rgba(97,170,217,0.45)'}`,
                        boxShadow: met ? '0 0 6px rgba(255,255,255,0.65)' : 'none',
                      }}
                      aria-hidden="true"
                    >
                      {met && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#073160"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                      )}
                    </span>
                    <span className={met ? 'text-white' : 'text-[#7FA0BE]'}>{rule.label}</span>
                  </li>
                );
              })}
            </ul>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div
              className="mb-4 text-center text-lg font-semibold text-white"
              style={{ marginTop: `-${CHANGE_TITLE_PULL_UP_PX}px` }}
            >
              Forgot Password
            </div>
            <input
              type="email"
              placeholder="Email Address"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="mb-4 w-full rounded-xl border px-4 py-3 text-white placeholder-[#84A8C5] focus:outline-none focus:ring-2"
              style={{ background: 'rgba(10,40,76,0.55)', borderColor: 'rgba(97,170,217,0.35)', focusRingColor: '#2C5680' } as React.CSSProperties}
              required
              disabled={forgotLoading}
            />
            {forgotSuccess ? (
              <div
                role="status"
                aria-live="polite"
                className="mb-3 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-[#D6FFE4]"
                style={{ background: 'rgba(22,101,52,0.55)', borderColor: 'rgba(74,222,128,0.5)' }}
              >
                <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span>
                  {forgotMsg}
                  <br />
                  Returning to Sign In Page
                </span>
              </div>
            ) : (
              forgotMsg && <div className="mb-3 text-sm text-[#FF9C9C]">{forgotMsg}</div>
            )}
            <button
              type="submit"
              disabled={forgotLoading || forgotSuccess}
              className={`login-btn w-full rounded-xl py-3 text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                forgotLoading ? 'bg-[#6B7280]' : 'bg-[#2C5680] hover:bg-[#61AAD9]'
              }`}
            >
              {forgotLoading ? "Sending..." : "Send New Password"}
            </button>
            <button
              type="button"
              className="login-btn mt-3 w-full rounded-xl border border-[#61AAD9]/50 bg-transparent py-2 text-[#B6D8F0] hover:bg-[#163C66]"
              onClick={backToLogin}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {mode === 'login' && (
          <>
            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mb-4 w-full rounded-xl border px-4 py-3 text-white placeholder-[#84A8C5] focus:outline-none focus:ring-2"
                style={{ background: 'rgba(10,40,76,0.55)', borderColor: 'rgba(97,170,217,0.35)', focusRingColor: '#2C5680' } as React.CSSProperties}
                required
                disabled={isLoading}
              />
              <div className="relative mb-4">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 pr-10 text-white placeholder-[#84A8C5] focus:outline-none focus:ring-2"
                  style={{ background: 'rgba(10,40,76,0.55)', borderColor: 'rgba(97,170,217,0.35)', focusRingColor: '#2C5680' } as React.CSSProperties}
                  required
                  disabled={isLoading}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9EB6CF]" tabIndex={-1} onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5C7.305 4.5 3.135 7.305 1.5 12c1.635 4.695 5.805 7.5 10.5 7.5s8.865-2.805 10.5-7.5C20.865 7.305 16.695 4.5 12 4.5z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5C7.305 4.5 3.135 7.305 1.5 12c1.635 4.695 5.805 7.5 10.5 7.5s8.865-2.805 10.5-7.5C20.865 7.305 16.695 4.5 12 4.5z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} /><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" /></svg>
                  )}
                </button>
              </div>
              {error && <div className="mb-3 text-sm text-[#FF9C9C]">{error}</div>}
              <button
                type="submit"
                disabled={isLoading}
                className={`login-btn w-full rounded-xl py-3 text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLoading ? 'bg-[#6B7280]' : 'bg-[#2C5680] hover:bg-[#61AAD9]'
                }`}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <button
              type="button"
              className="login-btn mt-3 w-full rounded-xl border border-[#61AAD9]/50 bg-transparent py-2 text-[#B6D8F0] hover:bg-[#163C66]"
              onClick={openForgotPassword}
            >
              Forgot Password?
            </button>
          </>
        )}
      </div>
    </div>
  );
}
