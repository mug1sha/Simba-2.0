import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { readErrorMessage } from "@/lib/api";

type GoogleAuthIntent = "login" | "signup";

type GoogleAuthButtonProps = {
  intent: GoogleAuthIntent;
  onSuccess: (payload: any) => Promise<void> | void;
  onError: (message: string) => void;
};

const GOOGLE_SCRIPT_ID = "google-identity-services";

const loadGoogleScript = () =>
  new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Google script failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google script failed to load"));
    document.head.appendChild(script);
  });

const GoogleAuthButton = ({ intent, onSuccess, onError }: GoogleAuthButtonProps) => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!googleClientId) return;
    let active = true;

    loadGoogleScript()
      .then(() => {
        if (active) setScriptReady(true);
      })
      .catch((error) => {
        if (active) onError(error instanceof Error ? error.message : "Google Sign-In could not load");
      });

    return () => {
      active = false;
    };
  }, [googleClientId, onError]);

  useEffect(() => {
    if (!googleClientId || !scriptReady || !buttonRef.current || !window.google?.accounts?.id) return;
    buttonRef.current.innerHTML = "";

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        if (!response.credential) {
          onError("Google authentication did not return a credential");
          return;
        }

        setIsLoading(true);
        try {
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              credential: response.credential,
              role: "customer",
              intent,
            }),
          });
          if (!res.ok) throw new Error(await readErrorMessage(res, "Google authentication failed"));
          const data = await res.json();
          await onSuccess(data);
        } catch (error) {
          onError(error instanceof Error ? error.message : "Google authentication failed");
        } finally {
          setIsLoading(false);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: intent === "signup" ? "signup_with" : "continue_with",
      width: 320,
      logo_alignment: "left",
    });
  }, [googleClientId, intent, onError, onSuccess, scriptReady]);

  if (!googleClientId) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-center text-[11px] text-gray-400">
        Set <code className="text-primary">VITE_GOOGLE_CLIENT_ID</code> to enable Google auth.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={buttonRef} className="flex justify-center" />
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Authenticating with Google...
        </div>
      )}
    </div>
  );
};

export default GoogleAuthButton;
