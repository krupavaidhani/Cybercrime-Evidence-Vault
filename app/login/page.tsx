"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Lock, AlertTriangle } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user, userData } = useAuth();

    const roleRoutes: Record<string, string> = {
        INVESTIGATION_OFFICER: "io",
        SEIZURE_OFFICER: "so",
        EVIDENCE_CUSTODIAN: "ec",
        FORENSIC_EXAMINER: "fe",
        HOD: "hod",
    };

    useEffect(() => {
        if (user && userData) {
            const route = roleRoutes[userData.role];
            if (route) {
                router.push(`/dashboard/${route}`);
            } else {
                router.push("/dashboard"); // Fallback
            }
        }
    }, [user, userData, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // specific redirection happens in useEffect once userData is loaded
        } catch (err: any) {
            console.error("Login failed", err);
            setError("Invalid credentials. Access denied.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-8 relative overflow-hidden">
                {/* Decorative top bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 via-emerald-600 to-slate-800"></div>

                <div className="flex flex-col items-center mb-8">
                    <div className="bg-slate-800 p-3 rounded-full mb-4 ring-1 ring-slate-700">
                        <Shield className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-100 tracking-wider">DIGIPOL 2.0</h1>
                    <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest text-[10px]">Official Law Enforcement Portal</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="bg-red-900/20 border border-red-800/50 text-red-400 p-3 rounded text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Officer Email
                        </label>
                        <div className="relative">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 pl-10 text-slate-200 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors placeholder:text-slate-700"
                                placeholder="officer@police.gov.in"
                                required
                            />
                            <Shield className="w-4 h-4 text-slate-600 absolute left-3 top-3.5" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Secure Password
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-3 pl-10 text-slate-200 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-colors placeholder:text-slate-700"
                                placeholder="••••••••"
                                required
                            />
                            <Lock className="w-4 h-4 text-slate-600 absolute left-3 top-3.5" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded transition-all duration-200 shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm"
                    >
                        {loading ? "Authenticating..." : "Access System"}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                        Restricted Access. Authorized Personnel Only.
                        <br />
                        Unauthorized attempts will be logged.
                    </p>
                </div>
            </div>
        </div>
    );
}
