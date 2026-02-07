import Sidebar from "@/components/Sidebar";
import RoleGuard from "@/components/RoleGuard";
import DepartmentHeader from "@/components/DepartmentHeader";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RoleGuard>
            <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-4 md:p-8 ml-0 md:ml-64 transition-all duration-300">
                    <div className="max-w-7xl mx-auto">
                        <DepartmentHeader />
                        {children}
                    </div>
                </main>
            </div>
        </RoleGuard>
    );
}
