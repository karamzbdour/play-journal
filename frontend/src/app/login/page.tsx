"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setAuthToken, setUser, isAuthenticated } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Redirect to home if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const url = isRegister
      ? "http://localhost:8000/api/auth/signup"
      : "http://localhost:8000/api/auth/login";

    const payload = isRegister
      ? { email, password, full_name: fullName || null }
      : { email, password };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors or api errors
        let errorDetail = data.detail;
        if (Array.isArray(errorDetail)) {
          // Pydantic validation list format
          errorDetail = errorDetail.map((err: { msg: string }) => err.msg).join(", ");
        }
        throw new Error(errorDetail || "Authentication failed.");
      }

      if (isRegister) {
        setMessage(
          data.session_active
            ? "Account created successfully! Logging you in..."
            : "Registration complete. Please confirm your email if required, or sign in."
        );
        
        // If Supabase immediately logged the user in/created session
        if (data.session_active && data.access_token) {
          setAuthToken(data.access_token);
          setUser(data.user);
          setTimeout(() => router.push("/"), 1500);
        } else {
          // Switch to login tab
          setTimeout(() => {
            setIsRegister(false);
            setMessage(null);
          }, 3000);
        }
      } else {
        // Login success
        setAuthToken(data.access_token);
        setUser(data.user);
        router.push("/");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="storybook-scene">
      <div className="storybook-card">
        <div className="text-center">
          <h2 className="storybook-heading">
            {isRegister ? "Join the Chronicle" : "Enter the Tome"}
          </h2>
          <p className="storybook-subtitle">
            {isRegister ? "Create your entry in the annals." : "Unlock your journal with the secret key."}
          </p>
        </div>

        {error && (
          <div className="storybook-alert storybook-alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {message && (
          <div className="storybook-alert storybook-alert-note">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <div className="flex flex-col gap-2">
              <label className="storybook-label">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adventurer Name"
                className="storybook-input"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="storybook-label">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="scroll@kingdom.com"
              className="storybook-input"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="storybook-label">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="storybook-input"
            />
            {isRegister && (
              <span className="text-[10px]" style={{ color: "#7d6447" }}>
                Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special symbol.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="storybook-button"
          >
            {loading ? "Decrypting..." : isRegister ? "Register" : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setMessage(null);
            }}
            className="storybook-link"
          >
            {isRegister
              ? "Already possess a key? Sign in"
              : "New to the journal? Register key"}
          </button>
        </div>
      </div>
    </div>
  );
}
