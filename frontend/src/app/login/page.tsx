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
          errorDetail = errorDetail.map((err: any) => err.msg).join(", ");
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
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tome-scene flex flex-col items-center justify-center min-h-screen px-4">
      {/* Tome themed login card */}
      <div 
        className="w-full max-w-md p-8 border-2 rounded-lg shadow-2xl relative z-10 flex flex-col gap-6"
        style={{
          background: "linear-gradient(145deg, #2a1b12 0%, #1f120a 100%)",
          borderColor: "#4a3325",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 50px rgba(251, 191, 36, 0.05)"
        }}
      >
        <div className="text-center">
          <h2 
            className="text-3xl font-extrabold tracking-tight uppercase"
            style={{ 
              color: "var(--torch)", 
              fontFamily: "var(--font-sans)", 
              textShadow: "0 0 15px rgba(251,191,36,0.3)" 
            }}
          >
            {isRegister ? "Join the Quest" : "Enter the Tome"}
          </h2>
          <p className="text-xs mt-2" style={{ color: "#8a7550" }}>
            {isRegister ? "Create a record in the annals" : "Verify your identity key"}
          </p>
        </div>

        {error && (
          <div 
            className="p-3 rounded text-sm text-red-200 border border-red-900 bg-red-950/50"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {message && (
          <div 
            className="p-3 rounded text-sm text-amber-200 border border-amber-900 bg-amber-950/50"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase" style={{ color: "#a18262" }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adventurer Name"
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-1 transition-all"
                style={{
                  background: "#120804",
                  borderColor: "#5c4033",
                  color: "#d9c69e",
                  fontSize: "0.875rem"
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase" style={{ color: "#a18262" }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="scroll@kingdom.com"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-1 transition-all"
              style={{
                background: "#120804",
                borderColor: "#5c4033",
                color: "#d9c69e",
                fontSize: "0.875rem"
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase" style={{ color: "#a18262" }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-1 transition-all"
              style={{
                background: "#120804",
                borderColor: "#5c4033",
                color: "#d9c69e",
                fontSize: "0.875rem"
              }}
            />
            {isRegister && (
              <span className="text-[10px]" style={{ color: "#6e5841" }}>
                Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special symbol.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded font-bold uppercase tracking-wider text-sm transition-all cursor-pointer mt-2"
            style={{
              background: loading ? "#4d3929" : "var(--torch)",
              color: loading ? "#a38269" : "#1a1005",
              boxShadow: "0 4px 6px rgba(0,0,0,0.2)"
            }}
          >
            {loading ? "Decrypting..." : isRegister ? "Register" : "Sign In"}
          </button>
        </form>

        <div className="text-center text-xs border-t pt-4" style={{ borderColor: "#3e271a" }}>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setMessage(null);
            }}
            className="hover:underline cursor-pointer font-medium"
            style={{ color: "#8a7550" }}
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
