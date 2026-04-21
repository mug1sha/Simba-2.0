import React, { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast"; // Assuming you have a toast component

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthDialog: React.FC<AuthDialogProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, user } = useAuth(); // We might not need login here if handled by API calls
  const { toast } = useToast(); // Assuming useToast is available

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Login failed");
      }

      const data = await response.json();
      login(data.access_token, email); // Assuming login context function updates token and user
      toast({
        title: "Login Successful",
        description: `Welcome back, ${email}!`,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Signup failed");
      }

      toast({
        title: "Signup Successful",
        description: "Your account has been created. Please log in.",
      });
      setIsLogin(true); // Switch to login form after successful signup
      // Optionally, you could auto-login here:
      // const loginResponse = await fetch("/api/auth/login", { ... }); ...
    } catch (error: any) {
      toast({
        title: "Signup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>{isLogin ? "Login" : "Sign Up"}</DialogTitle>
          <DialogDescription>
            {isLogin ? "Enter your credentials to access your account." : "Create a new account to get started."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={isLogin ? handleLoginSubmit : handleSignupSubmit}>
          <div className="grid gap-4 py-4">
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background border-border"
            />
            <Input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-background border-border"
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full">
              {isLogin ? "Login" : "Sign Up"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full mt-2"
            >
              {isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
