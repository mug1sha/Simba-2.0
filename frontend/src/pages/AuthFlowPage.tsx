import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Lock, Eye, EyeOff, CheckCircle2, ShoppingBag, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleDashboardPath } from "@/lib/auth";
import { readErrorMessage, readJsonResponse } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { BRANCH_NAMES } from "@/lib/branches";

type InvitePreview = {
  email?: string | null;
  role: "branch_manager" | "branch_staff";
  branch?: string | null;
  expires_at: string;
};

export const AuthFlowPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const { t } = useLanguage();
  
  const token = searchParams.get("token");
  const isReset = location.pathname.includes("reset-password");
  const isVerify = location.pathname.includes("verify-email");
  const isInvite = location.pathname.includes("invite");

  const [loading, setLoading] = useState(isVerify || isInvite);
  const [status, setStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [branch, setBranch] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const getPwdStrength = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score++;
    return score;
  };
  const strengthData = [
    { label: t("auth.strength.very_weak"), color: "bg-red-500" },
    { label: t("auth.strength.weak"), color: "bg-orange-500" },
    { label: t("auth.strength.medium"), color: "bg-yellow-500" },
    { label: t("auth.strength.strong"), color: "bg-green-500" },
    { label: t("auth.strength.very_strong"), color: "bg-blue-500" },
  ];

  const roleLabel = invitePreview?.role === "branch_manager" ? t("auth.role.admin") : t("auth.role.staff");

  useEffect(() => {
    if (!invitePreview) return;
    setBranch(invitePreview.branch || BRANCH_NAMES[0] || "");
  }, [invitePreview]);

  const handleVerify = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token || "")}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Verification failed"));
      setStatus("SUCCESS");
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleInvitePreview = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/invites/${encodeURIComponent(token || "")}`);
      if (!res.ok) throw new Error(await readErrorMessage(res, "Invite link not found"));
      const data = await readJsonResponse(res, "Invite link response was empty.");
      setInvitePreview(data);
      if (data.email) {
        setEmail(data.email);
      }
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isVerify && token) {
      handleVerify();
      return;
    }
    if (isInvite && token) {
      handleInvitePreview();
      return;
    }
    if (isVerify && !token) {
      setStatus("ERROR");
      setErrorMsg(t("auth.flow.missing_verification_token"));
      setLoading(false);
      return;
    }
    if (isInvite && !token) {
      setStatus("ERROR");
      setErrorMsg(t("auth.flow.missing_invite_token"));
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [handleInvitePreview, handleVerify, isInvite, isVerify, t, token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast({ title: t("common.error"), description: t("auth.flow.missing_reset_token"), variant: "destructive" });
    if (newPwd !== confirmPwd) return toast({ title: t("common.error"), description: t("auth.toast.passwords_do_not_match"), variant: "destructive" });
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPwd })
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Reset failed"));
      setStatus("SUCCESS");
      toast({ title: t("common.success"), description: t("auth.flow.password_updated") });
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMsg(err.message);
      toast({ title: t("auth.flow.reset_failed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast({ title: t("common.error"), description: t("auth.flow.missing_invite_token"), variant: "destructive" });
    if (!invitePreview) return toast({ title: t("common.error"), description: t("auth.flow.invite_details_missing"), variant: "destructive" });
    if (newPwd !== confirmPwd) return toast({ title: t("common.error"), description: t("auth.toast.passwords_do_not_match"), variant: "destructive" });

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: newPwd,
          first_name: firstName,
          last_name: lastName,
          phone,
          branch,
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "Invite acceptance failed"));
      const data = await readJsonResponse(res, "Invite acceptance failed: server returned an empty response.");
      const nextUser = await login(data);
      toast({
        title: t("auth.flow.account_ready"),
        description: t("auth.flow.access_created", { role: roleLabel, branch: invitePreview.branch || "" }),
      });
      navigate(getRoleDashboardPath(nextUser?.role || invitePreview.role));
    } catch (err: any) {
      toast({ title: t("auth.flow.invite_failed"), description: err.message, variant: "destructive" });
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px]" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[480px] relative z-10">
        <div className="bg-[#0c0c1e]/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 p-10 shadow-[0_48px_96px_rgba(0,0,0,0.6)] overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />
          
          <div className="relative text-center">
            {/* Header */}
            <div className="flex flex-col items-center mb-10">
              <motion.div whileHover={{ rotate: [0, -10, 10, 0] }} className="w-16 h-16 bg-gradient-to-br from-primary to-orange-600 p-[1px] rounded-2xl mb-4">
                <div className="w-full h-full bg-[#0c0c1e] rounded-2xl flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-primary" />
                </div>
              </motion.div>
              <h1 className="text-white text-2xl font-black tracking-widest uppercase">Simba</h1>
            </div>

            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-10">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto pb-4" />
                  <p className="text-gray-400 mt-6 font-medium">{t("auth.flow.processing")}</p>
                </motion.div>
              ) : status === "SUCCESS" ? (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 py-4">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-bold mb-3">{isReset ? t("auth.flow.password_reset_complete") : t("auth.flow.email_verified")}</h2>
                    <p className="text-gray-400 leading-relaxed">
                      {isReset 
                        ? t("auth.flow.password_reset_complete_desc")
                        : t("auth.flow.email_verified_desc")}
                    </p>
                  </div>
                  <button onClick={() => navigate("/")} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/30 hover:brightness-110 transition-all">
                    {t("auth.flow.return_to_simba")}
                  </button>
                </motion.div>
              ) : status === "ERROR" ? (
                <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 py-4">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
                    <XCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-bold mb-3">{t("auth.flow.error_title")}</h2>
                    <p className="text-red-400/80 leading-relaxed">{errorMsg}</p>
                  </div>
                  <button onClick={() => navigate("/")} className="w-full h-14 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all">
                    {t("auth.flow.return_home")}
                  </button>
                </motion.div>
              ) : isInvite ? (
                <motion.form key="invite-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleInviteAccept} className="space-y-5 text-left">
                  <div className="text-center mb-8">
                    <h2 className="text-white text-2xl font-bold mb-2">{t("auth.invite.title")}</h2>
                    <p className="text-gray-500">
                      {invitePreview ? t("auth.invite.subtitle", { role: roleLabel, branch: invitePreview.branch || "" }) : t("auth.invite.required")}
                    </p>
                  </div>

                  {invitePreview && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                      <p className="font-bold">{roleLabel}</p>
                      <p className="mt-1 text-xs text-primary/80">
                        {invitePreview.branch
                          ? t("auth.invite.branch_change_allowed", { branch: invitePreview.branch })
                          : t("auth.invite.choose_branch")}
                      </p>
                      <p className="mt-1 text-xs text-primary/80">
                        {t("auth.invite.expires", { date: new Date(invitePreview.expires_at).toLocaleString() })}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder={t("auth.field.first_name")}
                      required
                      className="h-14 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none focus:border-primary/60"
                    />
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder={t("auth.field.last_name")}
                      required
                      className="h-14 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none focus:border-primary/60"
                    />
                  </div>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("auth.field.email")}
                    required
                    readOnly={!!invitePreview?.email}
                    className={`h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none focus:border-primary/60 ${
                      invitePreview?.email ? "cursor-not-allowed opacity-70" : ""
                    }`}
                  />

                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={t("auth.field.phone")}
                    required
                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none focus:border-primary/60"
                  />

                  <select
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                    required
                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none focus:border-primary/60"
                  >
                    {!branch && (
                      <option value="" disabled className="bg-[#0c0c1e] text-gray-400">
                        {t("auth.invite.choose_branch")}
                      </option>
                    )}
                    {BRANCH_NAMES.map((branchName) => (
                      <option key={branchName} value={branchName} className="bg-[#0c0c1e] text-white">
                        {branchName}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors z-10" />
                        <input type={showPwd ? "text" : "password"} placeholder={t("auth.invite.create_password")} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required
                          className="w-full h-14 pl-12 pr-12 bg-white/[0.06] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/60 transition-all" />
                        <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                          {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {newPwd && (
                        <div className="px-1">
                          <div className="flex gap-1 h-1.5 mt-2">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i < getPwdStrength(newPwd) ? strengthData[getPwdStrength(newPwd) - 1].color : "bg-white/10"}`} />
                            ))}
                          </div>
                          <p className="text-[10px] text-right mt-1.5 font-medium" style={{ color: getPwdStrength(newPwd) > 0 ? "" : "gray" }}>
                            {getPwdStrength(newPwd) > 0 ? strengthData[getPwdStrength(newPwd) - 1].label : t("auth.flow.security_level")}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors z-10" />
                      <input type={showConfirm ? "text" : "password"} placeholder={t("auth.field.confirm_password")} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required
                        className="w-full h-14 pl-12 pr-12 bg-white/[0.06] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/60 transition-all" />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                        {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/30 mt-4 flex items-center justify-center">
                    {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("auth.signup.button")}
                  </button>
                </motion.form>
              ) : isReset ? (
                <motion.form key="reset-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleReset} className="space-y-5 text-left">
                  <div className="text-center mb-8">
                    <h2 className="text-white text-2xl font-bold mb-2">{t("auth.reset.title")}</h2>
                    <p className="text-gray-500">{t("auth.reset.subtitle")}</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors z-10" />
                        <input type={showPwd ? "text" : "password"} placeholder={t("auth.reset.new_password")} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required
                          className="w-full h-14 pl-12 pr-12 bg-white/[0.06] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/60 transition-all" />
                        <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                          {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {newPwd && (
                        <div className="px-1">
                          <div className="flex gap-1 h-1.5 mt-2">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${i < getPwdStrength(newPwd) ? strengthData[getPwdStrength(newPwd) - 1].color : "bg-white/10"}`} />
                            ))}
                          </div>
                          <p className="text-[10px] text-right mt-1.5 font-medium" style={{ color: getPwdStrength(newPwd) > 0 ? "" : "gray" }}>
                            {getPwdStrength(newPwd) > 0 ? strengthData[getPwdStrength(newPwd) - 1].label : t("auth.flow.security_level")}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors z-10" />
                      <input type={showConfirm ? "text" : "password"} placeholder={t("auth.reset.confirm_new_password")} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required
                        className="w-full h-14 pl-12 pr-12 bg-white/[0.06] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/60 transition-all" />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                        {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/30 mt-4 flex items-center justify-center">
                    {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("auth.reset.button")}
                  </button>
                </motion.form>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
