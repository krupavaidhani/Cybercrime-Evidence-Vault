"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import { Database, Users, Shield, Trash2, CheckCircle, AlertTriangle } from "lucide-react";

const users = [
    { email: "io@police.gov.in", role: "INVESTIGATION_OFFICER", name: "Inspector Arjun" },
    { email: "so@police.gov.in", role: "SEIZURE_OFFICER", name: "Officer Rajesh" },
    { email: "ec@police.gov.in", role: "EVIDENCE_CUSTODIAN", name: "Custodian Suresh" },
    { email: "fe@police.gov.in", role: "FORENSIC_EXAMINER", name: "Dr. Priya" },
    { email: "hod@police.gov.in", role: "HOD", name: "Commissioner Vikram" },
];

export default function SeedPage() {
    const [status, setStatus] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]); // Defined logs state

    const seedUsers = async () => {
        setLoading(true);
        setStatus("Initializing seeding process...");
        setLogs([]); // Clear previous logs
        let newLogs: string[] = []; // Initialized local variable

        for (const u of users) {
            try {
                await signOut(auth); // Ensure clean state
                setStatus(`Creating user: ${u.email}...`);

                // Check if user exists (handled by catch block usually, but firebase errors if exists)
                const cred = await createUserWithEmailAndPassword(auth, u.email, "password123");
                const uid = cred.user.uid;

                await setDoc(doc(db, "users", uid), {
                    uid,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    walletAddress: "",
                    createdAt: new Date(),
                });

                const successMsg = `✅ Created ${u.email} (${u.role})`;
                newLogs.push(successMsg);
                setLogs([...newLogs]); // Correctly updates React state

            } catch (error: any) {
                if (error.code === 'auth/email-already-in-use') {
                    const msg = `⚠️ User ${u.email} already exists. Skipping.`;
                    setStatus(msg);
                    newLogs.push(msg); // Add to logs
                    setLogs([...newLogs]);
                } else {
                    const msg = `❌ Error creating ${u.email}: ${error.message}`;
                    setStatus(msg);
                    newLogs.push(msg); // Add to logs
                    setLogs([...newLogs]);
                }
            }
        }

        await signOut(auth);
        setLoading(false);
        setStatus("🏁 Seeding complete. You can now login.");
    };

    const makeSuperAdmin = async () => {
        if (!auth.currentUser) {
            setStatus("Error: No user logged in. Please log in first.");
            return;
        }
        setLoading(true);
        setStatus("Promoting to SUPER_ADMIN...");
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid), {
                role: "SUPER_ADMIN"
            }, { merge: true });
            setStatus("Success! You are now a SUPER_ADMIN. Please refresh.");
        } catch (e: any) {
            setStatus("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const clearDatabase = async () => {
        if (!confirm("WARNING: This will DELETE ALL EVIDENCE AND CASES from the database. Are you sure?")) return;
        setLoading(true);
        setStatus("Clearing database...");
        try {
            const evidenceRef = collection(db, "evidence");
            const casesRef = collection(db, "cases");

            // Delete all evidence
            const evidenceSnap = await getDocs(evidenceRef);
            const batch = writeBatch(db);
            evidenceSnap.forEach((doc) => batch.delete(doc.ref));

            // Delete all cases
            const casesSnap = await getDocs(casesRef);
            casesSnap.forEach((doc) => batch.delete(doc.ref));

            await batch.commit();
            setStatus("Database Cleared! You can now start fresh.");
        } catch (e: any) {
            setStatus("Error clearing DB: " + e.message);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-lg max-w-md w-full shadow-2xl">
                <div className="flex justify-center mb-6">
                    <Database className="w-12 h-12 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-bold text-center text-slate-100 mb-2">System Seeder</h1>
                <p className="text-slate-500 text-center text-sm mb-8">
                    Initialize demo accounts or promote yourself.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={seedUsers}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Users className="animate-spin w-5 h-5" /> : <Database className="w-5 h-5" />}
                        Seed Demo Accounts
                    </button>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-800"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-600 text-xs uppercase">OR</span>
                        <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    <button
                        onClick={makeSuperAdmin}
                        disabled={loading}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Shield className="w-5 h-5" />
                        Promote Me to Super Admin
                    </button>

                    <button
                        onClick={clearDatabase}
                        disabled={loading}
                        className="w-full bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-5 h-5" />
                        Reset System (Clear DB)
                    </button>
                </div>

                {status && (
                    <div className={`mt-6 p-4 rounded text-sm text-center ${status.includes("Error") ? "bg-red-900/20 text-red-400 border border-red-900/50" : "bg-emerald-900/20 text-emerald-400 border border-emerald-900/50"
                        }`}>
                        {status}
                    </div>
                )}

                {/* Logs Display */}
                {logs.length > 0 && (
                    <div className="mt-4 p-4 bg-slate-950 rounded border border-slate-800 max-h-40 overflow-y-auto text-xs font-mono text-slate-400 space-y-1">
                        {logs.map((log, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span>{log}</span>
                            </div>
                        ))}
                    </div>
                )}

                <Link href="/login" className="block w-full text-center text-slate-400 hover:text-emerald-400 text-sm mt-4 hover:underline">
                    &larr; Back to Login
                </Link>

                <p className="mt-6 text-xs text-center text-slate-600">
                    Warning: This resets/modifies Firestore data.
                </p>
            </div>
        </div>
    );
}
