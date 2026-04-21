import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Lock, Eye, EyeOff, CheckCircle2, ShoppingBag, XCircle } from "lucide-react";

export const AuthFlowPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const token = searchParams.get("token");
  const isReset = window.location.pathname.includes("reset-password");
  const isVerify = window.location.pathname.includes("verify-email");

  const [loading, setLoading] = useState(isVerify);
  const [status, setStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMsg, setErrorMsg] = useState("");
  
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isVerify && token) {
      handleVerify();
    }
  }, []);

  const handleVerify = async () => {
    try {
      const res = await fetch(`/api/auth/verify-email?token=${token}`);
      if (!res.ok) throw new Error((await res.json()).detail || "Verification failed");
      setStatus("SUCCESS");
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) return toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPwd })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Reset failed");
      setStatus("SUCCESS");
      toast({ title: "Success! 🗝️", description: "Your password has been updated." });
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMsg(err.message);
      toast({ title: "Reset Failed", description: err.message, variant: "destructive" });
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
                  <p className="text-gray-400 mt-6 font-medium">Processing your request...</p>
                </motion.div>
              ) : status === "SUCCESS" ? (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 py-4">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/30">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-bold mb-3">{isReset ? "Password Reset Complete!" : "Email Verified!"}</h2>
                    <p className="text-gray-400 leading-relaxed">
                      {isReset 
                        ? "You can now log in to your Simba account with your new password." 
                        : "Thank you for verifying your email. Your account is now fully active."}
                    </p>
                  </div>
                  <button onClick={() => navigate("/")} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/30 hover:brightness-110 transition-all">
                    Return to Simba
                  </button>
                </motion.div>
              ) : status === "ERROR" ? (
                <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 py-4">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
                    <XCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-white text-2xl font-bold mb-3">Something went wrong</h2>
                    <p className="text-red-400/80 leading-relaxed">{errorMsg}</p>
                  </div>
                  <button onClick={() => navigate("/")} className="w-full h-14 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all">
                    Return Home
                  </button>
                </motion.div>
              ) : isReset ? (
                <motion.form key="reset-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleReset} className="space-y-5 text-left">
                  <div className="text-center mb-8">
                    <h2 className="text-white text-2xl font-bold mb-2">Set New Password</h2>
                    <p className="text-gray-500">Create a secure password for your account</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors z-10" />
                      <input type={showPwd ? "text" : "password"} placeholder="New password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required
                        className="w-full h-14 pl-12 pr-12 bg-white/[0.06] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/60 transition-all" />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                        {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>

                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors z-10" />
                      <input type={showConfirm ? "text" : "password"} placeholder="Confirm new password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required
                        className="w-full h-14 pl-12 pr-12 bg-white/[0.06] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/60 transition-all" />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                        {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/30 mt-4 flex items-center justify-center">
                    {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Update Password"}
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
