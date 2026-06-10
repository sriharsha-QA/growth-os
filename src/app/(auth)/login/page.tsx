"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Growth OS</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Show up. Log the number. Watch it compound.
        </h1>

        {state === "sent" ? (
          <div className="mt-8 rounded-xl border border-line bg-white/70 p-4 text-sm">
            Check <span className="font-medium">{email}</span> for a sign-in link.
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="mt-8 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </Button>
            {state === "error" && <p className="text-xs text-danger">{error}</p>}
          </form>
        )}

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
        </div>
        <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
