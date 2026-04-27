import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff, Mail, Lock, User, ShoppingBag, ArrowRight, CheckCircle2, Phone, LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getRoleDashboardPath, type UserRole } from "@/lib/auth";
import { readErrorMessage } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import GoogleAuthButton from "@/components/GoogleAuthButton";

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthState = "LOGIN" | "SIGNUP" | "FORGOT_PASSWORD" | "SUCCESS_MSG";

type RoleInviteLink = {
  email?: string | null;
  role: "branch_manager" | "branch_staff";
  branch?: string | null;
  expires_at: string;
  invite_url: string;
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 28 } },
};

const panelSwitch: Variants = {
  enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
  exit: (d: number) => ({ x: d < 0 ? 50 : -50, opacity: 0, transition: { duration: 0.15 } }),
};

const STRENGTH_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-blue-500",
];

const getPwdStrength = (p: string) => {
  let score = 0;
  if (!p) return 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[a-z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score++;
  return score;
};

const SocBtn: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
  <motion.button type="button" onClick={onClick} whileHover={{ y: -2, scale: 1.05 }} whileTap={{ scale: 0.95 }}
    className="flex-1 h-11 bg-white/[0.05] border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all">
    {children}
  </motion.button>
);

const Field: React.FC<{ id: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void; Icon: LucideIcon; toggle?: boolean; visible?: boolean; onToggle?: () => void; required?: boolean; }> = ({ id, type = "text", placeholder, value, onChange, Icon, toggle, visible, onToggle, required = true }) => (
  <motion.div variants={fadeUp} className="relative group">
    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors z-10 pointer-events-none" />
    <input id={id} type={toggle ? (visible ? "text" : "password") : type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} required={required}
      className="w-full h-11 pl-11 pr-11 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 hover:bg-white/[0.08] transition-all" />
    {toggle && (
      <button type="button" onClick={onToggle} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 z-10">
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    )}
  </motion.div>
);

