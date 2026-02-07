"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc } from "firebase/firestore";
import { ethers } from "ethers";
import { generateFileHash } from "@/utils/forensics";
import {
    Shield, CheckCircle, Clock, FileCheck, Gavel,
    BarChart3, Activity, AlertOctagon, Scale,
    FileText, Download, Lock, Search, History,
    ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import contractConfig from "@/app/contractConfig.json";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Smart Contract Config
const CONTRACT_ABI = contractConfig.abi;
const CONTRACT_ADDRESS = contractConfig.address;

interface EvidenceItem {
    evidenceID: string;
    fileHash: string;
    fileName: string;
    fileType: string;
    storageURL: string;
    officerName: string;
    timestamp: number;
    status: string;
    category?: string;
    description?: string;
    caseID?: string;
    finalized?: boolean;
    expertOpinion?: string;
}

interface BlockchainEvent {
    id: string;
    action: string;
    actor: string;
    timestamp: number;
    blockNumber: number;
    verified?: boolean;
    details?: string;
}

import { useContract } from "@/hooks/useContract";

// ... imports remain the same

export default function HODDashboard() {
    const { userData } = useAuth();
    const { contract, isReadOnly } = useContract(); // Use the hook

    // Data
    const [allEvidence, setAllEvidence] = useState<EvidenceItem[]>([]);
    const [stats, setStats] = useState({
        total: 0,
        pendingForensics: 0,
        readyForAudit: 0,
        finalized: 0,
        verifiedIntegrity: 0
    });

    // UI State
    const [selectedCase, setSelectedCase] = useState<EvidenceItem | null>(null);
    const [timeline, setTimeline] = useState<BlockchainEvent[]>([]);
    const [loadingTimeline, setLoadingTimeline] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    // Fetch All Evidence
    useEffect(() => {
        const q = query(collection(db, "evidence"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: EvidenceItem[] = [];
            snapshot.forEach(doc => items.push(doc.data() as EvidenceItem));
            setAllEvidence(items);

            // Compute Stats
            setStats({
                total: items.length,
                pendingForensics: items.filter(i => ["IN_TRANSIT", "SECURED"].includes(i.status)).length,
                readyForAudit: items.filter(i => i.status === "ANALYZED").length,
                finalized: items.filter(i => i.status === "FINALIZED").length,
                verifiedIntegrity: items.length // Mock for demo, ideally track verified count
            });
        });
        return () => unsubscribe();
    }, []);

    // Fetch Blockchain Timeline
    const fetchTimeline = async (evidenceID: string) => {
        if (!contract) return; // Wait for contract to init

        setLoadingTimeline(true);
        setTimeline([]);
        try {
            const fromBlock = (contractConfig as any).deploymentBlock || 0;

            // OPTIMIZATION: Fetch ALL events in one call to prevent RPC timeouts
            const allContractEvents = await contract.queryFilter("*", fromBlock);

            const filteredEvents = allContractEvents.filter((e: any) => {
                try {
                    return e.args && e.args[0] === evidenceID;
                } catch { return false; }
            });

            const processedEvents: BlockchainEvent[] = await Promise.all(filteredEvents.map(async (e: any) => {
                const block = await e.getBlock();
                const eventName = e.eventName || e.fragment?.name || "Unknown";

                let type = "UNKNOWN";
                let details = "Blockchain Event";
                let actor = "Contract";

                // Map Event Names to UI Types
                if (eventName === "EvidenceLogged") {
                    type = "SEIZED";
                    details = "Evidence Logged on Blockchain";
                    actor = e.args[2]; // officer
                } else if (eventName === "TransferAccepted") {
                    type = "CUSTODY_TRANSFER";
                    details = "Chain of Custody Update";
                    actor = e.args[2]; // to
                } else if (eventName === "StatusUpdated") {
                    type = "STATUS_UPDATE";
                    details = `Status Changed to ${e.args[1]}`; // This might be an enum/int in raw
                    actor = e.args[2]; // updatedBy
                } else if (eventName === "ReportAdded") {
                    type = "FORENSIC_ANALYSIS";
                    details = "Forensic Report Authenticated";
                    actor = e.args[2]; // examiner
                } else if (eventName === "CaseFinalized") {
                    type = "LEGAL_FINALIZATION";
                    details = "Case Finalized & Locked";
                    actor = e.args[1]; // hod
                }

                return {
                    id: e.transactionHash,
                    action: type,
                    actor: actor?.toString() || "Unknown",
                    timestamp: block.timestamp * 1000,
                    blockNumber: block.number,
                    details: details,
                    _eventName: eventName
                };
            }));

            // Sort by time
            processedEvents.sort((a, b) => a.timestamp - b.timestamp);
            setTimeline(processedEvents);

        } catch (e: any) {
            console.warn("Timeline Fetch Error:", e);
            if (e.code === "UNKNOWN_ERROR" || e.code === -32603) {
                // Squelch RPC errors in UI
            } else {
                alert("Failed to load timeline. See console for details.");
            }
        } finally {
            setLoadingTimeline(false);
        }
    };

    const generateCertificate = () => {
        if (!selectedCase) return;
        const doc = new jsPDF();

        // Header
        doc.setFillColor(30, 41, 59); // Slate 900
        doc.rect(0, 0, 210, 40, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("SECTION 65B CERTIFICATE", 105, 20, { align: "center" });
        doc.setFontSize(10);
        doc.text("Indian Evidence Act, 1872", 105, 28, { align: "center" });

        // Case Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Certificate Reference: CERT-${selectedCase.evidenceID}-${Date.now()}`, 15, 50);
        doc.text(`Date of Issue: ${new Date().toLocaleDateString()}`, 15, 58);

        // Table Data
        const tableData = [
            ["Evidence ID", selectedCase.evidenceID],
            ["File Name", selectedCase.fileName],
            ["File Type", selectedCase.fileType],
            ["Original Hash (SHA-256)", selectedCase.fileHash],
            ["Seizing Officer", selectedCase.officerName || "Unknown"],
            ["Seizure Timestamp", new Date(selectedCase.timestamp).toLocaleString()],
            ["Current Status", "FINALIZED (Legally Locked)"]
        ];

        autoTable(doc, {
            startY: 65,
            head: [['Field', 'Value']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] } // Indigo 600
        });

        // Loophole-Free Declaration
        const yPos = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.text("System Integrity Declaration", 15, yPos);
        doc.setFontSize(10);
        const declaration = "I hereby certify that the computer output containing the digital evidence listed above was produced by the 'Digipol' Chain of Custody System, which was operating properly at all material times. The electronic record is a true and accurate reproduction of the original data, and no alteration or tampering has occurred since its initial seizure, as verified by the immutable Blockchain Audit Log attached herein.";
        const splitText = doc.splitTextToSize(declaration, 180);
        doc.text(splitText, 15, yPos + 8);

        // Signatures
        doc.text("__________________________", 15, yPos + 50);
        doc.text("Digital Signature (HOD)", 15, yPos + 55);
        doc.text(`Wallet: ${userData?.walletAddress || "N/A"}`, 15, yPos + 60);

        doc.save(`65B_Certificate_${selectedCase.evidenceID}.pdf`);
    };

    const finalizeCase = async () => {
        if (!selectedCase || !contract) return;

        if (isReadOnly) {
            alert("Wallet Not Connected. Please connect a HOD wallet to finalize.");
            return;
        }

        if (!confirm("WARNING: This Action is Irreversible.\n\nDo you want to legally finalize this case and lock it on the blockchain?")) return;

        setIsFinalizing(true);
        try {
            // 1. Blockchain Call (Uses Signer from Hook)
            const tx = await contract.finalizeCase(selectedCase.evidenceID);
            await tx.wait();

            // 2. Firestore Update
            await updateDoc(doc(db, "evidence", selectedCase.evidenceID), {
                status: "FINALIZED",
                finalized: true
            });

            // 2.1 Update Cases Collection
            if (selectedCase.caseID) {
                await updateDoc(doc(db, "cases", selectedCase.caseID), {
                    status: "CLOSED",
                    blockchainStatus: "FINALIZED" // Legal Lock
                });
            } else {
                console.warn("Skipping Case Update: No Case ID linked to Evidence");
            }

            // 3. Generate PDF
            generateCertificate();

            alert("Case Successfully Finalized. Certificate Downloaded.");
            setSelectedCase(null);

        } catch (e: any) {
            console.error(e);
            alert("Finalization Failed: " + e.message);
        } finally {
            setIsFinalizing(false);
        }
    };


    return (
        <div className="h-screen bg-slate-950 text-slate-200 flex flex-col font-sans overflow-hidden">

            {/* 1. EXECUTIVE COMMAND BAR */}
            <div className="h-24 bg-slate-900 border-b border-slate-800 flex items-center px-8 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-900/30 rounded-lg border border-indigo-500/30">
                        <Scale className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Final Audit & Legal Certification</h1>
                        <p className="text-xs text-slate-500 font-mono">HEAD OF DEPARTMENT // COMMAND CENTER</p>
                    </div>
                </div>

                <div className="flex gap-8">
                    <MetricCard label="Total Cases" value={stats.total} icon={<FileText className="text-slate-400" />} />
                    <MetricCard label="Forensic Backlog" value={stats.pendingForensics} icon={<Activity className="text-amber-500" />} />
                    <MetricCard label="Ready for Audit" value={stats.readyForAudit} icon={<Gavel className="text-indigo-400" />} />
                    <MetricCard label="Legally Closed" value={stats.finalized} icon={<Shield className="text-emerald-500" />} />
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">

                {/* 2. OPERATIONAL HEATMAP & LIST (LEFT) */}
                <div className="w-96 bg-slate-925 border-r border-slate-800 flex flex-col">
                    {/* Heatmap Visualization Mockup */}
                    <div className="p-4 border-b border-slate-800">
                        <h3 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2"><BarChart3 className="w-3 h-3" /> CRIME DISTRIBUTION HEATMAP</h3>
                        <div className="h-32 flex gap-1">
                            <div className="h-full w-1/2 bg-indigo-900/40 rounded flex flex-col justify-end p-2 border border-indigo-500/20">
                                <span className="text-xs font-bold text-indigo-300">Cyber</span>
                                <span className="text-[10px] text-indigo-400/60">55%</span>
                            </div>
                            <div className="h-full w-1/4 bg-rose-900/40 rounded flex flex-col justify-end p-2 border border-rose-500/20">
                                <span className="text-xs font-bold text-rose-300">Phish</span>
                                <span className="text-[10px] text-rose-400/60">30%</span>
                            </div>
                            <div className="h-full w-1/4 bg-emerald-900/40 rounded flex flex-col justify-end p-2 border border-emerald-500/20">
                                <span className="text-xs font-bold text-emerald-300">Phys</span>
                                <span className="text-[10px] text-emerald-400/60">15%</span>
                            </div>
                        </div>
                    </div>

                    {/* Pending Audit List */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-2 bg-slate-900/50 sticky top-0 text-xs font-bold text-slate-500 border-b border-slate-800">
                            PENDING CERTIFICATION
                        </div>
                        {allEvidence.filter(e => e.status === "ANALYZED").length === 0 ? (
                            <div className="p-8 text-center text-slate-600 text-xs">No cases ready for final audit.</div>
                        ) : (
                            allEvidence.filter(e => e.status === "ANALYZED").map(item => (
                                <div
                                    key={item.evidenceID}
                                    onClick={() => { setSelectedCase(item); fetchTimeline(item.evidenceID); }}
                                    className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors ${selectedCase?.evidenceID === item.evidenceID ? "bg-indigo-900/20 border-l-2 border-l-indigo-500" : ""}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-mono text-xs text-indigo-400 font-bold">{item.evidenceID}</span>
                                        <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1 rounded border border-indigo-900">READY</span>
                                    </div>
                                    <div className="text-sm font-bold text-slate-200 truncate">{item.fileName}</div>
                                    <div className="text-[10px] text-slate-500 mt-1">Examiner Opinion Available</div>
                                </div>
                            ))
                        )}

                        <div className="p-2 bg-slate-900/50 sticky top-0 text-xs font-bold text-slate-500 border-b border-t border-slate-800 mt-4">
                            RECENTLY SEIZED
                        </div>
                        {allEvidence.filter(e => e.status !== "ANALYZED" && e.status !== "FINALIZED").slice(0, 5).map(item => (
                            <div key={item.evidenceID} className="p-3 border-b border-slate-800 opacity-50 text-xs">
                                <div className="font-mono">{item.evidenceID}</div>
                                <div>{item.status}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. MASTER AUDIT TIMELINE (CENTER) */}
                <div className="flex-1 bg-slate-950 flex flex-col min-w-0 relative">
                    {!selectedCase ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-50">
                            <Scale className="w-24 h-24 mb-4" />
                            <h1 className="text-2xl font-bold">Select a Case for Legal Audit</h1>
                        </div>
                    ) : (
                        <>
                            {/* Case Header */}
                            <div className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        {selectedCase.fileName}
                                        {selectedCase.status === "FINALIZED" && <Shield className="w-4 h-4 text-indigo-500 fill-indigo-500/20" />}
                                    </h2>
                                    <p className="text-xs font-mono text-slate-500">Hash: {selectedCase.fileHash}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">Current Status</div>
                                    <div className={`text-sm font-bold ${selectedCase.status === "FINALIZED" ? "text-indigo-400" : "text-emerald-400"}`}>
                                        {selectedCase.status}
                                    </div>
                                </div>
                            </div>

                            {/* Timeline Content */}
                            <div className="flex-1 overflow-y-auto p-8">
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-6 flex items-center gap-2">
                                    <History className="w-4 h-4" /> Blockchain Chain of Custody
                                </h3>

                                <div className="space-y-0 relative">
                                    {/* Vertical Line */}
                                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800"></div>

                                    {timeline.map((event, idx) => (
                                        <div key={idx} className="relative pl-12 pb-8 group">
                                            {/* Dot */}
                                            <div className="absolute left-[13px] top-1 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-950 group-hover:bg-indigo-500 transition-colors z-10"></div>

                                            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-indigo-500/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                                                        {event.action}
                                                    </span>
                                                    <span className="text-xs font-mono text-slate-500">
                                                        {new Date(event.timestamp).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-300 font-bold mb-1">{event.details}</div>
                                                <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                                                    <span className="text-slate-600">Actor:</span>
                                                    <span className="text-blue-400/80">{event.actor.substring(0, 12)}...</span>
                                                    <CheckCircle className="w-3 h-3 text-emerald-500/50" />
                                                </div>
                                                <div className="mt-2 text-[10px] text-slate-600 font-mono truncate">
                                                    TX: {event.id}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {loadingTimeline && <div className="pl-12 text-slate-500 text-xs animate-pulse">Scanning Blockchain Blocks...</div>}
                                </div>
                            </div>

                            {/* 4. LEGAL CERTIFICATION ENGINE (BOTTOM) */}
                            <div className="h-24 bg-slate-900 border-t border-slate-800 p-4 flex items-center justify-between shadow-2xl z-20">
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Gavel className="w-4 h-4 text-indigo-500" /> Legal Action
                                    </h3>
                                    <p className="text-xs text-slate-500 max-w-md mt-1">
                                        By finalizing, you certify the integrity of this evidence under Section 65B. This action writes a permanent lock to the blockchain.
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    {selectedCase.status === "FINALIZED" ? (
                                        <button
                                            onClick={generateCertificate}
                                            className="px-6 py-3 bg-slate-800 text-white font-bold text-sm rounded flex items-center gap-2 hover:bg-slate-700 border border-slate-600"
                                        >
                                            <Download className="w-4 h-4" /> Download Certificate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={finalizeCase}
                                            disabled={isFinalizing}
                                            className="px-8 py-3 bg-indigo-600 text-white font-bold text-sm rounded shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isFinalizing ? "Signing..." : "FINALIZE & SIGN CASE"}
                                            {!isFinalizing && <Gavel className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon }: { label: string, value: number, icon: any }) {
    return (
        <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
            <div>
                <div className="text-xl font-bold text-white leading-none">{value}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">{label}</div>
            </div>
        </div>
    )
}
