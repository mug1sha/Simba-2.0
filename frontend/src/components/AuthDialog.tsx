import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff, Mail, Lock, User, ShoppingBag, ArrowRight, CheckCircle2 } from "lucide-react";

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthState = "LOGIN" | "SIGNUP" | "FORGOT_PASSWORD" | "SUCCESS_MSG";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 28 } },
};

const panelSwitch = {
  enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
  exit: (d: number) => ({ x: d < 0 ? 50 : -50, opacity: 0, transition: { duration: 0.15 } }),
};

const SocBtn: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
  <motion.button type="button" onClick={onClick} whileHover={{ y: -2, scale: 1.05 }} whileTap={{ scale: 0.95 }}
    className="flex-1 h-11 bg-white/[0.05] border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all">
    {children}
  </motion.button>
);

const Field: React.FC<{ id: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void; Icon: any; toggle?: boolean; visible?: boolean; onToggle?: () => void; required?: boolean; }> = ({ id, type = "text", placeholder, value, onChange, Icon, toggle, visible, onToggle, required = true }) => (
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
  const [view, setView] = useState<AuthState>("LOGIN");
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ title: "", message: "" });

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const { login } = useAuth();
  const { toast } = useToast();

  const handleSwitch = (newView: AuthState, d: number) => { setDir(d); setView(newView); };
  const reset = () => { setEmail(""); setPwd(""); setFirstName(""); setLastName(""); setConfirmPwd(""); setAgreed(false); setView("LOGIN"); };
  const handleClose = () => { reset(); onClose(); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append("username", email); form.append("password", pwd);
      const res = await fetch("/api/auth/login", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).detail || "Login failed");
      const data = await res.json();
      login(data.access_token);
      toast({ title: "Welcome back! 🎉", description: `Logged in as ${email}` });
      handleClose();
    } catch (err: any) { toast({ title: "Login Failed", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== confirmPwd) return toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
    if (!agreed) return toast({ title: "Error", description: "Please agree to Terms", variant: "destructive" });
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pwd, first_name: firstName, last_name: lastName }) });
      if (!res.ok) throw new Error((await res.json()).detail || "Signup failed");
      setSuccessInfo({ title: "Check your email! 📧", message: "We've sent a verification link to your email address." });
      handleSwitch("SUCCESS_MSG", 1);
    } catch (err: any) { toast({ title: "Signup Failed", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!res.ok) throw new Error("Request failed");
      setSuccessInfo({ title: "Reset link sent! 🗝️", message: "If an account exists for this email, you'll receive a password reset link shortly." });
      handleSwitch("SUCCESS_MSG", 1);
    } catch (err: any) { toast({ title: "Error", description: "Could not process request", variant: "destructive" }); }
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
                    <h3 className="text-white text-xl font-bold">Welcome Back</h3>
                    <p className="text-gray-500 text-sm">Sign in to your account</p>
                  </div>
                  <Field id="l-email" type="email" placeholder="Email address" value={email} onChange={setEmail} Icon={Mail} />
                  <Field id="l-pwd" placeholder="Password" value={pwd} onChange={setPwd} Icon={Lock} toggle visible={showPwd} onToggle={() => setShowPwd(!showPwd)} />
                  <div className="text-right"><button type="button" onClick={() => handleSwitch("FORGOT_PASSWORD", 1)} className="text-primary text-xs hover:underline">Forgot password?</button></div>
                  <motion.button type="submit" disabled={loading} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Login <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                  <p className="text-center text-gray-500 text-sm">Don't have an account? <button type="button" onClick={() => handleSwitch("SIGNUP", 1)} className="text-primary font-semibold hover:underline">Sign up</button></p>
                </motion.form>
              )}

              {view === "SIGNUP" && (
                <motion.form key="signup" custom={dir} variants={panelSwitch} initial="enter" animate="center" exit="exit" onSubmit={handleSignup} className="space-y-3.5">
                  <div className="text-center mb-5 split">
                    <h3 className="text-white text-xl font-bold">Create Account</h3>
                    <p className="text-gray-500 text-sm">Join Simba Supermarket</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="s-fn" placeholder="First name" value={firstName} onChange={setFirstName} Icon={User} />
                    <Field id="s-ln" placeholder="Last name" value={lastName} onChange={setLastName} Icon={User} />
                  </div>
                  <Field id="s-email" type="email" placeholder="Email address" value={email} onChange={setEmail} Icon={Mail} />
                  <Field id="s-pwd" placeholder="Password" value={pwd} onChange={setPwd} Icon={Lock} toggle visible={showPwd} onToggle={() => setShowPwd(!showPwd)} />
                  <Field id="s-cpwd" placeholder="Confirm password" value={confirmPwd} onChange={setConfirmPwd} Icon={Lock} toggle visible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input type="checkbox" className="hidden" checked={agreed} onChange={() => setAgreed(!agreed)} />
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${agreed ? "bg-primary border-primary" : "border-white/20 bg-white/5"}`}>{agreed && <CheckCircle2 className="w-3 h-3 text-white" />}</div>
                    <span className="text-gray-500 text-[11px] leading-relaxed">I agree to the <span className="text-primary group-hover:underline">Terms & Conditions</span></span>
                  </label>
                  <motion.button type="submit" disabled={loading} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20">
                    {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Account"}
                  </motion.button>
                  <p className="text-center text-gray-500 text-sm">Already registered? <button type="button" onClick={() => handleSwitch("LOGIN", -1)} className="text-primary font-semibold hover:underline">Login</button></p>
                </motion.form>
              )}

              {view === "FORGOT_PASSWORD" && (
                <motion.form key="forgot" custom={dir} variants={panelSwitch} initial="enter" animate="center" exit="exit" onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="text-center mb-6">
                    <h3 className="text-white text-xl font-bold">Forgot Password</h3>
                    <p className="text-gray-500 text-sm">Enter your email to reset your password</p>
                  </div>
                  <Field id="f-email" type="email" placeholder="Email address" value={email} onChange={setEmail} Icon={Mail} />
                  <motion.button type="submit" disabled={loading} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="w-full h-12 bg-primary text-white font-bold rounded-xl">
                    {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Send Reset Link"}
                  </motion.button>
                  <button type="button" onClick={() => handleSwitch("LOGIN", -1)} className="w-full text-gray-400 text-sm hover:text-white transition-colors">Back to Login</button>
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
                  <motion.button onClick={() => handleSwitch("LOGIN", -1)} whileHover={{ y: -2 }} className="w-full h-12 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10">
                    Back to Login
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
