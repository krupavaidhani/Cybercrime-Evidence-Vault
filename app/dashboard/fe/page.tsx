"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";
import { ethers } from "ethers";
import { generateFileHash } from "@/utils/forensics";
import { uploadToCloudinary } from "@/utils/cloudinary";
import {
    Microscope, Search, FileText, Binary, Gavel,
    Shield, CheckCircle, AlertOctagon, Lock, Unlock,
    FileSearch, Save, Dna, Activity, Fingerprint, Loader2
} from "lucide-react";
import contractConfig from "@/app/contractConfig.json";

// Smart Contract Config
const CONTRACT_ABI = contractConfig.abi;
const CONTRACT_ADDRESS = contractConfig.address;

interface EvidenceItem {
    evidenceID: string;
    caseID?: string; // Linked Case
    fileHash: string;
    fileName: string;
    fileType: string;
    storageURL: string;
    officerName: string;
    timestamp: number;
    status: string;
    analysisRequestID?: string;
    description?: string;
    category?: string;
}

interface AnalysisLogEntry {
    timestamp: number;
    action: string;
    details: string;
}

export default function ForensicWorkbench() {
    // --- STATE ---
    const { userData } = useAuth();

    // Data
    const [caseQueue, setCaseQueue] = useState<EvidenceItem[]>([]);
    const [activeCase, setActiveCase] = useState<EvidenceItem | null>(null);

    // Workbench State
    const [integrityStatus, setIntegrityStatus] = useState<"LOCKED" | "VERIFIED" | "TAMPERED">("LOCKED");
    const [activeTool, setActiveTool] = useState<"ANALYSIS" | "FINDINGS">("ANALYSIS");

    // Report Data
    const [logs, setLogs] = useState<AnalysisLogEntry[]>([]);
    const [findings, setFindings] = useState<string[]>([]);
    const [expertOpinion, setExpertOpinion] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- EFFECT: FETCH ASSIGNED CASES ---
    useEffect(() => {
        // Query items that are IN_TRANSIT and have an analysisRequestID (meaning released by Custodian)
        const q = query(
            collection(db, "evidence"),
            where("status", "==", "IN_TRANSIT"),
            // where("analysisRequestID", "!=", "") // Firestore specific: ensures field exists and not empty
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: EvidenceItem[] = [];
            snapshot.forEach(doc => {
                const data = doc.data() as EvidenceItem;
                if (data.analysisRequestID) items.push(data);
            });
            setCaseQueue(items);
        });

        return () => unsubscribe();
    }, []);

    // --- ACTIONS ---

    const addToLog = (action: string, details: string) => {
        setLogs(prev => [{ timestamp: Date.now(), action, details }, ...prev]);
    };

    const addFinding = (text: string) => {
        setFindings(prev => [...prev, text]);
        addToLog("FLAGGED", text);
    };

    const verifyIntegrity = async () => {
        if (!activeCase) return;
        addToLog("INTEGRITY_CHECK", "Started SHA-256 Hash Verification");

        try {
            const response = await fetch(activeCase.storageURL);
            const blob = await response.blob();
            const file = new File([blob], activeCase.fileName);
            const calculatedHash = await generateFileHash(file);

            if (calculatedHash === activeCase.fileHash) {
                setIntegrityStatus("VERIFIED");
                addToLog("INTEGRITY_CHECK", "PASSED: Hash matches Blockchain Record");
            } else {
                setIntegrityStatus("TAMPERED");
                addToLog("INTEGRITY_CHECK", `FAILED: Hash Mismatch! (Calc: ${calculatedHash.substring(0, 8)}...)`);
            }
        } catch (e: any) {
            console.error(e);
            addToLog("ERROR", "Verification Failed: " + e.message);
        }
    };

    const finalizeAnalysis = async () => {
        if (!activeCase || !window.ethereum) return;
        if (!confirm("Confirm submission of Expert Report? This will finalize the evidence.")) return;

        setIsSubmitting(true);
        addToLog("SUBMISSION", "Initiating Blockchain Transaction...");

        try {
            // 1. Create a simple text report
            const reportContent = `
                FORENSIC EXAMINATION REPORT
                Ref: ${activeCase.analysisRequestID}
                Evidence ID: ${activeCase.evidenceID}
                Examiner: ${userData?.name || "Unknown"}
                
                --- VERIFICATION ---
                Hash: ${activeCase.fileHash}
                Integrity: ${integrityStatus}

                --- CRITICAL FINDINGS ---
                ${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

                --- EXPERT OPINION ---
                ${expertOpinion}

                --- ACTIVITY LOG ---
                ${logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.action}: ${l.details}`).join('\n')}
            `;

            const reportFile = new File([reportContent], `REPORT_${activeCase.evidenceID}.txt`, { type: "text/plain" });
            const reportHash = await generateFileHash(reportFile);
            const reportURL = await uploadToCloudinary(reportFile);

            // 2. Blockchain
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            const tx = await contract.addForensicReport(activeCase.evidenceID, reportHash, reportURL);
            await tx.wait();

            // 3. Firestore
            await updateDoc(doc(db, "evidence", activeCase.evidenceID), {
                status: "ANALYZED",
                reportURL: reportURL,
                reportHash: reportHash,
                expertOpinion: expertOpinion
            });

            if (activeCase.caseID) {
                await updateDoc(doc(db, "cases", activeCase.caseID), {
                    status: "CLOSED",
                    blockchainStatus: "ANALYZED"
                });
            } else {
                console.warn("Skipping Case Update: No Case ID linked to Evidence");
            }

            addToLog("COMPLETE", "Report Notarized & Submitted");
            alert("Analysis Submitted Successfully!");
            setActiveCase(null);
            setIntegrityStatus("LOCKED");

        } catch (e: any) {
            console.error(e);
            alert("Submission Failed: " + e.message);
            addToLog("ERROR", "Submission Failed: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-screen bg-slate-950 text-slate-200 flex overflow-hidden font-sans">

            {/* PANE 1: CASE EXPLORER (LEFT) */}
            <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                    <h2 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Search className="w-4 h-4" /> Evidence Queue
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {caseQueue.length === 0 ? (
                        <div className="p-8 text-center opacity-50 text-xs">No pending analysis requests.</div>
                    ) : (
                        caseQueue.map(item => (
                            <div
                                key={item.evidenceID}
                                onClick={() => { setActiveCase(item); setIntegrityStatus("LOCKED"); setLogs([]); }}
                                className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors ${activeCase?.evidenceID === item.evidenceID ? "bg-blue-900/20 border-l-2 border-l-blue-500" : ""}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-mono text-xs text-blue-400 font-bold">{item.evidenceID}</span>
                                    {item.category === "Phishing" ? <GlobeIcon size={12} className="text-rose-400" /> : <HardDriveIcon size={12} className="text-emerald-400" />}
                                </div>
                                <div className="text-sm font-bold text-slate-200 mb-1 truncate">{item.fileName}</div>
                                <div className="text-[10px] text-slate-500 bg-slate-950 inline-block px-1 rounded border border-slate-800">
                                    REQ: {item.analysisRequestID}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* PANE 2: WORKBENCH (CENTER) */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
                {!activeCase ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <Microscope className="w-24 h-24 mb-4" />
                        <h1 className="text-2xl font-bold">Select Evidence to Analyze</h1>
                        <p className="text-sm">Digital Forensic Workbench v2.0</p>
                    </div>
                ) : (
                    <>
                        {/* Workbench Header */}
                        <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
                            <div className="flex items-center gap-4">
                                <FileText className="w-5 h-5 text-slate-400" />
                                <div>
                                    <h1 className="text-sm font-bold text-white">{activeCase.fileName}</h1>
                                    <div className="flex items-center gap-2 text-[10px] font-mono">
                                        <span className="text-amber-500">CASE: {activeCase.caseID || "N/A"}</span>
                                        <span className="text-slate-500">|</span>
                                        <span className="text-slate-500">{activeCase.fileHash.substring(0, 16)}...</span>
                                    </div>
                                </div>
                            </div>

                            {/* Integrity & Custody Actions */}
                            <div className="flex items-center gap-2">
                                {activeCase.status === "IN_TRANSIT" && (
                                    <button
                                        onClick={async () => {
                                            if (!confirm("Confirm receipt of evidence package? This will assume Chain of Custody.")) return;
                                            try {
                                                const provider = new ethers.BrowserProvider(window.ethereum);
                                                const signer = await provider.getSigner();
                                                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

                                                const tx = await contract.acceptTransfer(activeCase.evidenceID);
                                                await tx.wait();

                                                await updateDoc(doc(db, "evidence", activeCase.evidenceID), { status: "SECURED" });

                                                // Refresh local state
                                                setActiveCase(prev => prev ? { ...prev, status: "SECURED" } : null);
                                                alert("Custody Accepted! You may now begin analysis.");
                                            } catch (e: any) {
                                                console.error(e);
                                                alert("Accept Failed: " + (e.reason || e.message));
                                            }
                                        }}
                                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-amber-900/20 animate-pulse"
                                    >
                                        <Shield className="w-3 h-3" /> Accept Custody
                                    </button>
                                )}


                                {activeCase.status === "SECURED" && integrityStatus === "LOCKED" && (
                                    <button
                                        onClick={verifyIntegrity}
                                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700"
                                    >
                                        <Lock className="w-3 h-3" /> Verify Integrity
                                    </button>
                                )}
                                {integrityStatus === "VERIFIED" && (
                                    <div className="flex items-center gap-2 text-emerald-500 bg-emerald-950/30 px-4 py-2 rounded-lg border border-emerald-900/50">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-xs font-bold">CHAIN OF CUSTODY VERIFIED</span>
                                    </div>
                                )}
                                {integrityStatus === "TAMPERED" && (
                                    <div className="flex items-center gap-2 text-red-500 bg-red-950/30 px-4 py-2 rounded-lg border border-red-900/50 animate-pulse">
                                        <AlertOctagon className="w-4 h-4" />
                                        <span className="text-xs font-bold">TAMPER DETECTED</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Workbench Content */}
                        <div className="flex-1 p-6 overflow-hidden flex flex-col">
                            {integrityStatus !== "VERIFIED" ? (
                                <div className="flex-1 rounded-xl border-2 border-dashed border-slate-800 flex items-center justify-center">
                                    <div className="text-center">
                                        <Lock className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold">Analysis Locked</p>
                                        <p className="text-xs text-slate-600">Verify integrity to unlock forensic tools.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 bg-black rounded-xl border border-slate-800 overflow-hidden relative">
                                    {/* Preview Mockup */}
                                    {activeCase.fileType.startsWith("image/") ? (
                                        <img src={activeCase.storageURL} className="w-full h-full object-contain opacity-80" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600 font-mono text-xs p-8">
                                            [BINARY CONTENT PREVIEW NOT AVAILABLE]
                                            <br />
                                            00000000  48 65 6c 6c 6f 20 57 6f  72 6c 64 21 00 00 00 00  |Hello World!....|
                                            <br />
                                            00000010  00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  |................|
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* PANE 3: TOOLKIT & REPORT (RIGHT) */}
            <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
                {/* Tool Tabs */}
                <div className="flex border-b border-slate-800">
                    <button
                        onClick={() => setActiveTool("ANALYSIS")}
                        className={`flex-1 py-3 text-xs font-bold uppercase ${activeTool === "ANALYSIS" ? "text-blue-400 border-b-2 border-blue-500 bg-slate-800" : "text-slate-500 hover:text-slate-300"}`}
                    >
                        Analysis
                    </button>
                    <button
                        onClick={() => setActiveTool("FINDINGS")}
                        className={`flex-1 py-3 text-xs font-bold uppercase ${activeTool === "FINDINGS" ? "text-blue-400 border-b-2 border-blue-500 bg-slate-800" : "text-slate-500 hover:text-slate-300"}`}
                    >
                        Findings ({findings.length})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* A. ANALYSIS TOOLS */}
                    {activeTool === "ANALYSIS" && integrityStatus === "VERIFIED" && (
                        <div className="space-y-4 animate-in fade-in">
                            <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                <Microscope className="w-3 h-3 text-blue-500" /> Forensic Toolkit
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { addToLog("TOOL_RUN", "Metadata Extractor"); addFinding("Metadata: Original Creation Date confirmed."); }} className="p-3 bg-slate-950 border border-slate-800 rounded hover:border-blue-500 text-left transition-all active:scale-95">
                                    <FileSearch className="w-4 h-4 text-blue-400 mb-2" />
                                    <div className="text-xs font-bold text-slate-300">Extract Metadata</div>
                                </button>
                                <button onClick={() => { addToLog("TOOL_RUN", "Hex Pattern Scan"); addFinding("Hex Scan: No malformed headers found."); }} className="p-3 bg-slate-950 border border-slate-800 rounded hover:border-purple-500 text-left transition-all active:scale-95">
                                    <Binary className="w-4 h-4 text-purple-400 mb-2" />
                                    <div className="text-xs font-bold text-slate-300">Hex Scan</div>
                                </button>
                                <button onClick={() => { addToLog("TOOL_RUN", "Phishing Link Analysis"); addFinding("Phishing: Suspicious URL pattern detected."); }} className="p-3 bg-slate-950 border border-slate-800 rounded hover:border-orange-500 text-left transition-all active:scale-95">
                                    <Activity className="w-4 h-4 text-orange-400 mb-2" />
                                    <div className="text-xs font-bold text-slate-300">Phishing AI</div>
                                </button>
                                <button onClick={() => addToLog("TOOL_RUN", "Timeline Reconstruction")} className="p-3 bg-slate-950 border border-slate-800 rounded hover:border-emerald-500 text-left transition-all active:scale-95">
                                    <Dna className="w-4 h-4 text-emerald-400 mb-2" />
                                    <div className="text-xs font-bold text-slate-300">Timeline</div>
                                </button>
                            </div>

                            {/* Manual Flagging */}
                            <div className="pt-2">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Manual Tagging</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => addFinding("CRITICAL: Malware Signature Detected")} className="flex-1 bg-red-950/30 border border-red-900 p-2 rounded text-[10px] text-red-400 font-bold hover:bg-red-900/50">
                                        + Flag Malware
                                    </button>
                                    <button onClick={() => addFinding("Evidence of Tampering")} className="flex-1 bg-amber-950/30 border border-amber-900 p-2 rounded text-[10px] text-amber-400 font-bold hover:bg-amber-900/50">
                                        + Flag Tampering
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* B. FINDINGS LIST */}
                    {activeTool === "FINDINGS" && (
                        <div className="space-y-4 animate-in fade-in">
                            <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                <Search className="w-3 h-3 text-emerald-500" /> Key Findings
                            </h3>
                            {findings.length === 0 ? (
                                <p className="text-xs text-slate-600 italic text-center py-4">No critical findings tagged yet.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {findings.map((f, i) => (
                                        <li key={i} className="bg-slate-950 border border-slate-800 p-3 rounded text-xs text-slate-300 flex items-start gap-2">
                                            <span className="text-slate-600 font-mono">{i + 1}.</span>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* C. LOGS */}
                    {activeTool === "ANALYSIS" && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                                <Activity className="w-3 h-3 text-slate-500" /> Activity Log
                            </h3>
                            <div className="bg-black/40 border border-slate-800 rounded p-2 h-32 overflow-y-auto font-mono text-[10px] space-y-1">
                                {logs.length === 0 && <span className="opacity-30">No actions recorded.</span>}
                                {logs.map((log, i) => (
                                    <div key={i} className="text-slate-400 border-l px-2 border-slate-700">
                                        <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span className="text-blue-400">{log.action}:</span> {log.details}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* D. EXPERT OPINION */}
                    <div className="pt-4 border-t border-slate-800">
                        <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                            <Gavel className="w-3 h-3 text-rose-500" /> Expert Opinion
                        </h3>
                        <textarea
                            className="w-full h-32 bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-300 focus:border-blue-500 outline-none resize-none"
                            placeholder="Enters findings and conclusion here..."
                            value={expertOpinion}
                            onChange={(e) => setExpertOpinion(e.target.value)}
                            disabled={integrityStatus !== "VERIFIED"}
                        />
                        <button
                            onClick={finalizeAnalysis}
                            disabled={integrityStatus !== "VERIFIED" || !expertOpinion || isSubmitting}
                            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-800 text-white py-3 rounded text-xs font-bold flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                            Generate Report & Finalize
                        </button>
                    </div>

                </div>
            </div>

        </div >
    );
}

// Icons (Helper)
function GlobeIcon({ size, className }: { size: number, className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
}
function HardDriveIcon({ size, className }: { size: number, className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="22" x2="2" y1="12" y2="12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><line x1="6" x2="6.01" y1="16" y2="16" /><line x1="10" x2="10.01" y1="16" y2="16" /></svg>
}
