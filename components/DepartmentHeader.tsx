"use client";

import { useAuth } from "@/contexts/AuthContext";
import { AlertOctagon, FileText, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function DepartmentHeader() {
    const { userData } = useAuth();
    const [stats, setStats] = useState({
        activeCases: 0,
        pendingTransfers: 0,
        integrityAlerts: 0
    });

    useEffect(() => {
        // Real-time listener for Department Status
        // 1. Active Cases (Status != FINALIZED)
        const qActive = query(collection(db, "cases"), where("status", "!=", "FINALIZED"));
        const unsubActive = onSnapshot(qActive, (snap) => {
            setStats(prev => ({ ...prev, activeCases: snap.size }));
        });

        // 2. Pending Transfers (Status == IN_TRANSIT)
        const qTransfers = query(collection(db, "evidence"), where("status", "==", "IN_TRANSIT"));
        const unsubTransfers = onSnapshot(qTransfers, (snap) => {
            setStats(prev => ({ ...prev, pendingTransfers: snap.size }));
        });

        // 3. Alerts (Simulated for Demo or based on a flag)
        // For now hardcoded or random for "Integrity Alerts" visualization as usually this requires deep checking
        setStats(prev => ({ ...prev, integrityAlerts: 0 }));

        return () => {
            unsubActive();
            unsubTransfers();
        };
    }, []);

    if (!userData) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Active Cases */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Department Load</p>
                    <p className="text-2xl font-bold text-slate-200 mt-1">{stats.activeCases}</p>
                    <p className="text-xs text-emerald-500">Active Investigations</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                    <FileText className="w-6 h-6 text-blue-500" />
                </div>
            </div>

            {/* Pending Transfers */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Chain of Custody</p>
                    <p className="text-2xl font-bold text-slate-200 mt-1">{stats.pendingTransfers}</p>
                    <p className="text-xs text-amber-500">Pending Transfers</p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-full">
                    <Activity className="w-6 h-6 text-amber-500" />
                </div>
            </div>

            {/* Integrity Alerts */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full -mr-8 -mt-8 blur-xl"></div>
                <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">System Integrity</p>
                    <p className="text-2xl font-bold text-slate-200 mt-1">{stats.integrityAlerts}</p>
                    <p className="text-xs text-red-500">Critical Alerts</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-full z-10">
                    <AlertOctagon className="w-6 h-6 text-red-500" />
                </div>
            </div>
        </div>
    );
}
