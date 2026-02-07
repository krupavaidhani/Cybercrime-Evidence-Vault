"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Shield } from "lucide-react";

export default function DashboardPage() {
    const { userData, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && userData) {
            const roleMap: Record<string, string> = {
                INVESTIGATION_OFFICER: "io",
                SEIZURE_OFFICER: "so",
                EVIDENCE_CUSTODIAN: "ec",
                FORENSIC_EXAMINER: "fe",
                HOD: "hod",
                SUPER_ADMIN: "io",
            };
            const slug = roleMap[userData.role];
            if (slug) {
                router.push(`/dashboard/${slug}`);
            }
        }
    }, [userData, loading, router]);

    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <Shield className="w-16 h-16 text-emerald-600 animate-pulse mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-200">Redirecting to your dashboard...</h2>
            </div>
        </div>
    );
}
