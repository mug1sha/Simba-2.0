import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === "dark" ? (
          <motion.div
            key="moon"
            initial={{ y: 10, opacity: 0, rotate: 45 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -10, opacity: 0, rotate: -45 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="w-4 h-4 text-primary" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ y: 10, opacity: 0, rotate: 45 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -10, opacity: 0, rotate: -45 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="w-4 h-4 text-primary" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};
