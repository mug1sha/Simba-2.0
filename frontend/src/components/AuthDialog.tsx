import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff, Mail, Lock, User, ShoppingBag, ArrowRight, Phone } from "lucide-react";

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── Animation presets ─────────────────────────────────────── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 380, damping: 26 } },
};
const panelSwitch = {
  enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.95, filter: "blur(8px)" }),
  center: { x: 0, opacity: 1, scale: 1, filter: "blur(0px)", transition: { type: "spring", stiffness: 280, damping: 28 } },
  exit: (d: number) => ({ x: d < 0 ? 80 : -80, opacity: 0, scale: 0.95, filter: "blur(8px)", transition: { duration: 0.18 } }),
};

/* ─── Icon helpers ──────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 533.5 544.3">
    <path d="M533.5 278.4c0-18.4-1.5-36.1-4.3-53.3H272.1v101h147c-6.3 34-25.5 62.6-54.4 81.9v67.9h87.9c51.4-47.4 81.9-117.3 81.9-197.5z" fill="#4285F4"/>
    <path d="M272.1 544.3c73.8 0 135.8-24.5 181-66.4l-87.9-67.9c-24.5 16.4-55.8 26-93.1 26-71.6 0-132.2-48.3-153.9-113.2H26.6v70.3c45.2 89.8 138.1 151.2 245.5 151.2z" fill="#34A853"/>
    <path d="M118.2 322.8A162.3 162.3 0 0 1 110.4 272c0-17.6 3-34.7 7.8-50.8v-70.3H26.6C9.6 185.3 0 227.3 0 272s9.6 86.7 26.6 121.1l91.6-70.3z" fill="#FBBC05"/>
    <path d="M272.1 107.7c40.4 0 76.7 13.9 105.3 41.1l78.9-78.9C409.8 24.5 347.9 0 272.1 0 164.7 0 71.8 61.4 26.6 151.2l91.6 70.3c21.7-64.9 82.3-113.8 153.9-113.8z" fill="#EA4335"/>
  </svg>
);
const AppleIcon = () => (
  <svg className="w-[18px] h-[18px] fill-white" viewBox="0 0 814 1000">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.3-148.2-89.2c-50.6-60.6-93.7-155.3-93.7-245.1 0-176.7 114.7-270.1 226.8-270.1 59.9 0 109.9 39.5 147.4 39.5 35.7 0 91.5-41.8 159.3-41.8zm-31-161.1c14.7-17.9 25.4-43.1 25.4-68.3 0-3.5-.3-7-.9-10.3-24 1-52.4 15.9-69.8 36-13.3 15.4-25.9 40.5-25.9 65.8 0 3.9.6 7.7 1.2 8.9 1.5.3 4.1.6 6.6.6 22.4 0 48.8-14 63.4-32.7z"/>
  </svg>
);
const FacebookIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

/* ─── Reusable field ────────────────────────────────────────── */
const Field: React.FC<{
  id: string; type?: string; placeholder: string; value: string;
  onChange: (v: string) => void; Icon: React.FC<{className?: string}>;
  toggle?: boolean; visible?: boolean; onToggle?: () => void; required?: boolean;
}> = ({ id, type = "text", placeholder, value, onChange, Icon, toggle, visible, onToggle, required = true }) => (
  <motion.div variants={fadeUp} className="relative group">
    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors duration-300 z-10 pointer-events-none" />
    <motion.input
      id={id}
      type={toggle ? (visible ? "text" : "password") : type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      whileFocus={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
      className="w-full h-11 pl-10 pr-10 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm
        placeholder:text-gray-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15
        focus:bg-white/[0.09] hover:border-white/20 hover:bg-white/[0.08] transition-all duration-200"
    />
    {toggle && (
      <button type="button" onClick={onToggle}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors z-10 outline-none">
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    )}
  </motion.div>
);

/* ─── Social button ─────────────────────────────────────────── */
const SocBtn: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
  <motion.button type="button" onClick={onClick}
    whileHover={{ y: -3, scale: 1.06, backgroundColor: "rgba(255,255,255,0.12)" }}
    whileTap={{ scale: 0.94 }}
    className="flex-1 h-11 border border-white/10 rounded-xl flex items-center justify-center bg-white/[0.05] transition-colors duration-200">
    {children}
  </motion.button>
);

/* ─── Main Component ────────────────────────────────────────── */
export const AuthDialog: React.FC<AuthDialogProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail]   = useState("");
  const [loginPwd, setLoginPwd]       = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [phone, setPhone]             = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPwd, setSignupPwd]     = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed]           = useState(false);

  const { login } = useAuth();
  const { toast } = useToast();

  const switchTo = (toLogin: boolean) => { setDir(toLogin ? -1 : 1); setIsLogin(toLogin); };
  const reset = () => {
    setLoginEmail(""); setLoginPwd("");
    setFirstName(""); setLastName(""); setPhone(""); setSignupEmail(""); setSignupPwd(""); setConfirmPwd(""); setAgreed(false);
  };
  const handleClose = () => { reset(); onClose(); };
  const soc = (n: string) => toast({ title: `${n} OAuth`, description: "Connect cloud credentials to enable this." });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append("username", loginEmail); form.append("password", loginPwd);
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
      if (!res.ok) throw new Error((await res.json()).detail || "Login failed");
      const data = await res.json();
      login(data.access_token, loginEmail);
      toast({ title: "Welcome back! 👋", description: `Logged in as ${loginEmail}` });
      handleClose();
    } catch (err: any) { toast({ title: "Login Failed", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPwd !== confirmPwd) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (!agreed) { toast({ title: "Please agree to Terms & Conditions", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signupEmail, password: signupPwd, first_name: firstName, last_name: lastName, phone: phone || undefined })
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Signup failed");
      toast({ title: "Account Created! 🎉", description: "Welcome to Simba! Please log in." });
      switchTo(true);
    } catch (err: any) { toast({ title: "Signup Failed", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 border-0 bg-transparent shadow-none overflow-visible">

        {/* ── Card shell ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative rounded-[1.75rem] overflow-hidden border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
        >
          {/* Glass layers */}
          <div className="absolute inset-0 bg-[#080818]/90" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-white/[0.03]" />
          <div className="absolute inset-[1px] rounded-[1.7rem] border border-white/[0.06] pointer-events-none" />

          {/* Breathing glow — top */}
          <motion.div
            animate={{ opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 w-[300px] h-[120px] pointer-events-none"
            style={{ background: "radial-gradient(ellipse, hsl(27,90%,54%,0.4) 0%, transparent 70%)" }}
          />
          {/* Subtle bottom glow */}
          <div className="absolute -bottom-8 right-0 w-48 h-48 pointer-events-none"
            style={{ background: "radial-gradient(ellipse, hsl(27,90%,54%,0.12) 0%, transparent 70%)" }} />

          {/* ── Content ── */}
          <div className="relative z-10 px-8 py-8">

            {/* Brand */}
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex flex-col items-center mb-6"
            >
              <motion.div
                whileHover={{ rotate: [0, -10, 10, -5, 0] }}
                transition={{ duration: 0.5 }}
                className="w-14 h-14 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl border border-primary/30 flex items-center justify-center mb-3 shadow-lg shadow-primary/20"
              >
                <ShoppingBag className="w-6 h-6 text-primary" />
              </motion.div>
              <p className="font-heading font-black tracking-[0.22em] text-white text-base uppercase">Simba</p>
              <p className="text-gray-500 text-[11px] tracking-widest mt-0.5">Fresh · Quality · Delivered</p>
            </motion.div>

            {/* ── Tab pill switcher ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-0 mb-7 bg-white/[0.05] rounded-2xl p-1 border border-white/[0.08]"
            >
              {["Login", "Sign Up"].map((label, i) => {
                const active = (i === 0) === isLogin;
                return (
                  <button key={label} type="button" onClick={() => switchTo(i === 0)}
                    className="relative flex-1 py-2.5 rounded-xl text-sm font-semibold outline-none transition-colors duration-300"
                    style={{ color: active ? "white" : "rgba(156,163,175,1)" }}
                  >
                    {active && (
                      <motion.div layoutId="tab-pill"
                        className="absolute inset-0 rounded-xl"
                        style={{ background: "linear-gradient(135deg, hsl(27,90%,54%,0.35), hsl(27,90%,54%,0.15))", border: "1px solid hsl(27,90%,54%,0.4)" }}
                        transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </motion.div>

            {/* ── Animated form panel ── */}
            <div className="relative overflow-hidden">
              <AnimatePresence custom={dir} initial={false} mode="wait">
                {isLogin ? (
                  <motion.form key="login" custom={dir} variants={panelSwitch} initial="enter" animate="center" exit="exit" onSubmit={handleLogin}>
                    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3.5">
                      <motion.div variants={fadeUp} className="pb-1">
                        <h3 className="text-white font-bold text-xl font-heading">Welcome back</h3>
                        <p className="text-gray-500 text-sm">Login to continue shopping</p>
                      </motion.div>

                      <Field id="le" type="email" placeholder="Email address" value={loginEmail} onChange={setLoginEmail} Icon={Mail} />
                      <Field id="lp" placeholder="Password" value={loginPwd} onChange={setLoginPwd} Icon={Lock} toggle visible={showLoginPwd} onToggle={() => setShowLoginPwd(v => !v)} />

                      <motion.div variants={fadeUp} className="text-right">
                        <button type="button" className="text-primary text-xs hover:underline">Forgot password?</button>
                      </motion.div>

                      <motion.div variants={fadeUp}>
                        <motion.button type="submit" disabled={loading}
                          whileHover={{ y: -2, boxShadow: "0 12px 32px -4px hsl(27,90%,54%,0.55)" }}
                          whileTap={{ scale: 0.97 }}
                          className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
                          style={{ background: "linear-gradient(135deg, hsl(27,90%,54%), hsl(27,90%,42%))", boxShadow: "0 6px 20px -4px hsl(27,90%,54%,0.35)" }}
                        >
                          {loading
                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Signing in...</span></>
                            : <><span>Login</span><ArrowRight className="w-4 h-4" /></>}
                        </motion.button>
                      </motion.div>

                      <motion.div variants={fadeUp} className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-gray-400 text-xs tracking-wide font-medium">OR CONTINUE WITH</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </motion.div>

                      <motion.div variants={fadeUp} className="flex gap-3">
                        <SocBtn onClick={() => soc("Google")}><GoogleIcon /></SocBtn>
                        <SocBtn onClick={() => soc("Apple")}><AppleIcon /></SocBtn>
                        <SocBtn onClick={() => soc("Facebook")}><FacebookIcon /></SocBtn>
                      </motion.div>

                      <motion.p variants={fadeUp} className="text-center text-gray-400 text-sm pt-1">
                        Don't have an account?{" "}
                        <button type="button" onClick={() => switchTo(false)} className="text-primary font-bold hover:underline">Sign up</button>
                      </motion.p>
                    </motion.div>
                  </motion.form>
                ) : (
                  <motion.form key="signup" custom={dir} variants={panelSwitch} initial="enter" animate="center" exit="exit" onSubmit={handleSignup}>
                    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
                      <motion.div variants={fadeUp} className="pb-1">
                        <h3 className="text-white font-bold text-xl font-heading">Create account</h3>
                        <p className="text-gray-500 text-sm">Join Simba and start shopping</p>
                      </motion.div>

                      {/* First + Last name */}
                      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
                        {[
                          { id: "sf", ph: "First name", val: firstName, set: setFirstName },
                          { id: "sl", ph: "Last name",  val: lastName,  set: setLastName },
                        ].map(({ id, ph, val, set }) => (
                          <div key={id} className="relative group">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors z-10 pointer-events-none" />
                            <motion.input id={id} type="text" placeholder={ph} value={val} onChange={e => set(e.target.value)} required
                              whileFocus={{ scale: 1.01 }} transition={{ duration: 0.15 }}
                              className="w-full h-11 pl-10 pr-4 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600
                                focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 focus:bg-white/[0.09]
                                hover:border-white/20 hover:bg-white/[0.08] transition-all duration-200" />
                          </div>
                        ))}
                      </motion.div>

                      <Field id="se" type="email" placeholder="Email address"   value={signupEmail} onChange={setSignupEmail} Icon={Mail} />
                      <Field id="sph" type="tel"  placeholder="Phone (optional)" value={phone}       onChange={setPhone}       Icon={Phone} required={false} />
                      <Field id="sp"              placeholder="Password"          value={signupPwd}   onChange={setSignupPwd}   Icon={Lock} toggle visible={showPwd}     onToggle={() => setShowPwd(v => !v)} />
                      <Field id="sc"              placeholder="Confirm password"  value={confirmPwd}  onChange={setConfirmPwd}  Icon={Lock} toggle visible={showConfirm} onToggle={() => setShowConfirm(v => !v)} />

                      {/* Terms checkbox */}
                      <motion.label variants={fadeUp} className="flex items-start gap-2.5 cursor-pointer">
                        <motion.div onClick={() => setAgreed(v => !v)} whileTap={{ scale: 0.82 }}
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all duration-200 ${agreed ? "bg-primary border-primary" : "border-white/20 bg-white/5"}`}>
                          <AnimatePresence>
                            {agreed && (
                              <motion.svg initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                                className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </motion.svg>
                            )}
                          </AnimatePresence>
                        </motion.div>
                        <span className="text-gray-400 text-xs leading-relaxed">
                          I agree to the <span className="text-primary hover:underline cursor-pointer">Terms & Conditions</span> and <span className="text-primary hover:underline cursor-pointer">Privacy Policy</span>
                        </span>
                      </motion.label>

                      <motion.div variants={fadeUp}>
                        <motion.button type="submit" disabled={loading}
                          whileHover={{ y: -2, boxShadow: "0 12px 32px -4px hsl(27,90%,54%,0.55)" }}
                          whileTap={{ scale: 0.97 }}
                          className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
                          style={{ background: "linear-gradient(135deg, hsl(27,90%,54%), hsl(27,90%,42%))", boxShadow: "0 6px 20px -4px hsl(27,90%,54%,0.35)" }}
                        >
                          {loading
                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Creating...</span></>
                            : <><span>Create account</span><ArrowRight className="w-4 h-4" /></>}
                        </motion.button>
                      </motion.div>

                      <motion.div variants={fadeUp} className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-gray-400 text-xs tracking-wide font-medium">OR CONTINUE WITH</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </motion.div>

                      <motion.div variants={fadeUp} className="flex gap-3">
                        <SocBtn onClick={() => soc("Google")}><GoogleIcon /></SocBtn>
                        <SocBtn onClick={() => soc("Apple")}><AppleIcon /></SocBtn>
                        <SocBtn onClick={() => soc("Facebook")}><FacebookIcon /></SocBtn>
                      </motion.div>

                      <motion.p variants={fadeUp} className="text-center text-gray-400 text-sm">
                        Already have an account?{" "}
                        <button type="button" onClick={() => switchTo(true)} className="text-primary font-bold hover:underline">Login</button>
                      </motion.p>
                    </motion.div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
