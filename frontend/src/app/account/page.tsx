"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser, clearAuthToken } from "@/lib/auth";
import { loadMemories } from "@/lib/journal";

export default function AccountPage() {
  const router = useRouter();
  const [user, setLocalUser] = useState<any>(null);
  const [stats, setStats] = useState({ totalJournals: 0 });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    setLocalUser(getUser());
    const memories = loadMemories();
    setStats({
      totalJournals: memories.length,
    });
  }, [router]);

  const handleLogout = () => {
    clearAuthToken();
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="tome-scene flex items-center justify-center min-h-screen">
        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--torch)" }}>
          Consulting the archives...
        </span>
      </div>
    );
  }

  return (
    <div className="tome-scene flex flex-col items-center justify-start min-h-screen px-4 pt-8 pb-12 overflow-y-auto">
      <div 
        className="w-full max-w-md p-8 border-2 rounded-lg shadow-2xl relative z-10 flex flex-col gap-6"
        style={{
          background: "linear-gradient(145deg, #1f120a 0%, #170d07 100%)",
          borderColor: "#4a3325",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.9)"
        }}
      >
        <div className="text-center border-b pb-4" style={{ borderColor: "#3e271a" }}>
          <h1 
            className="text-3xl font-extrabold uppercase tracking-widest"
            style={{ 
              color: "var(--torch)", 
              textShadow: "0 0 15px rgba(251,191,36,0.3)" 
            }}
          >
            Hero Profile
          </h1>
          <p className="text-xs mt-1" style={{ color: "#8a7550" }}>
            Adventurer credentials and key details
          </p>
        </div>

        {/* User Stats Card */}
        <div 
          className="p-5 border rounded flex flex-col gap-4"
          style={{
            background: "#120804",
            borderColor: "#3e271a",
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8a7550" }}>
              Registered Name
            </span>
            <span className="text-lg font-bold" style={{ color: "#d9c69e" }}>
              {user.user_metadata?.full_name || "Anonymous Hero"}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8a7550" }}>
              Ident Key (Email)
            </span>
            <span className="text-sm font-semibold" style={{ color: "#a18262", fontFamily: "var(--font-mono)" }}>
              {user.email}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8a7550" }}>
              User ID Reference
            </span>
            <span className="text-[10px] select-all font-mono" style={{ color: "#57503f" }}>
              {user.id}
            </span>
          </div>
        </div>

        {/* Journal Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div 
            className="p-4 border rounded text-center flex flex-col gap-1"
            style={{
              background: "#120804",
              borderColor: "#3e271a",
            }}
          >
            <span className="text-2xl">📖</span>
            <span className="text-xl font-extrabold" style={{ color: "var(--torch)" }}>
              {stats.totalJournals}
            </span>
            <span className="text-[9px] uppercase font-bold" style={{ color: "#8a7550" }}>
              Spells Penned
            </span>
          </div>

          <div 
            className="p-4 border rounded text-center flex flex-col gap-1"
            style={{
              background: "#120804",
              borderColor: "#3e271a",
            }}
          >
            <span className="text-2xl">🛡️</span>
            <span className="text-xl font-extrabold" style={{ color: "#a18262" }}>
              Active
            </span>
            <span className="text-[9px] uppercase font-bold" style={{ color: "#8a7550" }}>
              Quest Status
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-2.5 rounded font-bold uppercase tracking-wider text-xs border transition-all cursor-pointer hover:bg-red-950/20"
          style={{
            borderColor: "rgba(220, 38, 38, 0.4)",
            color: "#f87171"
          }}
        >
          Relinquish Identity (Logout)
        </button>
      </div>
    </div>
  );
}