export const AuthDialog: React.FC<AuthDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthState>("LOGIN");
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ title: string; message: string; link?: string | null }>({ title: "", message: "" });
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState(false);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pwd, setPwd] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("customer");
  const [managerInvites, setManagerInvites] = useState<RoleInviteLink[]>([]);
  const [selectedManagerInvite, setSelectedManagerInvite] = useState("");
  const [managerInvitesLoading, setManagerInvitesLoading] = useState(false);

  const strength = getPwdStrength(pwd);

  const { login } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const strengthLabels = [
    t("auth.strength.very_weak"),
    t("auth.strength.weak"),
    t("auth.strength.medium"),
    t("auth.strength.strong"),
    t("auth.strength.very_strong"),
  ];

  const handleSwitch = (newView: AuthState, d: number) => { setDir(d); setView(newView); setNeedsVerificationEmail(false); };
  const reset = () => {
    setEmail("");
    setPhone("");
    setPwd("");
    setFirstName("");
    setLastName("");
    setConfirmPwd("");
    setAgreed(false);
    setNeedsVerificationEmail(false);
    setSelectedRole("customer");
    setManagerInvites([]);
    setSelectedManagerInvite("");
    setView("LOGIN");
  };
  const handleClose = () => { reset(); onClose(); };

  useEffect(() => {
    if (!isOpen || selectedRole !== "branch_manager") {
      setManagerInvitesLoading(false);
      return;
    }

    let active = true;

    const loadManagerInvites = async () => {
      setManagerInvitesLoading(true);
      try {
        const res = await fetch("/api/dev/manager-invites");
        if (!res.ok) {
          throw new Error("Manager invite lookup unavailable");
        }
        const data = await res.json() as RoleInviteLink[];
        if (!active) return;
        setManagerInvites(data);
        setSelectedManagerInvite((current) => current || data[0]?.invite_url || "");
      } catch {
        if (!active) return;
        setManagerInvites([]);
        setSelectedManagerInvite("");
      } finally {
        if (active) {
          setManagerInvitesLoading(false);
        }
      }
    };

    loadManagerInvites();
    return () => {
      active = false;
    };
  }, [isOpen, selectedRole]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pwd, role: selectedRole }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Login failed"));
      const data = await res.json();
      setNeedsVerificationEmail(false);
      const loggedInUser = await login(data);
      toast({ title: t("auth.toast.welcome_back"), description: t("auth.toast.logged_in_as", { email }) });
      handleClose();
      navigate(getRoleDashboardPath(loggedInUser?.role || selectedRole));
    } catch (err: any) {
      const message = err.message || "Login failed";
      setNeedsVerificationEmail(message.toLowerCase().includes("verify"));
      toast({ title: t("auth.toast.login_failed"), description: message, variant: "destructive" });
    }
    finally { setLoading(false); }
  };

  const handleGoogleAuthSuccess = async (data: any) => {
    setNeedsVerificationEmail(false);
    const loggedInUser = await login(data);
    toast({
      title: t("auth.toast.welcome_back"),
      description: "Google authentication completed successfully.",
    });
    handleClose();
    navigate(getRoleDashboardPath(loggedInUser?.role || "customer"));
  };

  const handleResendVerification = async () => {
    if (!email) return toast({ title: t("auth.toast.email_required"), description: t("auth.toast.enter_email_first"), variant: "destructive" });
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Could not resend verification email"));
      const data = await res.json();
      setSuccessInfo({
        title: t("auth.success.verification_link_sent"),
        message: data.dev_link
          ? t("auth.success.local_verify_email_ready")
          : data.message,
        link: data.dev_link,
      });
      handleSwitch("SUCCESS_MSG", 1);
    } catch (err: any) {
      toast({ title: t("auth.toast.verification_failed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== confirmPwd) return toast({ title: t("common.error"), description: t("auth.toast.passwords_do_not_match"), variant: "destructive" });
    if (!agreed) return toast({ title: t("common.error"), description: t("auth.toast.agree_terms"), variant: "destructive" });
    if (strength < 4) return toast({ title: t("auth.toast.weak_password"), description: t("auth.toast.create_stronger_password"), variant: "destructive" });
    
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ email, phone, password: pwd, first_name: firstName, last_name: lastName }) 
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Signup failed"));
      const data = await res.json();
      setSuccessInfo({
        title: t("auth.success.check_email"),
        message: data.dev_link
          ? t("auth.success.local_signup_email_ready")
          : data.message,
        link: data.dev_link,
      });
      handleSwitch("SUCCESS_MSG", 1);
    } catch (err: any) { toast({ title: t("auth.toast.signup_failed"), description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Request failed"));
      const data = await res.json();
      setSuccessInfo({
        title: t("auth.success.reset_link_sent"),
        message: data.dev_link
          ? t("auth.success.local_reset_email_ready")
          : data.message,
        link: data.dev_link,
      });
      handleSwitch("SUCCESS_MSG", 1);
    } catch (err: any) { toast({ title: t("common.error"), description: t("auth.toast.request_failed"), variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 border-0 bg-transparent shadow-none overflow-visible">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-[#080818]/90 backdrop-blur-2xl rounded-[2rem] border border-white/10 overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-white/[0.02]" />
          <div className="relative z-10 px-9 py-10">
            {/* Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl flex items-center justify-center mb-3 border border-primary/20 shadow-lg shadow-primary/10">
                <ShoppingBag className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-heading font-black tracking-[0.2em] text-white text-base uppercase">Simba</h2>
            </div>

            <AnimatePresence custom={dir} mode="wait">
              {view === "LOGIN" && (
                <motion.form key="login" custom={dir} variants={panelSwitch} initial="enter" animate="center" exit="exit" onSubmit={handleLogin} className="space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="text-white text-xl font-bold">{t("auth.login.title")}</h3>
                    <p className="text-gray-500 text-sm">{t("auth.login.subtitle")}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "customer", label: t("auth.role.customer") },
                        { id: "branch_manager", label: t("auth.role.admin") },
                        { id: "branch_staff", label: t("auth.role.staff") },
                      ].map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setSelectedRole(role.id as UserRole)}
                          className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide transition-all ${
                            selectedRole === role.id ? "bg-primary text-white" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field id="l-email" type="email" placeholder={t("auth.field.email")} value={email} onChange={setEmail} Icon={Mail} />
                  <Field id="l-pwd" placeholder={t("auth.field.password")} value={pwd} onChange={setPwd} Icon={Lock} toggle visible={showPwd} onToggle={() => setShowPwd(!showPwd)} />
                  {selectedRole === "customer" && (
                    <>
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">or continue with Google</span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                      <GoogleAuthButton
                        intent="login"
                        onSuccess={handleGoogleAuthSuccess}
                        onError={(message) => toast({ title: t("auth.toast.login_failed"), description: message, variant: "destructive" })}
                      />
                    </>
                  )}
                  {selectedRole !== "customer" && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-[11px] leading-relaxed text-primary">
                      <p>{t("auth.invite.private_only")}</p>
                      <p className="mt-1">{t("auth.invite.private_only_desc")}</p>
                    </div>
                  )}
                  {selectedRole === "branch_manager" && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t("auth.invite.admin_access")}</p>
                      <p className="mt-2 text-xs leading-relaxed text-gray-400">{t("auth.invite.admin_access_desc")}</p>
                      {managerInvitesLoading ? (
                        <p className="mt-3 text-xs text-gray-500">{t("auth.invite.loading_admin_links")}</p>
                      ) : managerInvites.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          <select
                            value={selectedManagerInvite}
                            onChange={(event) => setSelectedManagerInvite(event.target.value)}
                            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none focus:border-primary/60"
                          >
                            {managerInvites.map((invite) => (
                              <option key={invite.invite_url} value={invite.invite_url} className="bg-[#080818] text-white">
                                {invite.branch || t("auth.role.admin")}
                              </option>
                            ))}
                          </select>
                          <motion.button
                            type="button"
                            onClick={() => selectedManagerInvite && window.location.assign(selectedManagerInvite)}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={!selectedManagerInvite}
                            className="w-full h-11 rounded-xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t("auth.invite.open_admin_signup")}
                          </motion.button>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-gray-500">{t("auth.invite.no_admin_links")}</p>
                      )}
                    </div>
                  )}
                  <div className="text-right"><button type="button" onClick={() => handleSwitch("FORGOT_PASSWORD", 1)} className="text-primary text-xs hover:underline">{t("auth.login.forgot_password")}</button></div>
                  <motion.button type="submit" disabled={loading} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t("auth.login.button")} <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                  {needsVerificationEmail && (
                    <button type="button" onClick={handleResendVerification} disabled={loading} className="w-full h-11 rounded-xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all">
                      {t("auth.login.resend_verification")}
                    </button>
                  )}
                  <p className="text-center text-gray-500 text-sm">{t("auth.login.no_account")} <button type="button" onClick={() => handleSwitch("SIGNUP", 1)} className="text-primary font-semibold hover:underline">{t("auth.login.sign_up")}</button></p>
                </motion.form>
              )}

              {view === "SIGNUP" && (
                <motion.form key="signup" custom={dir} variants={panelSwitch} initial="enter" animate="center" exit="exit" onSubmit={handleSignup} className="space-y-3.5">
                  <div className="text-center mb-5 split">
                    <h3 className="text-white text-xl font-bold">{t("auth.signup.title")}</h3>
                    <p className="text-gray-500 text-sm">{t("auth.signup.subtitle")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="s-fn" placeholder={t("auth.field.first_name")} value={firstName} onChange={setFirstName} Icon={User} />
                    <Field id="s-ln" placeholder={t("auth.field.last_name")} value={lastName} onChange={setLastName} Icon={User} />
                  </div>
                  <Field id="s-email" type="email" placeholder={t("auth.field.email")} value={email} onChange={setEmail} Icon={Mail} />
                  <Field id="s-phone" type="tel" placeholder={t("auth.field.phone")} value={phone} onChange={setPhone} Icon={Phone} />
                  <div className="space-y-1">
                    <Field id="s-pwd" placeholder={t("auth.field.password")} value={pwd} onChange={setPwd} Icon={Lock} toggle visible={showPwd} onToggle={() => setShowPwd(!showPwd)} />
                    {pwd && (
                      <div className="px-1">
                        <div className="flex gap-1 h-1 mt-2">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i < strength ? STRENGTH_COLORS[strength - 1] : "bg-white/10"}`} />
                          ))}
                        </div>
                        <p className="text-[10px] text-right mt-1 font-medium" style={{ color: strength > 0 ? "" : "gray" }}>
                          {strength > 0 ? strengthLabels[strength - 1] : t("auth.strength.start_typing")}
                        </p>
                      </div>
                    )}
                  </div>
                  <Field id="s-cpwd" placeholder={t("auth.field.confirm_password")} value={confirmPwd} onChange={setConfirmPwd} Icon={Lock} toggle visible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">or continue with Google</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <GoogleAuthButton
                    intent="signup"
                    onSuccess={handleGoogleAuthSuccess}
                    onError={(message) => toast({ title: t("auth.toast.signup_failed"), description: message, variant: "destructive" })}
                  />
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input type="checkbox" className="hidden" checked={agreed} onChange={() => setAgreed(!agreed)} />
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${agreed ? "bg-primary border-primary" : "border-white/20 bg-white/5"}`}>{agreed && <CheckCircle2 className="w-3 h-3 text-white" />}</div>
                    <span className="text-gray-500 text-[11px] leading-relaxed">{t("auth.signup.agree_prefix")} <span className="text-primary group-hover:underline">{t("auth.signup.terms")}</span></span>
                  </label>
                  <motion.button type="submit" disabled={loading} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20">
                    {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("auth.signup.button")}
                  </motion.button>
                  <p className="text-center text-gray-500 text-sm">{t("auth.signup.already_registered")} <button type="button" onClick={() => handleSwitch("LOGIN", -1)} className="text-primary font-semibold hover:underline">{t("auth.login.button")}</button></p>
                </motion.form>
              )}

              {view === "FORGOT_PASSWORD" && (
                <motion.form key="forgot" custom={dir} variants={panelSwitch} initial="enter" animate="center" exit="exit" onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="text-center mb-6">
                    <h3 className="text-white text-xl font-bold">{t("auth.forgot.title")}</h3>
                    <p className="text-gray-500 text-sm">{t("auth.forgot.subtitle")}</p>
                  </div>
                  <Field id="f-email" type="email" placeholder={t("auth.field.email")} value={email} onChange={setEmail} Icon={Mail} />
                  <motion.button type="submit" disabled={loading} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="w-full h-12 bg-primary text-white font-bold rounded-xl">
                    {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("auth.forgot.button")}
                  </motion.button>
                  <button type="button" onClick={() => handleSwitch("LOGIN", -1)} className="w-full text-gray-400 text-sm hover:text-white transition-colors">{t("auth.common.back_to_login")}</button>
                </motion.form>
              )}

              {view === "SUCCESS_MSG" && (
                <motion.div key="success" custom={dir} variants={panelSwitch} initial="enter" animate="center" exit="exit" className="text-center py-6 space-y-6">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-white text-xl font-bold mb-2">{successInfo.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{successInfo.message}</p>
                  </div>
                  {successInfo.link && (
                    <a href={successInfo.link} className="block w-full h-12 bg-primary text-white font-semibold rounded-xl hover:brightness-110 transition-all leading-[3rem]">
                      {t("auth.success.open_local_email_link")}
                    </a>
                  )}
                  <motion.button onClick={() => handleSwitch("LOGIN", -1)} whileHover={{ y: -2 }} className="w-full h-12 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10">
                    {t("auth.common.back_to_login")}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
