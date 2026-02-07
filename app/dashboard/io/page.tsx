"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, query, where, onSnapshot } from "firebase/firestore";
import { UserPlus, Plus, Search, Shield, LayoutDashboard, Clock, CheckCircle2, ChevronRight, AlertTriangle, Laptop, MapPin, Filter } from "lucide-react";

export default function IODashboard() {
    const { userData } = useAuth();
    const [cases, setCases] = useState<any[]>([]);
    const [showAssignForm, setShowAssignForm] = useState(false);

    // Form States
    const [caseID, setCaseID] = useState("");
    const [firNumber, setFirNumber] = useState("");
    const [priority, setPriority] = useState("MEDIUM");
    const [incidentType, setIncidentType] = useState("Cyber Fraud");
    const [incidentDate, setIncidentDate] = useState("");
    const [incidentTime, setIncidentTime] = useState("");
    const [location, setLocation] = useState("");
    const [category, setCategory] = useState("Digital");
    const [sectionAct, setSectionAct] = useState("");
    const [soAddress, setSoAddress] = useState("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"); // Account #0 (Super User)
    const [examinerAddress, setExaminerAddress] = useState("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"); // Account #0 (Super User)
    const [caseDescription, setCaseDescription] = useState("");
    const [authDoc, setAuthDoc] = useState<File | null>(null);

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    // Filter State
    const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "FINALIZED">("ALL");

    // Helper: Check if case is stale (no activity for 48 hours)
    const isStale = (timestamp: number) => {
        const fortyEightHours = 48 * 60 * 60 * 1000;
        return Date.now() - timestamp > fortyEightHours;
    };

    // Helper: Get Stepper Index
    const getStepIndex = (status: string) => {
        const steps = ["OPEN", "COLLECTED", "ANALYZED", "FINALIZED"];
        // Map intermediate statuses
        if (status === "SECURED") return 1;
        if (status === "CREATED") return 0;
        return steps.indexOf(status) > -1 ? steps.indexOf(status) : 0;
    };

    // Filter Logic
    const filteredCases = cases.filter(c => {
        if (filter === "ALL") return true;
        if (filter === "ACTIVE") return ["OPEN", "COLLECTED", "SECURED"].includes(c.blockchainStatus);
        if (filter === "PENDING") return ["COLLECTED", "SECURED"].includes(c.blockchainStatus); // Pending Analysis
        if (filter === "FINALIZED") return c.blockchainStatus === "FINALIZED";
        return true;
    });

    // Auto-generate Case ID when form opens
    useEffect(() => {
        if (showAssignForm) {
            const randomId = Math.floor(1000 + Math.random() * 9000);
            setCaseID(`CRB-${new Date().getFullYear()}-${randomId}`);
            setIncidentDate(new Date().toISOString().split('T')[0]);
        }
    }, [showAssignForm]);

    useEffect(() => {
        if (!userData) return;

        // Fetch cases created by this IO
        const q = query(collection(db, "cases"), where("createdBy", "==", userData.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const casesData = snapshot.docs.map(doc => doc.data());
            setCases(casesData);
        });

        return () => unsubscribe();
    }, [userData]);

    const handleCreateAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus("Processing assignment...");

        try {
            let authDocURL = "";
            if (authDoc) {
                setStatus("Uploading Authorization Document...");
                // Dynamic import to avoid SSR issues if any, though standard import is fine usually
                const { uploadToCloudinary } = await import("@/utils/cloudinary");
                authDocURL = await uploadToCloudinary(authDoc);
            }

            await setDoc(doc(db, "cases", caseID), {
                caseID,
                firNumber,
                priority,
                incidentType,
                incidentDate,
                incidentTime,
                location,
                category,
                sectionAct,
                description: caseDescription,
                assignedSO: soAddress,
                assignedExaminer: examinerAddress,
                authDocURL,
                createdBy: userData?.uid,
                createdAt: Date.now(),
                status: "OPEN",
                blockchainStatus: "CREATED"
            });

            setStatus(`Success: Case ${caseID} initialized.`);
            // Reset form
            setCaseID("");
            setFirNumber("");
            setCaseDescription("");
            setAuthDoc(null);
            setShowAssignForm(false);
        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAuthDoc(e.target.files[0]);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-emerald-500" />
                        Command Center
                    </h2>
                    <p className="text-slate-400 text-sm mt-1 uppercase tracking-wider">
                        Investigation Unit • Active Operations
                    </p>
                </div>
                <button
                    onClick={() => setShowAssignForm(!showAssignForm)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                    <Plus className="w-4 h-4" />
                    New Assignment
                </button>
            </div>

            {/* Assignment Form (Collapsible) */}
            {showAssignForm && (
                <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-8 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
                    <h3 className="text-xl font-bold text-slate-100 flex items-center gap-3 mb-8 pb-4 border-b border-slate-800">
                        <UserPlus className="w-6 h-6 text-emerald-500" />
                        Initialize New Case
                    </h3>

                    <form onSubmit={handleCreateAssignment} className="space-y-8">

                        {/* 1. Case Identity Section */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-emerald-500/20 px-2 py-1 rounded text-xs">01</span> Case Identity
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Case Number (Auto)</label>
                                    <input
                                        type="text"
                                        value={caseID}
                                        readOnly
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded p-3 text-slate-400 font-mono cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">FIR Number *</label>
                                    <input
                                        type="text"
                                        value={firNumber}
                                        onChange={(e) => setFirNumber(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 focus:border-emerald-500 outline-none font-mono"
                                        placeholder="e.g. FIR-1024/26"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Priority Level</label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value)}
                                        className={`w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm font-bold outline-none ${priority === 'CRITICAL' ? 'text-red-500' :
                                            priority === 'HIGH' ? 'text-orange-500' : 'text-slate-200'
                                            }`}
                                    >
                                        <option value="LOW">LOW</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="CRITICAL">CRITICAL</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 2. Incident Details Section */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-emerald-500/20 px-2 py-1 rounded text-xs">02</span> Incident Details
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Incident Type</label>
                                    <select
                                        value={incidentType}
                                        onChange={(e) => setIncidentType(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none"
                                    >
                                        <option>Cyber Fraud</option>
                                        <option>Data Breach</option>
                                        <option>Homicide</option>
                                        <option>Narcotics</option>
                                        <option>Theft</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Date of Occurrence</label>
                                    <input
                                        type="date"
                                        value={incidentDate}
                                        onChange={(e) => setIncidentDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Time (Approx)</label>
                                    <input
                                        type="time"
                                        value={incidentTime}
                                        onChange={(e) => setIncidentTime(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Primary Location (Address / GPS)</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none"
                                    placeholder="e.g. 123 Cyber Park, Sector 5..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Incident Summary</label>
                                <textarea
                                    value={caseDescription}
                                    onChange={(e) => setCaseDescription(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none h-24"
                                    placeholder="Provide a high-level overview of the incident..."
                                    required
                                />
                            </div>
                        </div>

                        {/* 3. Classification */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-emerald-500/20 px-2 py-1 rounded text-xs">03</span> Classification
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none"
                                    >
                                        <option>Physical</option>
                                        <option>Digital</option>
                                        <option>Hybrid</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Section / Act (Legal)</label>
                                    <input
                                        type="text"
                                        value={sectionAct}
                                        onChange={(e) => setSectionAct(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-slate-200 outline-none"
                                        placeholder="e.g. IT Act Sec 66D"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 4. Assignment & Authorization */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-emerald-500/20 px-2 py-1 rounded text-xs">04</span> Assignment & Authorization
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Seizure Officer (Wallet)</label>
                                    <input
                                        type="text"
                                        value={soAddress}
                                        onChange={(e) => setSoAddress(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-emerald-400 text-xs font-mono outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Forensic Examiner (Wallet)</label>
                                    <input
                                        type="text"
                                        value={examinerAddress}
                                        onChange={(e) => setExaminerAddress(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-emerald-400 text-xs font-mono outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Authorization Document (Warrant/Order)</label>
                                <div className="border border-slate-700 border-dashed rounded bg-slate-950/50 p-6 text-center cursor-pointer hover:border-emerald-500 transition-colors relative">
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    {authDoc ? (
                                        <p className="text-emerald-400 text-sm font-medium">{authDoc.name}</p>
                                    ) : (
                                        <p className="text-slate-500 text-sm">Click to upload Search Warrant or Court Order</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowAssignForm(false)}
                                className="px-6 py-3 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded flex items-center gap-2 shadow-lg shadow-emerald-900/40 disabled:opacity-50 transition-all"
                            >
                                {loading ? "Initializing Case..." : "Initialize Case"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Case Status Hub Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                    {(["ALL", "ACTIVE", "PENDING", "FINALIZED"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded text-xs font-bold transition-all ${filter === f ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Filter className="w-3 h-3" /> Showing {filteredCases.length} Cases
                </div>
            </div>

            {/* Triage Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCases.length === 0 ? (
                    <div className="col-span-full text-center py-20 bg-slate-900/50 rounded-lg border border-slate-800 border-dashed">
                        <Search className="w-12 h-12 mx-auto mb-4 text-slate-700" />
                        <p className="text-slate-500">No cases match the current filter.</p>
                    </div>
                ) : (
                    filteredCases.map((c) => {
                        const stale = isStale(c.createdAt); // Should ideally use 'updatedAt' if available
                        const stepIndex = getStepIndex(c.blockchainStatus || c.status);

                        return (
                            <div
                                key={c.caseID}
                                className={`bg-slate-900 border rounded-lg overflow-hidden transition-all group relative hover:-translate-y-1 hover:shadow-xl ${stale ? "border-red-900/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]" : "border-slate-800 hover:border-emerald-500/30"
                                    }`}
                            >
                                {/* Inactivity Pulse */}
                                {stale && (
                                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping m-2"></div>
                                )}

                                <div className="p-6">
                                    {/* Header: ID, Category, Priority */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${c.category === "Physical" ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                                                }`}>
                                                {c.category === "Physical" ? <MapPin className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h3 className="font-mono text-lg text-slate-200 font-bold group-hover:text-emerald-400 transition-colors">
                                                    {c.caseID}
                                                </h3>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{c.incidentType || "Incident"}</p>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${c.priority === "CRITICAL" ? "bg-red-950 text-red-400 border-red-900" :
                                            c.priority === "HIGH" ? "bg-orange-950 text-orange-400 border-orange-900" :
                                                "bg-slate-800 text-slate-400 border-slate-700"
                                            }`}>
                                            {c.priority}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-slate-400 text-sm mb-6 line-clamp-2 h-10 leading-relaxed">
                                        {c.description}
                                    </p>

                                    {/* Progress Stepper */}
                                    <div className="mb-6">
                                        <div className="flex justify-between text-[10px] text-slate-500 uppercase mb-2 font-bold tracking-wider">
                                            <span>Stage</span>
                                            <span className={stepIndex === 3 ? "text-emerald-500" : "text-blue-400"}>
                                                {c.blockchainStatus || c.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 h-1.5">
                                            {[0, 1, 2, 3].map((step) => (
                                                <div key={step} className={`h-full flex-1 rounded-full transition-colors ${step <= stepIndex ? "bg-emerald-500" : "bg-slate-800"
                                                    }`}></div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between text-[8px] text-slate-600 mt-1 uppercase font-mono">
                                            <span>Reg</span>
                                            <span>Seize</span>
                                            <span>Analyze</span>
                                            <span>Final</span>
                                        </div>
                                    </div>

                                    {/* Footer: Custodian & Action */}
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            <Shield className="w-3 h-3" />
                                            <span className="font-mono text-slate-300">
                                                {c.assignedSO ? `${c.assignedSO.substring(0, 6)}...` : "Unassigned"}
                                            </span>
                                        </div>

                                        <button className="text-emerald-500 hover:text-emerald-400 text-xs font-bold flex items-center gap-1 uppercase tracking-wide group-hover:translate-x-1 transition-transform">
                                            View Report <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
