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
    FileSearch, Save, Dna, Activity, Fingerprint, Loader2, UploadCloud
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

    // Digital Ingestion Hub State
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [recoveredDataHash, setRecoveredDataHash] = useState("");
    const [isScanning, setIsScanning] = useState(false);

    // Report Data
    const [logs, setLogs] = useState<AnalysisLogEntry[]>([]);
    const [findings, setFindings] = useState<string[]>([]);
    const [artifactSummary, setArtifactSummary] = useState("");
    const [severity, setSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
    const [expertOpinion, setExpertOpinion] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- EFFECT: FETCH ASSIGNED CASES ---
    useEffect(() => {
        // Query items that are IN_TRANSIT and have an analysisRequestID (meaning released by Custodian)
        const q = query(
            collection(db, "evidence"),
            where("status", "==", "IN_TRANSIT"),
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

    const handleReportDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setReportFile(e.dataTransfer.files[0]);
            addToLog("INGESTION", `Report File Queued: ${e.dataTransfer.files[0].name}`);
        }
    };

    // Real-Time Integrity Checker
    useEffect(() => {
        if (!activeCase || !recoveredDataHash) return;

        // Normalize hashes (handle potential 0x prefix differences)
        const inputHash = recoveredDataHash.trim().toLowerCase();
        const blockchainHash = activeCase.fileHash.toLowerCase();

        // Simple check: does the input contain the blockchain hash (or vice versa for 0x)
        // Strictly, we should strip 0x and compare
        const cleanInput = inputHash.startsWith("0x") ? inputHash.slice(2) : inputHash;
        const cleanChain = blockchainHash.startsWith("0x") ? blockchainHash.slice(2) : blockchainHash;

        if (cleanInput.length < 64) {
            setIntegrityStatus("LOCKED"); // Wait for full hash
            return;
        }

        if (cleanInput === cleanChain) {
            setIntegrityStatus("VERIFIED");
            if (!logs.find(l => l.action === "INTEGRITY_CHECK" && l.details.includes("PASSED"))) {
                addToLog("INTEGRITY_CHECK", "PASSED: Recovered Data Match Confirmed");
            }
        } else {
            setIntegrityStatus("TAMPERED");
            if (!logs.find(l => l.action === "INTEGRITY_CHECK" && l.details.includes("FAILED"))) {
                addToLog("INTEGRITY_CHECK", "FAILED: Data Hash Mismatch");
            }
        }
    }, [recoveredDataHash, activeCase]);


    const verifyIntegrity = async () => {
        // Legacy Button Support (Auto-Verify via Download)
        if (!activeCase) return;
        setIsScanning(true);
        addToLog("INTEGRITY_CHECK", "Started Auto-Verification (Download & Hash)");

        try {
            const response = await fetch(activeCase.storageURL);
            const blob = await response.blob();
            const file = new File([blob], activeCase.fileName);
            const calculatedHash = await generateFileHash(file);

            // Populate the input field to trigger the effect
            setRecoveredDataHash(calculatedHash);
        } catch (e: any) {
            console.error(e);
            addToLog("ERROR", "Verification Failed: " + e.message);
        } finally {
            setIsScanning(false);
        }
    };

    const finalizeAnalysis = async () => {
        if (!activeCase || !window.ethereum) return;
        if (!confirm("Confirm submission of Expert Report? This will finalize the evidence.")) return;

        setIsSubmitting(true);
        addToLog("SUBMISSION", "Initiating Blockchain Transaction...");

        try {
            // 1. Prepare Report File
            let finalReportFile = reportFile;

            // If no external report uploaded, generate one
            if (!finalReportFile) {
                const reportContent = `
                    FORENSIC EXAMINATION REPORT
                    Ref: ${activeCase.analysisRequestID}
                    Evidence ID: ${activeCase.evidenceID}
                    Examiner: ${userData?.name || "Unknown"}
                    Severity: ${severity}
                    
                    --- ARTIFACT ANALYSIS SUMMARY ---
                    ${artifactSummary}
    
                    --- CRITICAL FINDINGS ---
                    ${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}
    
                    --- EXPERT OPINION ---
                    ${expertOpinion}
                    
                    --- VERIFICATION ---
                    Recovered Hash: ${recoveredDataHash}
                    Integrity: ${integrityStatus}

                    --- ACTIVITY LOG ---
                    ${logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.action}: ${l.details}`).join('\n')}
                `;
                finalReportFile = new File([reportContent], `REPORT_${activeCase.evidenceID}.txt`, { type: "text/plain" });
            }

            const reportHash = await generateFileHash(finalReportFile);
            const reportURL = await uploadToCloudinary(finalReportFile);

            // 2. Blockchain
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            // Add 0x prefix to hashes if needed
            const formattedReportHash = reportHash.startsWith("0x") ? reportHash : `0x${reportHash}`;

            // Note: Contract expects (evidenceID, reportHash, reportURL)
            // We might want to store the Recovered Hash too, but standard contract might not have a slot.
            // Assuming contract ABI is addForensicReport(uint256 evidenceID, bytes32 reportHash, string memory reportURL)

            const tx = await contract.addForensicReport(activeCase.evidenceID, formattedReportHash, reportURL);
            await tx.wait();

            // 3. Firestore
            await updateDoc(doc(db, "evidence", activeCase.evidenceID), {
                status: "ANALYZED",
                reportURL: reportURL,
                reportHash: formattedReportHash,
                expertOpinion: expertOpinion,
                artifactSummary: artifactSummary,
                findingsSeverity: severity,
                recoveredDataHash: recoveredDataHash
            });

            if (activeCase.caseID) {
                await updateDoc(doc(db, "cases", activeCase.caseID), {
                    status: "CLOSED",
                    blockchainStatus: "ANALYZED"
                });
            }

            addToLog("COMPLETE", "Report Notarized & Submitted");
            alert("Analysis Submitted Successfully!");
            setActiveCase(null);
            setIntegrityStatus("LOCKED");
            setRecoveredDataHash("");
            setReportFile(null);
            setFindings([]);
            setLogs([]);

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
                                onClick={() => { setActiveCase(item); setIntegrityStatus("LOCKED"); setLogs([]); setRecoveredDataHash(""); }}
                                className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors ${activeCase?.evidenceID === item.evidenceID ? "bg-blue-900/20 border-l-2 border-l-blue-500" : ""}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-mono text-xs text-blue-400 font-bold">{item.evidenceID}</span>
                                    <span className="text-[10px] text-slate-500">{item.fileType?.startsWith("image") ? "IMAGE" : "BINARY"}</span>
                                </div>
                                <div className="text-sm font-bold text-slate-200 mb-1 truncate">{item.fileName}</div>
                                <div className="text-[10px] text-slate-500 bg-slate-950 inline-block px-1 rounded border border-slate-800">
                                    HASH: {item.fileHash.substring(0, 8)}...
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
                                        <span className="text-slate-500">CHAIN HASH: {activeCase.fileHash.substring(0, 16)}...</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {activeCase.status === "IN_TRANSIT" && (
                                    <button
                                        onClick={async () => {
                                            if (!confirm("Confirm receipt of evidence package?")) return;
                                            try {
                                                const provider = new ethers.BrowserProvider(window.ethereum);
                                                const signer = await provider.getSigner();
                                                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                                                const tx = await contract.acceptTransfer(activeCase.evidenceID);
                                                await tx.wait();
                                                await updateDoc(doc(db, "evidence", activeCase.evidenceID), { status: "SECURED" });
                                                setActiveCase(prev => prev ? { ...prev, status: "SECURED" } : null);
                                                alert("Custody Accepted!");
                                            } catch (e: any) {
                                                console.error(e);
                                                alert("Accept Failed: " + e.message);
                                            }
                                        }}
                                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-amber-900/20 animate-pulse"
                                    >
                                        <Shield className="w-3 h-3" /> Accept Custody
                                    </button>
                                )}

                                {integrityStatus === "VERIFIED" && <div className="flex items-center gap-2 text-emerald-500 bg-emerald-950/30 px-4 py-2 rounded-lg border border-emerald-900/50"><CheckCircle className="w-4 h-4" /><span className="text-xs font-bold">INTEGRITY VERIFIED</span></div>}
                                {integrityStatus === "TAMPERED" && <div className="flex items-center gap-2 text-red-500 bg-red-950/30 px-4 py-2 rounded-lg border border-red-900/50 animate-pulse"><AlertOctagon className="w-4 h-4" /><span className="text-xs font-bold">TAMPER DETECTOR</span></div>}
                            </div>
                        </div>

                        {/* DIGITAL INGESTION HUB */}
                        <div className="flex-1 p-6 overflow-y-auto space-y-6">

                            {/* Card 1: Forensic Tool Integration */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                                {isScanning && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse z-0 pointer-events-none"></div>}
                                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-4 relative z-10">
                                    <Binary className="w-5 h-5 text-blue-500" /> Forensic Tool Integration (Autopsy / FTK)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                    {/* Drop Zone */}
                                    <div
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleReportDrop}
                                        className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-all ${reportFile ? "border-emerald-500 bg-emerald-900/10" : "border-slate-700 hover:border-slate-500"}`}
                                    >
                                        <UploadCloud className={`w-10 h-10 mb-4 ${reportFile ? "text-emerald-500" : "text-slate-500"}`} />
                                        {reportFile ? (
                                            <div>
                                                <p className="text-emerald-400 font-bold text-sm">{reportFile.name}</p>
                                                <p className="text-xs text-slate-500 mt-1">{(reportFile.size / 1024).toFixed(1)} KB Ready</p>
                                                <button onClick={() => setReportFile(null)} className="text-[10px] text-red-400 underline mt-2">Remove</button>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-slate-300 font-bold text-sm">Drop Analysis Report</p>
                                                <p className="text-xs text-slate-500 mt-1">Accepts .PDF, .JSON, .TXT</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Data Integrity Field */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Recovered Data Hash (SHA-256)</label>
                                            <div className="relative">
                                                <input
                                                    value={recoveredDataHash}
                                                    onChange={(e) => setRecoveredDataHash(e.target.value)}
                                                    placeholder="Paste hash from Forensic Tool..."
                                                    className={`w-full bg-slate-950 border rounded-lg p-3 pr-10 text-xs font-mono text-slate-200 outline-none ${integrityStatus === "VERIFIED" ? "border-emerald-500" : integrityStatus === "TAMPERED" ? "border-red-500" : "border-slate-800 focus:border-blue-500"}`}
                                                />
                                                {integrityStatus === "VERIFIED" && <CheckCircle className="w-4 h-4 text-emerald-500 absolute right-3 top-3.5" />}
                                                {integrityStatus === "TAMPERED" && <AlertOctagon className="w-4 h-4 text-red-500 absolute right-3 top-3.5" />}
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                                                {integrityStatus === "VERIFIED" ? <span className="text-emerald-500">Integrity Verified: Data Match Confirmed</span> : integrityStatus === "TAMPERED" ? <span className="text-red-500">WARNING: Data Mismatch - Potential Tampering</span> : "Enter hash to verify against blockchain record."}
                                            </p>
                                        </div>

                                        <button onClick={verifyIntegrity} className="text-[10px] text-blue-400 hover:text-blue-300 underline">
                                            Auto-Verify (Download & Hash)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Reporting Details */}
                            {integrityStatus === "VERIFIED" && (
                                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-purple-500" /> Technical Reporting
                                        </h3>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 font-bold uppercase">Findings Severity:</span>
                                            <select
                                                value={severity}
                                                onChange={(e: any) => setSeverity(e.target.value)}
                                                className={`bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-bold outline-none ${severity === "Critical" ? "text-red-500" : severity === "High" ? "text-orange-500" : "text-emerald-500"}`}
                                            >
                                                <option value="Low">Low</option>
                                                <option value="Medium">Medium</option>
                                                <option value="High">High</option>
                                                <option value="Critical">Critical</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Artifact Analysis Summary</label>
                                            <textarea
                                                value={artifactSummary}
                                                onChange={(e) => setArtifactSummary(e.target.value)}
                                                placeholder="e.g. 3 deleted files recovered, browser history analyzed. Traces of phishing kit found in /Downloads..."
                                                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 focus:border-blue-500 outline-none resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                )}
            </div>

            {/* PANE 3: REPORT & LOGS (RIGHT) - SIMPLIFIED */}
            <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase">Expert Conclusion</h3>
                </div>
                <div className="flex-1 p-4 flex flex-col">
                    <textarea
                        className="flex-1 bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-300 focus:border-blue-500 outline-none resize-none mb-4"
                        placeholder="Final expert opinion and conclusion..."
                        value={expertOpinion}
                        onChange={(e) => setExpertOpinion(e.target.value)}
                        disabled={integrityStatus !== "VERIFIED"}
                    />

                    <button
                        onClick={finalizeAnalysis}
                        disabled={integrityStatus !== "VERIFIED" || !expertOpinion || isSubmitting}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-800 text-white py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                        FINALIZE ANALYSIS
                    </button>

                    {/* Mini Log */}
                    <div className="mt-6 border-t border-slate-800 pt-4">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Session Activity</h3>
                        <div className="space-y-1 font-mono text-[10px] text-slate-500">
                            {logs.slice(0, 5).map((l, i) => (
                                <div key={i} className="truncate text-xs">{l.action}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
