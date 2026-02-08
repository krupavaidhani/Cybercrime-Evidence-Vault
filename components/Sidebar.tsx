"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
    Shield,
    LayoutDashboard,
    FileText,
    Box,
    Search,
    Users,
    LogOut,
    Menu,
    X,
    Folder,
    Activity
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

export default function Sidebar() {
    const { userData, logout } = useAuth();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false); // For mobile

    if (!userData) return null;

    // Define menu items based on roles
    const getMenuItems = () => {
        const common = [{ name: "Dashboard", href: `/dashboard/${getRoleSlug(userData.role)}`, icon: LayoutDashboard }];

        if (userData.role === "SUPER_ADMIN") {
            return [
                { name: "IO Dashboard", href: "/dashboard/io", icon: Folder },
                { name: "SO Dashboard", href: "/dashboard/so", icon: Box },
                { name: "EC Dashboard", href: "/dashboard/ec", icon: Shield },
                { name: "FE Dashboard", href: "/dashboard/fe", icon: Activity },
                { name: "HOD Dashboard", href: "/dashboard/hod", icon: FileText }
            ];
        }

        // For all other roles, just show the main Dashboard link
        // Additional pages (Cases, Seizures, etc.) are already part of the main dashboard view for now.
        return common;
    };

    const getRoleSlug = (role: string) => {
        const map: Record<string, string> = {
            INVESTIGATION_OFFICER: "io",
            SEIZURE_OFFICER: "so",
            EVIDENCE_CUSTODIAN: "ec",
            FORENSIC_EXAMINER: "fe",
            HOD: "hod",
            SUPER_ADMIN: "io",
        };
        return map[role] || "unknown";
    };

    const menuItems = getMenuItems();

    return (
        <>
            {/* Mobile Toggle */}
            <button
                className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 text-slate-200 rounded"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X /> : <Menu />}
            </button>

            {/* Sidebar */}
            <aside className={clsx(
                "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-300 transform md:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-emerald-500" />
                        <div>
                            <h1 className="font-bold text-slate-100 tracking-wider">CYBERVAULT</h1>
                            <p className="text-[10px] text-slate-500 uppercase">Secure DMS v1.0</p>
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="p-6 bg-slate-800/50">
                        <p className="text-xs text-slate-500 uppercase mb-1">Logged in as</p>
                        <p className="font-semibold text-slate-200 truncate">{userData.name}</p>
                        <p className="text-[10px] text-emerald-500 font-mono mt-1">{userData.role.replace(/_/g, " ")}</p>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={clsx(
                                        "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                                        isActive
                                            ? "bg-emerald-600/10 text-emerald-500 border border-emerald-600/20"
                                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Logout */}
                    <div className="p-4 border-t border-slate-800">
                        <button
                            onClick={logout}
                            className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors text-sm"
                        >
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
