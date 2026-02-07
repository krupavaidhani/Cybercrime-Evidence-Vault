"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { Shield, Lock } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";

export default function RoleDashboard() {
    const { userData } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    // Extract role slug from path /dashboard/[slug]
    const currentSlug = pathname.split('/').pop();

    // Security: Enforce that the URL matches the logged-in user's role
    // This prevents an IO from visiting /dashboard/hod
    if (userData) {
        const roleSlugMap: Record<string, string> = {
            INVESTIGATION_OFFICER: "io",
            SEIZURE_OFFICER: "so",
            EVIDENCE_CUSTODIAN: "ec",
            FORENSIC_EXAMINER: "fe",
            HOD: "hod",
        };
        const expectedSlug = roleSlugMap[userData.role];

        if (currentSlug && expectedSlug && currentSlug !== expectedSlug) {
            // Redirect to correct dashboard if mismatch
            // router.replace prevents history stacking
            router.replace(`/dashboard/${expectedSlug}`);
            return null;
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 tracking-tight">
                        {userData?.role.replace(/_/g, ' ')} DASHBOARD
                    </h1>
                    <p className="text-slate-400 mt-1">Welcome back, Officer {userData?.name}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-mono text-emerald-400">SYSTEM SECURE</span>
                </div>
            </header>

            {/* Role Specific Content Placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-sm hover:border-emerald-500/50 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-slate-200">Recent Activity</h3>
                        <Shield className="w-5 h-5 text-slate-600 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-slate-400 text-sm">No recent activity logs found for your session.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-sm hover:border-emerald-500/50 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-slate-200">Pending Actions</h3>
                        <Lock className="w-5 h-5 text-slate-600 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-slate-400 text-sm">You have no pending tasks requiring immediate attention.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-sm hover:border-emerald-500/50 transition-colors group">
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-800 rounded">
                        <span className="text-slate-600 text-sm">Widget Placeholder</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
