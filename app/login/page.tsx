"use client";

import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Lock, AlertTriangle, ChevronDown, ExternalLink, Globe, Server, Database, Key } from "lucide-react";

interface NewsItem {
    id: number;
    title: string;
    summary: string;
    source: string;
    date: string;
    imageUrl: string;
    tag: string;
}

export default function LoginPage() {
    // --- Auth Logic (Preserved) ---
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
        } catch (err: any) {
            console.error("Login failed", err);
            setError("Invalid credentials. Access denied.");
        } finally {
            setLoading(false);
        }
    };
    // ----------------------------

    // --- News Feed Logic ---
    const [news, setNews] = useState<NewsItem[]>([]);
    const newsSectionRef = useRef<HTMLDivElement>(null);

    const scrollToNews = () => {
        newsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Mock Data Fetcher (Simulating API)
    useEffect(() => {
        // In a real scenario, this would consist of fetching from NewsAPI
        const mockNews: NewsItem[] = [
            {
                id: 1,
                title: "CERT-In Issues High Severity Warning for Chrome Users",
                summary: "Multiple vulnerabilities reported in Google Chrome could allow remote attackers to execute arbitrary code on targeted systems.",
                source: "CERT-In Advisory",
                date: "2 Hours Ago",
                imageUrl: "https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=800&q=80",
                tag: "Security Alert"
            },
            {
                id: 2,
                title: "New 'Digital Arrest' Scam Targeting Elderly in Maharastra",
                summary: "Cyber criminals impersonating law enforcement officers are coercing victims into transferring funds under the guise of fake money laundering cases.",
                source: "Times of India",
                date: "5 Hours Ago",
                imageUrl: "https://images.unsplash.com/photo-1555421689-d68471e189f2?w=800&q=80",
                tag: "Fraud Alert"
            },
            {
                id: 3,
                title: "DPDP Act 2023: Compliance Deadline Approaching",
                summary: "Enterprises must align data processing activities with the new Digital Personal Data Protection Act provisions by end of Q3.",
                source: "Economic Times",
                date: "1 Day Ago",
                imageUrl: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&q=80",
                tag: "Policy"
            },
            {
                id: 4,
                title: "Dark Web Market seized by International Task Force",
                summary: "Operation 'Cronos' dismantles LockBit ransomware infrastructure; 34 servers taken down across multiple jurisdictions.",
                source: "Europol / CBI",
                date: "1 Day Ago",
                imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80",
                tag: "Global Crime"
            },
            {
                id: 5,
                title: "AI-Generated Deepfakes used in Stock Market Manipulation",
                summary: "SEBI warns of realistic videos of executives promoting fraudulent schemes circulating on social media.",
                source: "SEBI Circular",
                date: "2 Days Ago",
                imageUrl: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80",
                tag: "AI Security"
            },
            {
                id: 6,
                title: "Critical Infrastructure Analysis: Power Grid Defense",
                summary: "National Power Grid conducts mock drill to assess resilience against state-sponsored cyber espionage attempts.",
                source: "Ministry of Power",
                date: "2 Days Ago",
                imageUrl: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&q=80",
                tag: "Infrastructure"
            }
        ];
        setNews(mockNews);
    }, []);

    // --- News Ticker State for Login Card ---
    const [newsIndex, setNewsIndex] = useState(0);
    const tickerHeadlines = [
        "CERT-In Warning: High-severity vulnerability detected in popular browsing software.",
        "RBI Awareness: Report unauthorized UPI transactions to 1930 immediately.",
        "MHA Advisory: New 'Digital Arrest' scams targeting senior citizens on rise.",
        "Cyber Swachhta Kendra: Download free Botnet Cleaning tools for Windows/Android.",
        "I4C Alert: Do not share OTPs for 'Part-Time Job' verification requests."
    ];
    useEffect(() => {
        const interval = setInterval(() => {
            setNewsIndex((prev) => (prev + 1) % tickerHeadlines.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-screen overflow-y-auto bg-black scroll-smooth snap-y snap-mandatory">

            {/* --- SECTION 1: LOGIN (Snap Center) --- */}
            <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-black snap-start">

                {/* Background Assets */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/20 rounded-full blur-3xl"></div>
                </div>

                <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-16 z-10 px-6 flex-grow items-center">

                    {/* Left: Branding */}
                    <div className="flex flex-col justify-center space-y-8 py-12">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 mb-2">
                                <Shield className="w-12 h-12 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                                <h1 className="text-5xl font-extrabold text-white tracking-widest font-sans">
                                    CYBER<span className="text-emerald-500">VAULT</span>
                                </h1>
                            </div>
                            <p className="text-slate-400 font-mono tracking-widest text-sm uppercase">
                                Decentralized Evidence Management System
                            </p>
                        </div>

                        <div className="border-l-4 border-emerald-600 pl-6 py-2">
                            <p className="text-slate-300 text-lg leading-relaxed font-light">
                                "Ensuring cryptographic integrity and immutable Chain of Custody for digital forensics.
                                Built for transparency, designed for justice."
                            </p>
                        </div>

                        {/* Ticker (Preserved from previous request) */}
                        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 mt-8 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="relative">
                                    <span className="absolute flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                </div>
                                <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest">Live Cyber-Alerts</h3>
                                <span className="text-[10px] text-slate-600 font-mono ml-auto">SOURCE: I4C / CERT-IN</span>
                            </div>
                            <div className="h-6 overflow-hidden relative">
                                {tickerHeadlines.map((headline, index) => (
                                    <p
                                        key={index}
                                        className={`text-slate-300 text-sm transition-all duration-500 absolute w-full truncate ${index === newsIndex
                                                ? "opacity-100 translate-y-0"
                                                : "opacity-0 translate-y-4"
                                            }`}
                                    >
                                        {headline}
                                    </p>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Login Card */}
                    <div className="flex items-center justify-center">
                        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl p-10 relative overflow-hidden group">
                            {/* Scanning Line Animation */}
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,1)] animate-scan-y opacity-50 pointer-events-none"></div>

                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Officer Access</h2>
                                <Lock className="w-5 h-5 text-slate-500" />
                            </div>

                            <form onSubmit={handleLogin} className="space-y-6">
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Digital Identity</label>
                                    <div className="relative group/input">
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded-lg p-4 pl-11 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm placeholder:text-slate-700" placeholder="officer@police.gov.in" required />
                                        <Shield className="w-5 h-5 text-slate-600 absolute left-3.5 top-3.5 transition-colors group-focus-within/input:text-emerald-500" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Access Key</label>
                                    <div className="relative group/input">
                                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded-lg p-4 pl-11 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm placeholder:text-slate-700" placeholder="••••••••" required />
                                        <Lock className="w-5 h-5 text-slate-600 absolute left-3.5 top-3.5 transition-colors group-focus-within/input:text-emerald-500" />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2 group/btn">
                                    {loading ? "Decrypting..." : "Authenticate"}
                                </button>
                            </form>
                            <div className="mt-6 text-center"><p className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">Sector 7 Security Protocols Active</p></div>
                        </div>
                    </div>
                </div>

                {/* Footer / Scroll Indicator */}
                <div className="absolute bottom-8 left-0 w-full text-center animate-bounce">
                    <button onClick={scrollToNews} className="text-slate-500 hover:text-white transition-colors flex flex-col items-center gap-2 mx-auto">
                        <span className="text-[10px] uppercase tracking-widest font-mono">Cyber Intelligence Hub</span>
                        <ChevronDown className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* --- SECTION 2: INTELLIGENCE HUB (Snap Start) --- */}
            <div ref={newsSectionRef} className="min-h-screen bg-slate-950 relative snap-start border-t border-slate-900">

                {/* Sticky Header */}
                <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex justify-between items-center px-8 shadow-lg">
                    <div className="flex items-center gap-2">
                        <Shield className="w-6 h-6 text-emerald-500" />
                        <h2 className="text-lg font-bold text-slate-200 tracking-wider">
                            CYBERVAULT <span className="text-slate-500 font-normal">| INTELLIGENCE</span>
                        </h2>
                    </div>
                    <div className="flex gap-4 text-xs font-mono text-slate-400">
                        <span className="hidden md:inline">LIVE FEED: ACTIVE</span>
                        <span className="text-emerald-500">SECURE CONNECTION ESTABLISHED</span>
                    </div>
                </div>

                {/* News Grid */}
                <div className="max-w-7xl mx-auto p-8 pb-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {news.map((item) => (
                            <div key={item.id} className="group bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-500/50 hover:bg-slate-900 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-900/10 flex flex-col h-full">

                                {/* Image Container */}
                                <div className="h-48 overflow-hidden relative">
                                    <img
                                        src={item.imageUrl}
                                        alt={item.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                                    />
                                    <div className="absolute top-4 left-4">
                                        <span className="bg-black/70 backdrop-blur-md text-emerald-400 text-[10px] font-bold px-2 py-1 rounded border border-emerald-500/30 uppercase tracking-wider">
                                            {item.tag}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6 flex flex-col flex-grow">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                            <Globe className="w-3 h-3" /> {item.source}
                                        </span>
                                        <span className="text-[10px] text-slate-600 font-mono">
                                            {item.date}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-200 group-hover:text-emerald-400 transition-colors mb-3 leading-tight">
                                        {item.title}
                                    </h3>

                                    <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-grow line-clamp-3">
                                        {item.summary}
                                    </p>

                                    <button className="flex items-center gap-2 text-xs font-bold text-slate-500 group-hover:text-emerald-500 transition-colors mt-auto uppercase tracking-wider">
                                        Read Analysis <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
