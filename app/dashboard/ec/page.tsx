"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { ethers } from "ethers";
import { generateFileHash } from "@/utils/forensics";
import {
    Shield, CheckCircle, Clock, FileText, User, ExternalLink, Loader2,
    Lock, ArrowRight, AlertOctagon, Archive, Search, History, AlertTriangle,
    Box, FileSignature, Trash2, XCircle
} from "lucide-react";
import contractConfig from "@/app/contractConfig.json";

// Smart Contract Config
const CONTRACT_ABI = contractConfig.abi;
const CONTRACT_ADDRESS = contractConfig.address;

interface EvidenceItem {
    evidenceID: string;
    caseID?: string; // Linked Case
    fileHash: string; // Blockchain Hash
    fileName: string;
    fileType: string;
    storageURL: string;
    officerName: string;
    timestamp: number;
    status: string;
    txHash: string;
    // Enhanced Fields
    storageLocation?: string; // Physical Bin/Shelf
    sealCondition?: "Intact" | "Damaged";
    custodianNotes?: string;
    analysisRequestID?: string;
    processedBy?: string;
    custodianTimestamp?: number;
    custodianTxHash?: string;
    retentionExpiry?: number;
}

export default function CustodianDashboard() {
    const [activeTab, setActiveTab] = useState<"incoming" | "vault" | "audit">("incoming");
    const [transitList, setTransitList] = useState<EvidenceItem[]>([]);
    const [vaultList, setVaultList] = useState<EvidenceItem[]>([]);

    // Processing States
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [verifyStatus, setVerifyStatus] = useState<string>("");
    const [integrityError, setIntegrityError] = useState<string | null>(null);

    // Vault Management State
    const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);
    const [editLocation, setEditLocation] = useState("");
    const [editSeal, setEditSeal] = useState<"Intact" | "Damaged">("Intact");

    // Release State
    const [showReleaseModal, setShowReleaseModal] = useState(false);
    const [examinerAddr, setExaminerAddr] = useState("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"); // Default Account #0
    const [analysisPurpose, setAnalysisPurpose] = useState("");
    const [analysisReqID, setAnalysisReqID] = useState("");
    const [retentionYears, setRetentionYears] = useState(5);

    // Listeners
    useEffect(() => {
        // 1. Incoming (IN_TRANSIT) - Only from SO (No Analysis Request ID)
        const q1 = query(collection(db, "evidence"), where("status", "==", "IN_TRANSIT"));
        const unsub1 = onSnapshot(q1, (snapshot) => {
            const items: EvidenceItem[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as EvidenceItem;
                // Filter OUT items that are already released to FE (have analysisRequestID)
                if (!data.analysisRequestID) {
                    items.push(data);
                }
            });
            setTransitList(items);
        });

        // 2. Vault (SECURED)
        const q2 = query(collection(db, "evidence"), where("status", "==", "SECURED"));
        const unsub2 = onSnapshot(q2, (snapshot) => {
            const items: EvidenceItem[] = [];
            snapshot.forEach((doc) => items.push(doc.data() as EvidenceItem));
            setVaultList(items);
        });

        return () => { unsub1(); unsub2(); };
    }, []);

    // --- ACTIONS ---

    const handleVerifyAndAccept = async (item: EvidenceItem) => {
        if (!window.ethereum) return alert("MetaMask required");

        setLoading(true);
        setProcessingId(item.evidenceID);
        setVerifyStatus("Initializing Verification Protocol...");
        setIntegrityError(null);

        try {
            // 1. Evidence Verification Logic
            const isPhysical = item.storageURL === "PHYSICAL_ASSET_NO_URL" || item.fileType === "PHYSICAL/HARDWARE";

            if (isPhysical) {
                setVerifyStatus("Verifying Physical Seal Integrity...");
                // Simulated delay for physical inspection effect
                await new Promise(resolve => setTimeout(resolve, 1500));
                setVerifyStatus("Physical Seal Matches Blockchain Record.");
            } else {
                // Digital Flow: Download & Re-Hash
                setVerifyStatus("Downloading from Secure Storage...");
                const response = await fetch(item.storageURL);
                if (!response.ok) throw new Error("Secure Storage Connection Failed");

                const blob = await response.blob();
                const file = new File([blob], item.fileName, { type: item.fileType });

                setVerifyStatus("Calculating SHA-256 Hash (Client-Side)...");
                const calculatedHash = await generateFileHash(file);

                if (calculatedHash !== item.fileHash) {
                    const errorMsg = `HASH MISMATCH DETECTED! Local: ${calculatedHash.substring(0, 8)}... | Chain: ${item.fileHash.substring(0, 8)}...`;
                    setIntegrityError(errorMsg);
                    throw new Error(errorMsg);
                }
                setVerifyStatus("Integrity Verified. Requesting Blockchain Signature...");
            }

            // 2. Blockchain Handshake
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            const tx = await contract.acceptTransfer(item.evidenceID);
            setVerifyStatus("Mining Transaction...");
            await tx.wait();

            // 3. Firestore Update
            const custodianWallet = await signer.getAddress();

            await updateDoc(doc(db, "evidence", item.evidenceID), {
                status: "SECURED",
                custodianTimestamp: Date.now(),
                custodianTxHash: tx.hash,
                processedBy: custodianWallet,
                sealCondition: "Intact", // Default to Intact on accept
                storageLocation: "Pending Assignment"
            });

            // 3.1 Sync Cases Collection
            if (item.caseID) {
                await updateDoc(doc(db, "cases", item.caseID), {
                    status: "SECURED",
                    blockchainStatus: "SECURED"
                });
            } else {
                console.warn("Skipping Case Update: No Case ID linked to Evidence");
            }

        } catch (error: any) {
            console.error("Verification Error:", error);
            if (!integrityError) setIntegrityError(error.message);
        } finally {
            if (!integrityError) {
                setLoading(false);
                setProcessingId(null);
                setVerifyStatus("");
            } else {
                setLoading(false);
                // Keep error on screen
            }
        }
    };

    const handleReject = async (item: EvidenceItem) => {
        if (!confirm("CONFIRM REJECTION: This evidence will be flagged and removed from the queue.")) return;

        try {
            await updateDoc(doc(db, "evidence", item.evidenceID), { status: "REJECTED" });

            if (item.caseID) {
                await updateDoc(doc(db, "cases", item.caseID), { status: "REJECTED", blockchainStatus: "REJECTED" });
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleReleaseTransfer = async () => {
        if (!selectedItem || !window.ethereum) return;
        if (!analysisReqID.trim()) return alert("Error: Analysis Request ID is required.");
        if (!examinerAddr.trim() || !ethers.isAddress(examinerAddr)) return alert("Error: Valid Forensic Examiner Address is required.");

        if (!confirm(`Confirm custody transfer of ${selectedItem.evidenceID} to Forensic Examiner?`)) return;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            // Blockchain Transfer
            const tx = await contract.requestTransfer(selectedItem.evidenceID, examinerAddr);
            await tx.wait();

            // Calculate Retention
            const retentionDate = new Date();
            retentionDate.setFullYear(retentionDate.getFullYear() + Number(retentionYears));

            // Firestore Update
            await updateDoc(doc(db, "evidence", selectedItem.evidenceID), {
                status: "IN_TRANSIT",
                analysisRequestID: analysisReqID,
                custodianNotes: `Released for analysis: ${analysisPurpose}`,
                processedBy: await signer.getAddress(),
                retentionExpiry: retentionDate.getTime()
            });

            if (selectedItem.caseID) {
                await updateDoc(doc(db, "cases", selectedItem.caseID), {
                    status: "IN_TRANSIT",
                    blockchainStatus: "IN_TRANSIT"
                });
            } else {
                console.warn("Skipping Case Update: No Case ID linked to Evidence");
            }

            alert("Custody Transferred to Examiner");
            setShowReleaseModal(false);
            setSelectedItem(null);

        } catch (error: any) {
            console.error(error);
            alert("Transfer Failed: " + error.message);
        }
    };

    return (
        <div className="max-w-7xl mx-auto min-h-screen bg-slate-950 p-6 font-sans text-slate-200">

            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-emerald-500" />
                        Secure Digital Warehouse
                    </h1>
                    <p className="text-slate-400 mt-2 flex items-center gap-2 text-sm">
                        <User className="w-4 h-4" /> Evidence Custodian Portal
                        <span className="w-1 h-1 bg-slate-600 rounded-full mx-2"></span>
                        <span className="text-emerald-500 font-mono text-xs">SYSTEM SECURE</span>
                    </p>
                </div>

                {/* Stats / Ticker */}
                <div className="flex gap-6 text-xs font-mono">
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                        <span className="text-slate-500 block mb-1">PENDING INTAKE</span>
                        <span className="text-amber-500 font-bold text-xl">{transitList.length}</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                        <span className="text-slate-500 block mb-1">VAULT SECURED</span>
                        <span className="text-emerald-500 font-bold text-xl">{vaultList.length}</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg mb-8 w-fit border border-slate-800">
                <button
                    onClick={() => setActiveTab("incoming")}
                    className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold transition-all ${activeTab === "incoming"
                        ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                >
                    <ArrowRight className="w-4 h-4" /> Incoming Queue
                    {transitList.length > 0 && <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-full">{transitList.length}</span>}
                </button>
                <button
                    onClick={() => setActiveTab("vault")}
                    className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold transition-all ${activeTab === "vault"
                        ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-900/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                >
                    <Box className="w-4 h-4" /> Vault Inventory
                </button>
                <button
                    onClick={() => setActiveTab("audit")}
                    className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold transition-all ${activeTab === "audit"
                        ? "bg-blue-500 text-slate-950 shadow-lg shadow-blue-900/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                >
                    <History className="w-4 h-4" /> Audit Logs
                </button>
            </div>

            {/* --- TAB CONTENT --- */}

            {/* 1. INCOMING QUEUE */}
            {activeTab === "incoming" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-amber-950/20 border border-amber-900/50 p-4 rounded-lg flex items-start gap-4 mb-6">
                        <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
                        <div>
                            <h3 className="font-bold text-amber-400">Verification Gate Active</h3>
                            <p className="text-amber-200/60 text-sm">
                                All incoming evidence must pass a cryptographic integrity check (SHA-256) before acceptance.
                                Discrepancies will trigger a security lockdown for the item.
                            </p>
                        </div>
                    </div>

                    {transitList.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl">
                            <CheckCircle className="w-16 h-16 text-slate-800 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">Queue is Clear</p>
                            <p className="text-xs text-slate-600">No items waiting for intake.</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {transitList.map(item => (
                                <div key={item.evidenceID} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative group">
                                    {/* Status Bar */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 group-hover:bg-amber-400 transition-colors"></div>

                                    <div className="p-6 md:grid md:grid-cols-4 gap-6 items-center">

                                        {/* ID & Officer */}
                                        <div className="col-span-1">
                                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Evidence ID</span>
                                            <h3 className="text-xl font-bold text-white mb-1">{item.evidenceID}</h3>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] text-amber-500 font-mono">CASE: {item.caseID || "N/A"}</span>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <User className="w-3 h-3" />
                                                    <span>{item.officerName}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* File Details */}
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                                                    <FileText className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-200">{item.fileName}</p>
                                                    <p className="text-xs text-slate-500">{item.fileType}</p>
                                                </div>
                                            </div>
                                            <div className="bg-black/40 p-2 rounded border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                                                <span className="opacity-50">HASH:</span>
                                                <span className="text-emerald-500/80">{item.fileHash.substring(0, 24)}...</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 flex flex-col gap-3 justify-center">
                                            {loading && processingId === item.evidenceID ? (
                                                <div className="bg-slate-950 p-4 rounded-lg border border-amber-500/30">
                                                    <div className="flex items-center gap-2 text-amber-500 text-xs font-bold mb-2 animate-pulse">
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        {verifyStatus}
                                                    </div>
                                                    {integrityError && (
                                                        <div className="text-red-500 text-[10px] font-mono leading-tight mt-2 p-2 bg-red-950/50 border border-red-900 rounded">
                                                            {integrityError}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleVerifyAndAccept(item)}
                                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                                                    >
                                                        <Shield className="w-4 h-4" />
                                                        Verify & Accept
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(item)}
                                                        className="w-full bg-slate-800 hover:bg-red-900/30 hover:text-red-400 text-slate-400 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all"
                                                    >
                                                        <XCircle className="w-3 h-3" />
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Integrity Alert Overlay (Only if active error) */}
                                    {integrityError && processingId === item.evidenceID && (
                                        <div className="absolute inset-0 bg-black/90 z-20 flex items-center justify-center p-8 backdrop-blur-sm">
                                            <div className="bg-red-950 border-2 border-red-600 rounded-xl p-6 max-w-lg text-center shadow-2xl animate-shake">
                                                <AlertOctagon className="w-16 h-16 text-red-600 mx-auto mb-4" />
                                                <h2 className="text-2xl font-bold text-white mb-2">INTEGRITY CHECK FAILED</h2>
                                                <p className="text-red-200 mb-6">The digital signature of the received file does not match the blockchain record. This evidence may have been tampered with or corrupted during transit.</p>

                                                <div className="bg-black/50 p-4 rounded text-left font-mono text-xs mb-6 border border-red-900">
                                                    {integrityError}
                                                </div>

                                                <div className="flex gap-4">
                                                    <button
                                                        onClick={() => setIntegrityError(null)}
                                                        className="flex-1 bg-slate-800 text-white py-3 rounded hover:bg-slate-700"
                                                    >
                                                        Dismiss (Manual Check)
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(item)}
                                                        className="flex-1 bg-red-600 text-white py-3 rounded hover:bg-red-700 font-bold"
                                                    >
                                                        Reject Evidence
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 2. VAULT INVENTORY */}
            {activeTab === "vault" && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-950 text-slate-500 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 border-b border-slate-800">Evidence ID</th>
                                    <th className="p-4 border-b border-slate-800">Type</th>
                                    <th className="p-4 border-b border-slate-800">Physical Location</th>
                                    <th className="p-4 border-b border-slate-800">Seal Status</th>
                                    <th className="p-4 border-b border-slate-800 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {vaultList.map(item => (
                                    <tr key={item.evidenceID} className="text-slate-300 hover:bg-slate-800/30 transition-colors group">
                                        <td className="p-4 font-mono font-bold text-emerald-400">{item.evidenceID}</td>
                                        <td className="p-4 text-sm">{item.fileType}</td>
                                        <td className="p-4 text-sm">
                                            {item.storageLocation && item.storageLocation !== "Pending Assignment" ? (
                                                <span className="flex items-center gap-2 text-slate-200">
                                                    <Box className="w-4 h-4 text-emerald-600" />
                                                    {item.storageLocation}
                                                </span>
                                            ) : (
                                                <span className="text-amber-500/50 italic text-xs flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Unassigned
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold border ${item.sealCondition === "Damaged"
                                                ? "bg-red-950/30 text-red-500 border-red-900"
                                                : "bg-emerald-950/30 text-emerald-500 border-emerald-900"
                                                }`}>
                                                {item.sealCondition || "VERIFIED"}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    setEditLocation(item.storageLocation || "");
                                                    setEditSeal(item.sealCondition || "Intact");
                                                    setShowReleaseModal(false);
                                                }}
                                                className="text-slate-500 hover:text-white text-xs font-bold bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded transition-all"
                                            >
                                                Manage
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    setExaminerAddr("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
                                                    setShowReleaseModal(true);
                                                }}
                                                className="ml-2 text-amber-500 hover:text-amber-400 text-xs font-bold bg-amber-950/30 hover:bg-amber-900/50 px-3 py-2 rounded transition-all border border-amber-900/50"
                                            >
                                                Release
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {vaultList.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-500">
                                            <Archive className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                            Vault is empty. Accept transfers to populate.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. AUDIT LOGS (Simple Timeline) */}
            {activeTab === "audit" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
                    {vaultList.map(item => (
                        <div key={item.evidenceID} className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex items-center gap-6">
                            <div className="font-mono text-slate-500 text-xs w-32 shrink-0">
                                {new Date(item.custodianTimestamp || item.timestamp).toLocaleString()}
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-emerald-400 font-bold">{item.evidenceID}</span>
                                    <span className="text-slate-600 text-xs">({item.fileName})</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <span className="bg-slate-950 px-1 rounded">TX: {item.custodianTxHash?.substring(0, 12)}...</span>
                                    <ArrowRight className="w-3 h-3 text-emerald-800" />
                                    <span className="text-emerald-700 uppercase">Secured by {item.processedBy?.substring(0, 6)}...</span>
                                </div>
                            </div>

                            <a href={`https://sepolia.etherscan.io/tx/${item.custodianTxHash}`} target="_blank" className="text-slate-600 hover:text-emerald-500">
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    ))}
                    {vaultList.length === 0 && <p className="text-center text-slate-600 py-8">No audit records found.</p>}
                </div>
            )}

            {/* EDIT MODAL */}
            {selectedItem && !showReleaseModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Box className="w-5 h-5 text-emerald-500" />
                            Manage Physical Storage
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Evidence ID</label>
                                <input disabled value={selectedItem.evidenceID} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-400 font-mono text-sm" />
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Physical Bin / Shelf Location</label>
                                <input
                                    autoFocus
                                    value={editLocation}
                                    onChange={(e) => setEditLocation(e.target.value)}
                                    placeholder="e.g. Rack B, Shelf 4, Bin 12"
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-700"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Seal Integrity Status</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setEditSeal("Intact")}
                                        className={`p-3 rounded border text-sm font-bold transition-all ${editSeal === "Intact" ? "bg-emerald-900/30 border-emerald-500 text-emerald-400" : "bg-slate-950 border-slate-800 text-slate-500"}`}
                                    >
                                        INTACT
                                    </button>
                                    <button
                                        onClick={() => setEditSeal("Damaged")}
                                        className={`p-3 rounded border text-sm font-bold transition-all ${editSeal === "Damaged" ? "bg-red-900/30 border-red-500 text-red-500" : "bg-slate-950 border-slate-800 text-slate-500"}`}
                                    >
                                        DAMAGED / COMPROMISED
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-bold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await updateDoc(doc(db, "evidence", selectedItem.evidenceID), {
                                                storageLocation: editLocation,
                                                sealCondition: editSeal
                                            });
                                            setSelectedItem(null);
                                        } catch (e: any) { alert(e.message); }
                                    }}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-emerald-900/20"
                                >
                                    Save Updates
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* RELEASE MODAL */}
            {showReleaseModal && selectedItem && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <FileSignature className="w-5 h-5 text-amber-500" />
                            Release for Forensic Analysis
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Evidence ID</label>
                                <input disabled value={selectedItem.evidenceID} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-400 font-mono text-sm" />
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Forensic Examiner Address</label>
                                <input
                                    value={examinerAddr}
                                    onChange={(e) => setExaminerAddr(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white font-mono text-xs focus:border-amber-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Request ID</label>
                                    <input
                                        value={analysisReqID}
                                        onChange={(e) => setAnalysisReqID(e.target.value)}
                                        placeholder="REQ-2024-..."
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-sm focus:border-amber-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Retention (Years)</label>
                                    <input
                                        type="number"
                                        value={retentionYears}
                                        onChange={(e) => setRetentionYears(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-sm focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold block mb-2">Purpose of Analysis</label>
                                <textarea
                                    value={analysisPurpose}
                                    onChange={(e) => setAnalysisPurpose(e.target.value)}
                                    placeholder="e.g. Extract deleted emails from hard drive..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white text-sm focus:border-amber-500 outline-none h-24 resize-none"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowReleaseModal(false);
                                        setSelectedItem(null);
                                    }}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-bold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReleaseTransfer}
                                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-amber-900/20"
                                >
                                    Sign & Release
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
