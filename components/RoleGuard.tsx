"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Shield } from "lucide-react";

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { user, userData, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/login");
            } else if (userData && userData.role !== "SUPER_ADMIN" && allowedRoles && !allowedRoles.includes(userData.role)) {
                // Unauthorized for this specific route
                router.push("/unauthorized"); // Or redirect to their own dashboard
            }
        }
    }, [user, userData, loading, allowedRoles, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
                <Shield className="w-12 h-12 text-emerald-600 animate-pulse mb-4" />
                <p className="text-slate-500 font-mono text-sm">Verifying Credentials...</p>
            </div>
        );
    }

    if (!user || (userData?.role !== "SUPER_ADMIN" && allowedRoles && userData && !allowedRoles.includes(userData.role))) {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
