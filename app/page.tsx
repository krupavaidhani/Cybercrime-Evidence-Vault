import Link from "next/link";
import { Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200">
      <Shield className="w-20 h-20 text-emerald-600 mb-6" />
      <h1 className="text-4xl font-bold tracking-tight mb-4">DIGIPOL 2.0</h1>
      <p className="text-slate-500 mb-8 max-w-md text-center">
        Secure Evidence Management & Chain of Custody System for Law Enforcement Agencies.
      </p>

      <Link
        href="/login"
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded shadow-lg transition-all"
      >
        Enter Secure Portal
      </Link>
    </div>
  );
}
