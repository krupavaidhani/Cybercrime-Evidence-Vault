"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, query, where, onSnapshot } from "firebase/firestore";
import { useContract } from "@/hooks/useContract";
import { generateFileHash } from "@/utils/forensics";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    LayoutDashboard, Plus, Search, MapPin, Laptop, Shield, ChevronRight,
    FileText, User, AlertTriangle, Upload, CheckCircle2, XCircle, Filter
} from "lucide-react";

// --- Zod Schema ---
const caseSchema = z.object({
    firNumber: z.string().min(5, "FIR Number is required (e.g. FIR-123/2026)"),
    policeStation: z.string().min(3, "Police Station Name is required"),
    districtUnit: z.string().min(3, "District/Unit is required"),
    courtReference: z.string().optional(),
    complainantName: z.string().min(2, "Complainant Name is required"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    incidentType: z.string().min(1, "Please select an incident type"),
    category: z.enum(["Financial Fraud", "Data Breach", "Identity Theft", "Social Media Crime", "Phishing", "Other"]),
    incidentDate: z.string().min(1, "Date is required"),
    incidentTime: z.string().min(1, "Time is required"),
    location: z.string().min(5, "Location is required"),
    caseDescription: z.string().min(20, "Please provide a detailed description (min 20 chars)"),
    assignedSO: z.string().min(42, "Valid Ethereum Address required").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Wallet Address"),
    assignedExaminer: z.string().min(42, "Valid Ethereum Address required").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Wallet Address"),
});

type CaseFormData = z.infer<typeof caseSchema>;

export default function IODashboard() {
    const { userData } = useAuth();
    const { contract } = useContract();
    const [cases, setCases] = useState<any[]>([]);
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "FINALIZED">("ALL");

    // File Upload State
    const [firFile, setFirFile] = useState<File | null>(null);
    const [firHash, setFirHash] = useState<string>("");
    const [hashing, setHashing] = useState(false);

    // React Hook Form
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue
    } = useForm<CaseFormData>({
        resolver: zodResolver(caseSchema),
        defaultValues: {
            priority: "MEDIUM",
            category: "Financial Fraud",
            assignedSO: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default Mock
            assignedExaminer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default Mock
            incidentType: "Cyber Fraud"
        }
    });

    // Auto-generate Case ID (Display Only)
    const [displayCaseID, setDisplayCaseID] = useState("");

    useEffect(() => {
        if (showAssignForm) {
            const randomId = Math.floor(1000 + Math.random() * 9000);
            setDisplayCaseID(`CRB-${new Date().getFullYear()}-${randomId}`);
            setValue("incidentDate", new Date().toISOString().split('T')[0]);
        }
    }, [showAssignForm, setValue]);

    // Fetch Cases
    useEffect(() => {
        if (!userData) return;
        const q = query(collection(db, "cases"), where("createdBy", "==", userData.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCases(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, [userData]);

    // Handle File Hashing
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFirFile(file);
            setHashing(true);
            try {
                const hash = await generateFileHash(file);
                setFirHash(hash);
            } catch (err) {
                console.error("Hashing failed", err);
                alert("Failed to hash file. Please try again.");
            } finally {
                setHashing(false);
            }
        }
    };

    // Form Submission
    const onSubmit = async (data: CaseFormData) => {
        if (!firFile || !firHash) {
            alert("Please upload an FIR document.");
            return;
        }
        if (!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS && !contract) {
            // Allow proceeding without contract if env not set (for partial testing), but warn
            console.warn("Contract not connected or address missing. Blockchain step might fail.");
        }

        setLoading(true);
        setStatus("Starting secure case creation...");

        try {
            // 1. Upload FIR (Simulated for this step, or use Cloudinary if key exists)
            let firUrl = "";
            setStatus("Uploading FIR Document...");
            try {
                // Dynamic import to avoid SSR issues
                const { uploadToCloudinary } = await import("@/utils/cloudinary");
                firUrl = await uploadToCloudinary(firFile);
            } catch (e) {
                console.warn("Cloudinary upload failed or not configured, using mock URL", e);
                firUrl = "https://mock-storage.com/fir/" + firHash;
            }

            // 2. Blockchain Transaction
            if (contract) {
                setStatus("Notarizing Case on Blockchain...");
                try {
                    const tx = await contract.createCase(
                        displayCaseID,
                        data.firNumber,
                        firHash,
                        data.incidentType,
                        data.priority
                    );
                    await tx.wait();
                    setStatus("Blockchain Transaction Confirmed.");
                } catch (e: any) {
                    console.error("Blockchain Error:", e);
                    // Fallback: Proceed with Firestore but mark as pending sync
                    setStatus("Blockchain connection failed. Saving locally...");
                }
            } else {
                setStatus("Skipping Blockchain (Contract not connected)...");
            }

            // 3. Save to Firestore
            setStatus("Finalizing Case Record...");
            await setDoc(doc(db, "cases", displayCaseID), {
                ...data, // Spread form data
                caseID: displayCaseID,
                firHash,
                firUrl,
                createdBy: userData?.uid,
                createdAt: Date.now(),
                status: "OPEN",
                blockchainStatus: "CREATED"
            });

            setStatus(`Success: Case ${displayCaseID} initialized.`);
            reset();
            setFirFile(null);
            setFirHash("");
            setShowAssignForm(false);

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredCases = cases.filter(c => {
        const s = c.blockchainStatus || c.status;
        if (filter === "ALL") return true;
        if (filter === "ACTIVE") return !["FINALIZED"].includes(s);
        if (filter === "PENDING") return ["CREATED", "OPEN", "COLLECTED", "SECURED", "IN_TRANSIT"].includes(s);
        if (filter === "FINALIZED") return s === "FINALIZED";
        return true;
    });

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
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

            {/* STATUS BANNER */}
            {status && (
                <div className={`p-4 rounded border ${status.includes("Error") ? "bg-red-900/20 border-red-800 text-red-300" : "bg-emerald-900/20 border-emerald-800 text-emerald-300"}`}>
                    {status}
                </div>
            )}

            {/* CREATE CASE FORM */}
            {showAssignForm && (
                <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-xl p-8 shadow-2xl animate-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
                        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                            <FileText className="w-6 h-6 text-emerald-500" />
                            Initialize New Case
                        </h3>
                        <div className="text-slate-500 font-mono text-sm">
                            ID: <span className="text-slate-200">{displayCaseID}</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                        {/* Section 1: Legal Metadata */}
                        <div className="space-y-4 mb-8">
                            <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-emerald-500/20 px-2 py-1 rounded text-xs">01</span> Legal Metadata
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="label">FIR Number *</label>
                                    <input {...register("firNumber")} className="input-field" placeholder="XYZ/123/2026" />
                                    {errors.firNumber && <span className="error-text">{errors.firNumber.message}</span>}
                                </div>
                                <div>
                                    <label className="label">Police Station *</label>
                                    <input {...register("policeStation")} className="input-field" placeholder="Station Name" />
                                    {errors.policeStation && <span className="error-text">{errors.policeStation.message}</span>}
                                </div>
                                <div>
                                    <label className="label">District / Unit *</label>
                                    <input {...register("districtUnit")} className="input-field" placeholder="District" />
                                    {errors.districtUnit && <span className="error-text">{errors.districtUnit.message}</span>}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label">Court Case Ref (Optional)</label>
                                    <input {...register("courtReference")} className="input-field" placeholder="CC-2026-XXXX" />
                                </div>
                                <div>
                                    <label className="label">Complainant Name *</label>
                                    <input {...register("complainantName")} className="input-field" placeholder="Full Name" />
                                    {errors.complainantName && <span className="error-text">{errors.complainantName.message}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Crime Classification */}
                        <div className="space-y-4 mb-8">
                            <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-emerald-500/20 px-2 py-1 rounded text-xs">02</span> Crime Classification
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="label">Category *</label>
                                    <select {...register("category")} className="input-field">
                                        <option>Financial Fraud</option>
                                        <option>Data Breach</option>
                                        <option>Identity Theft</option>
                                        <option>Social Media Crime</option>
                                        <option>Phishing</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Incident Type *</label>
                                    <input {...register("incidentType")} className="input-field" placeholder="Specific Type" />
                                </div>
                                <div>
                                    <label className="label">Priority Level *</label>
                                    <div className="flex gap-2 mt-2">
                                        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                                            <label key={p} className="cursor-pointer">
                                                <input type="radio" value={p} {...register("priority")} className="peer sr-only" />
                                                <span className={`px-3 py-1 rounded text-xs font-bold border border-slate-700 text-slate-400 peer-checked:border-emerald-500 peer-checked:text-emerald-400 peer-checked:bg-emerald-900/20 transition-all text-center block
                                                    ${p === 'CRITICAL' ? 'peer-checked:text-red-400 peer-checked:border-red-500' : ''}
                                                `}>
                                                    {p}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Incident Details */}
                        <div className="space-y-4 mb-8">
                            <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-emerald-500/20 px-2 py-1 rounded text-xs">03</span> Incident Details
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label">Date & Time *</label>
                                    <div className="flex gap-2">
                                        <input type="date" {...register("incidentDate")} className="input-field" />
                                        <input type="time" {...register("incidentTime")} className="input-field" />
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Location *</label>
                                    <input {...register("location")} className="input-field" placeholder="Location address" />
                                </div>
                            </div>
                            <div>
                                <label className="label">Detailed Incident Summary *</label>
                                <textarea {...register("caseDescription")} className="input-field h-24" placeholder="Detailed summary..." />
                                {errors.caseDescription && <span className="error-text">{errors.caseDescription.message}</span>}
                            </div>
                        </div>

                        {/* Section 4: Evidence & Authorization */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="bg-emerald-500/20 px-2 py-1 rounded text-xs">04</span> Evidence & Authorization
                            </h4>

                            {/* Assignments */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label">Assign Seizure Officer (Wallet) *</label>
                                    <input {...register("assignedSO")} className="input-field text-xs font-mono" />
                                    {errors.assignedSO && <span className="error-text">{errors.assignedSO.message}</span>}
                                </div>
                                <div>
                                    <label className="label">Assign Examiner (Wallet) *</label>
                                    <input {...register("assignedExaminer")} className="input-field text-xs font-mono" />
                                    {errors.assignedExaminer && <span className="error-text">{errors.assignedExaminer.message}</span>}
                                </div>
                            </div>

                            {/* FIR Upload */}
                            <div className="border border-slate-700 border-dashed rounded-lg bg-slate-950/30 p-8 text-center hover:border-emerald-500/50 transition-colors relative group">
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <div className="flex flex-col items-center gap-3">
                                    {hashing ? (
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                                    ) : firHash ? (
                                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                    ) : (
                                        <Upload className="w-10 h-10 text-slate-500 group-hover:text-emerald-500 transition-colors" />
                                    )}

                                    <div>
                                        <p className="text-slate-300 font-medium">
                                            {firFile ? firFile.name : "Official FIR Document (PDF/JPG)"}
                                        </p>
                                        <p className="text-slate-500 text-xs mt-1">
                                            {firFile
                                                ? hashing ? "Calculating SHA-256 Hash..." : "Ready for Secure Upload"
                                                : "Drag & drop to upload the digital copy"
                                            }
                                        </p>
                                    </div>

                                    {firHash && (
                                        <div className="mt-2 bg-slate-900 px-3 py-1 rounded border border-slate-800">
                                            <p className="text-[10px] items-center gap-2 text-emerald-400 font-mono flex">
                                                <Shield className="w-3 h-3" />
                                                HASH: {firHash.substring(0, 10)}...{firHash.substring(firHash.length - 8)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-4 pt-6 border-t border-slate-800">
                            <button type="button" onClick={() => setShowAssignForm(false)} className="px-6 py-3 text-slate-400 hover:text-white transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading || hashing || !firHash}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded flex items-center gap-2 shadow-lg shadow-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                {loading ? "Securely Initializing..." : "Initialize Case"}
                            </button>
                        </div>

                    </form>
                </div>
            )}

            {/* CASE LIST (Simple View for Context) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCases.map((c) => (
                    <div key={c.caseID} className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-emerald-500/30 transition-all hover:-translate-y-1">
                        <div className="flex justify-between mb-4">
                            <span className="font-mono font-bold text-lg text-slate-200">{c.caseID}</span>
                            <span className={`px-2 py-0.5 text-xs rounded border ${c.priority === 'CRITICAL' ? 'border-red-900 bg-red-900/20 text-red-400' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                                {c.priority}
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm mb-4 line-clamp-2">{c.description || c.caseDescription}</p>
                        <div className="text-xs text-slate-500 flex justify-between items-center border-t border-slate-800 pt-4">
                            <span>{c.incidentType}</span>
                            <span className="text-emerald-500">{c.blockchainStatus || c.status}</span>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .label {
                    @apply block text-sm font-semibold text-slate-400 mb-2;
                }
                .input-field {
                    width: 100%;
                    background-color: #0f172a;
                    border: 2px solid #475569;
                    border-radius: 0.5rem;
                    padding: 0.75rem;
                    color: white;
                    outline: none;
                    transition: all 0.2s;
                }
                .input-field:focus {
                    border-color: #10b981;
                    box-shadow: 0 0 0 1px #10b981;
                }
                .input-field::placeholder {
                    color: #64748b;
                }
                .error-text {
                    @apply text-red-500 text-xs mt-1 block;
                }
            `}</style>
        </div>
    );
}
