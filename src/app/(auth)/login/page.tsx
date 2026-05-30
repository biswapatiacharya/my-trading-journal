"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TrendingUp, Chrome, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginData = z.infer<typeof loginSchema>;
type SignupData = z.infer<typeof signupSchema>;

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isSignup = mode === "signup";

  const form = useForm<SignupData>({
    resolver: zodResolver(isSignup ? signupSchema : loginSchema),
    defaultValues: { email: "", password: "", fullName: "", confirmPassword: "" },
  });

  const supabase = createClient();

  async function handleEmailAuth(data: SignupData) {
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: { full_name: data.fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (error) throw error;
        router.push(nextUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${nextUrl}`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google login failed");
      setGoogleLoading(false);
    }
  }

  async function handleGuestLogin() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "demo@tradingjournal.app",
        password: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "demo123456",
      });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Demo account not configured. Please sign up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-xl leading-none">TradingJournal</h1>
          <p className="text-xs text-muted-foreground">AI-powered trading insights</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{isSignup ? "Create account" : "Welcome back"}</CardTitle>
          <CardDescription>
            {isSignup
              ? "Start tracking your trades and improving your performance"
              : "Sign in to your trading journal"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
          >
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-4 h-4" />}
            Continue with Google
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">or</span>
            </span>
          </div>

          {/* Email form */}
          <form onSubmit={form.handleSubmit(handleEmailAuth)} className="space-y-3">
            {isSignup && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  {...form.register("fullName")}
                  className={cn(form.formState.errors.fullName && "border-destructive")}
                />
                {form.formState.errors.fullName && (
                  <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="trader@example.com"
                {...form.register("email")}
                className={cn(form.formState.errors.email && "border-destructive")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  {...form.register("password")}
                  className={cn("pr-10", form.formState.errors.password && "border-destructive")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1"
                  onClick={() => setShowPwd(!showPwd)}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            {isSignup && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...form.register("confirmPassword")}
                  className={cn(form.formState.errors.confirmPassword && "border-destructive")}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          {/* Guest */}
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleGuestLogin}
            disabled={loading}
          >
            Try demo account
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => { setMode(isSignup ? "login" : "signup"); form.reset(); }}
              className="text-primary hover:underline font-medium"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 bg-muted rounded-xl" />}>
      <LoginPageInner />
    </Suspense>
  );
}
