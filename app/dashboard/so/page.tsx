"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { generateFileHash } from "@/utils/forensics";
import { db } from "@/lib/firebase";
import { doc, setDoc, collection, query, where, onSnapshot, updateDoc } from "firebase/firestore";
import { ethers } from "ethers";
import { Shield, Upload, File as FileIcon, CheckCircle, AlertTriangle, Loader2, ArrowRight, List, HardDrive, MailWarning, Fingerprint, MapPin, Clock, Power, Wifi, Lock, Globe, Server, Activity, Smartphone } from "lucide-react";
import contractConfig from "@/app/contractConfig.json";

const CONTRACT_ABI = contractConfig.abi;
const CONTRACT_ADDRESS = contractConfig.address;

// Default Custodian Address for Demo
const DEFAULT_CUSTODIAN = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

interface EvidenceItem {
    evidenceID: string;
    caseID?: string;
    fileName: string;
    fileHash: string;
    status: string;
    timestamp: number;
    bagTag?: string;
    category?: string;
    storageURL?: string;
    fileType?: string;
    // New Forensic Fields
    location?: { lat: number, lng: number };
    make?: string;
    model?: string;
    serialNumber?: string;
    sealNumber?: string;
    phishingURL?: string;
    senderEmail?: string;
    writeBlockerSerial?: string;
}

export default function SeizureOfficerDashboard() {
    const { userData } = useAuth();

    // Core State
    const [assignedCases, setAssignedCases] = useState<any[]>([]);

    // Form State
    const [selectedCase, setSelectedCase] = useState("");
    const [evidenceID, setEvidenceID] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<"Physical" | "Phishing">("Physical");

    // Toggle for Evidence Type (Digital vs. Physical Asset)
    const [evidenceType, setEvidenceType] = useState<"DIGITAL" | "PHYSICAL">("PHYSICAL"); // Default to Physical per new requirements for Write-Blocker demo

    // Physical Details
    const [bagTag, setBagTag] = useState("");
    const [recoveryLocation, setRecoveryLocation] = useState("");
    const [condition, setCondition] = useState("Intact");

    // Digital Device Context (If seizing a phone/laptop)
    const [deviceState, setDeviceState] = useState("Powered Off");
    const [connectionState, setConnectionState] = useState("Disconnected");
    const [make, setMake] = useState("");
    const [model, setModel] = useState("");
    const [serialNumber, setSerialNumber] = useState("");
    const [sealNumber, setSealNumber] = useState("");

    // Forensic Integrity Gate Inputs (For Physical)
    const [writeBlockerSerial, setWriteBlockerSerial] = useState("WB-2026-XQ");
    const [physicalHash, setPhysicalHash] = useState(""); // Manual Hash Entry

    // Phishing Context
    const [phishingURL, setPhishingURL] = useState("");
    const [senderEmail, setSenderEmail] = useState("");
    const [subjectLine, setSubjectLine] = useState("");
    const [emailHeaders, setEmailHeaders] = useState("");
    const [victimPlatform, setVictimPlatform] = useState("Email");
    const [victimID, setVictimID] = useState("");

    // File & Processing (Digital Mode)
    const [file, setFile] = useState<File | null>(null);
    const [fileHash, setFileHash] = useState("");
    const [hashingStatus, setHashingStatus] = useState<"IDLE" | "HASHING" | "UPLOADING" | "NOTARIZING" | "SUCCESS">("IDLE");
    const [successTx, setSuccessTx] = useState("");

    // Data List
    const [mySeizures, setMySeizures] = useState<EvidenceItem[]>([]);
    const [custodianAddr, setCustodianAddr] = useState(DEFAULT_CUSTODIAN);

    // Auth & Permissions
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    // Fetch Assigned Cases
    useEffect(() => {
        if (!userData?.walletAddress) return;
        const q = query(
            collection(db, "cases"),
            where("status", "in", ["OPEN", "COLLECTED", "IN_TRANSIT"])
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAssignedCases(cases);
        });
        return () => unsubscribe();
    }, [userData]);

    // Smart Context: Geolocation & Time
    const [locationCoords, setLocationCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [captureTime, setCaptureTime] = useState(new Date().toISOString());

    useEffect(() => {
        const timer = setInterval(() => setCaptureTime(new Date().toISOString()), 1000);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                setLocationCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            }, (error) => console.warn("Geolocation access denied:", error));
        }
        return () => clearInterval(timer);
    }, []);

    // Auto-generate Evidence ID
    useEffect(() => {
        if (selectedCase) {
            const random = Math.floor(1000 + Math.random() * 9000);
            setEvidenceID(`EVID-${new Date().getFullYear()}-${random}`);
        } else {
            setEvidenceID("");
        }
    }, [selectedCase]);

    // Authorization Check
    useEffect(() => {
        const checkRole = async () => {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();
                    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                    try {
                        const SO_ROLE = await contract.SO_ROLE();
                        const hasRole = await contract.hasRole(SO_ROLE, signer.address);
                        setIsAuthorized(hasRole);
                        if (!hasRole) console.warn(`Address ${signer.address} lacks SO_ROLE`);
                    } catch (roleError) {
                        console.error("Failed to check role:", roleError);
                    }
                    if (userData?.uid && userData.walletAddress !== signer.address) {
                        await updateDoc(doc(db, "users", userData.uid), { walletAddress: signer.address });
                    }
                } catch (e) {
                    console.error("Error checking role:", e);
                }
            }
        };
        checkRole();
    }, [userData]);

    // Listen for User Seizures
    useEffect(() => {
        if (!userData?.uid) return;
        const q = query(collection(db, "evidence"), where("officerID", "==", userData.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: EvidenceItem[] = [];
            snapshot.forEach(doc => items.push(doc.data() as EvidenceItem));
            items.sort((a, b) => b.timestamp - a.timestamp);
            setMySeizures(items);
        });
        return () => unsubscribe();
    }, [userData]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setHashingStatus("HASHING");
            try {
                const hash = await generateFileHash(selectedFile);
                setFileHash(hash);
                setHashingStatus("IDLE");
            } catch (err) {
                console.error(err);
                setHashingStatus("IDLE");
            }
        }
    };

    const processEvidence = async (e: React.FormEvent) => {
        e.preventDefault();

        if (category === "Physical" && evidenceType === "PHYSICAL") {
            // Validate Write-Blocker Hash
            if (!physicalHash || physicalHash.length !== 64) {
                alert("Invalid Hash: Please enter a valid 64-character SHA-256 hex string from the write-blocker.");
                return;
            }
        }

        if (!selectedCase) return;

        if (isAuthorized === false) {
            alert("Unauthorized: Your connected wallet does not have the Seizure Officer role.");
            return;
        }

        setHashingStatus("UPLOADING"); // Generic 'Processing' state

        try {
            let downloadURL = "N/A";
            let finalHash = "";

            if (category === "Physical" && evidenceType === "PHYSICAL") {
                // Physical Flow
                finalHash = physicalHash.startsWith("0x") ? physicalHash : `0x${physicalHash}`;
                // No file upload, maybe upload a generated PDF manifest later if needed.
                downloadURL = "PHYSICAL_ASSET_NO_URL";
            } else if (file) {
                // Digital Flow
                const { uploadToCloudinary } = await import("@/utils/cloudinary");
                downloadURL = await uploadToCloudinary(file);
                finalHash = fileHash;
            } else {
                // Phishing Flow (No File)
                // Generate a dummy hash for the URL/Content if needed or use placeholder
                // For now, let's assume phishing might have a screenshot? If not, we need a hash.
                // Fallback for demo:
                finalHash = ethers.keccak256(ethers.toUtf8Bytes(phishingURL || "PHISHING_REPORT"));
                downloadURL = phishingURL || "URL_ONLY";
            }

            setHashingStatus("NOTARIZING");

            if (!window.ethereum) throw new Error("MetaMask is not installed.");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            const tx = await contract.addEvidence(evidenceID, finalHash, downloadURL, file?.type || "PHYSICAL/HARDWARE");
            await tx.wait();

            // Firestore Payload
            const evidenceData: any = {
                evidenceID,
                caseID: selectedCase,
                description,
                category,
                evidenceType,
                timestamp: Date.now(),
                captureTimeISO: captureTime,
                location: locationCoords,
                officerID: userData?.uid || "UNKNOWN",
                officerName: userData?.name || "Unknown Officer",
                fileHash: finalHash,
                fileName: file?.name || (evidenceType === "PHYSICAL" ? `${make} ${model}` : "Phishing Report"),
                fileType: file?.type || "PHYSICAL",
                storageURL: downloadURL,
                status: "COLLECTED",
                txHash: tx.hash
            };

            if (category === "Physical") {
                evidenceData.bagTag = bagTag;
                evidenceData.sealNumber = sealNumber;
                evidenceData.recoveryLocation = recoveryLocation;
                evidenceData.condition = condition;
                evidenceData.make = make;
                evidenceData.model = model;
                evidenceData.serialNumber = serialNumber;
                evidenceData.deviceState = deviceState;
                evidenceData.connectionState = connectionState;
                if (evidenceType === "PHYSICAL") {
                    evidenceData.writeBlockerSerial = writeBlockerSerial;
                    evidenceData.physicalHash = physicalHash;
                }
            } else {
                evidenceData.phishingURL = phishingURL;
                evidenceData.senderEmail = senderEmail;
                evidenceData.subjectLine = subjectLine;
                evidenceData.emailHeaders = emailHeaders;
                evidenceData.victimPlatform = victimPlatform;
                evidenceData.victimID = victimID;
            }

            await setDoc(doc(db, "evidence", evidenceID), evidenceData);
            await updateDoc(doc(db, "cases", selectedCase), {
                status: "COLLECTED",
                blockchainStatus: "COLLECTED",
                evidenceRef: evidenceID,
                lastUpdated: Date.now()
            });

            setSuccessTx(tx.hash);
            setHashingStatus("SUCCESS");

        } catch (error: any) {
            console.error("Process Evidence Error:", error);
            alert(`Error: ${error.message}`);
            setHashingStatus("IDLE");
        }
    };

    // Helper for Manual Transfer (Legacy but useful)
    const handleRequestTransfer = async (evidenceID: string, caseID?: string) => {
        if (!window.ethereum) return;
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const tx = await contract.requestTransfer(evidenceID, custodianAddr);
            await tx.wait();
            await setDoc(doc(db, "evidence", evidenceID), { status: "IN_TRANSIT" }, { merge: true });
            if (caseID) await updateDoc(doc(db, "cases", caseID), { status: "IN_TRANSIT", blockchainStatus: "IN_TRANSIT" });
            alert("Transfer Request Sent!");
            window.location.reload();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ingestion Tool */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="bg-slate-900/80 p-6 border-b border-slate-800 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                                <Shield className="w-6 h-6 text-emerald-500" />
                                Forensic Ingestion
                            </h2>
                            <div className="flex gap-4 mt-2 text-[10px] text-slate-500 font-mono">
                                <span>{locationCoords ? `${locationCoords.lat.toFixed(4)}, ${locationCoords.lng.toFixed(4)}` : "Locating..."}</span>
                            </div>
                        </div>
                        {isAuthorized === false && <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />}
                    </div>

                    <form onSubmit={processEvidence} className="p-6 space-y-8">

                        {/* 1. Category Selector */}
                        <div className="grid grid-cols-2 gap-4">
                            <button type="button" onClick={() => setCategory("Physical")} className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${category === "Physical" ? "bg-slate-800 border-emerald-500 text-emerald-400" : "bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800/50"}`}>
                                <HardDrive className="w-8 h-8 mb-2" />
                                <span className="text-xs font-bold uppercase tracking-widest">Physical Asset</span>
                            </button>
                            <button type="button" onClick={() => setCategory("Phishing")} className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${category === "Phishing" ? "bg-slate-800 border-blue-500 text-blue-400" : "bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800/50"}`}>
                                <MailWarning className="w-8 h-8 mb-2" />
                                <span className="text-xs font-bold uppercase tracking-widest">Phishing / Threat</span>
                            </button>
                        </div>

                        {/* 2. Common Context */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">01. Context</h3>
                            <select value={selectedCase} onChange={(e) => setSelectedCase(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-emerald-500 outline-none" required>
                                <option value="">-- Select Active Case --</option>
                                {assignedCases.map(c => <option key={c.id} value={c.id}>{c.caseID} - {c.incidentType}</option>)}
                            </select>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" value={evidenceID} readOnly className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-slate-500 font-mono" />
                                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Item Description" className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-emerald-500 outline-none" required />
                            </div>
                        </div>

                        {/* 3. Conditional Content */}
                        {category === "Physical" && (
                            <div className="space-y-6 animate-in fade-in">
                                {/* Forensic Integrity Gate UI */}
                                <div className="bg-slate-900/50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
                                    <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Activity className="w-4 h-4 animate-pulse" /> Forensic Integrity Gate
                                    </h3>

                                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 mb-4">
                                        <button type="button" onClick={() => setEvidenceType("PHYSICAL")} className={`flex-1 py-2 text-[10px] font-bold rounded uppercase ${evidenceType === "PHYSICAL" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500"}`}>
                                            Hardware Write-Blocker
                                        </button>
                                        <button type="button" onClick={() => setEvidenceType("DIGITAL")} className={`flex-1 py-2 text-[10px] font-bold rounded uppercase ${evidenceType === "DIGITAL" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500"}`}>
                                            Digital File Upload
                                        </button>
                                    </div>

                                    {evidenceType === "PHYSICAL" ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-[10px] mobile-font text-emerald-500 font-mono bg-emerald-950/20 px-3 py-2 rounded border border-emerald-500/20">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                                                WRITE-BLOCKER CONNECTED: MODE READ-ONLY
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] uppercase text-slate-500 font-bold">WB Serial Number</label>
                                                    <input value={writeBlockerSerial} onChange={e => setWriteBlockerSerial(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 text-xs font-mono" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase text-slate-500 font-bold">Physical Media Hash (SHA-256)</label>
                                                    <input
                                                        value={physicalHash}
                                                        onChange={e => setPhysicalHash(e.target.value)}
                                                        placeholder="Enter 64-char Hex String"
                                                        className={`w-full bg-slate-950 border rounded p-2 text-slate-300 text-xs font-mono ${physicalHash.length === 64 ? "border-emerald-500 focus:ring-1 focus:ring-emerald-500" : "border-red-900 focus:border-red-500"}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative group">
                                            <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                            <div className={`border-2 border-dashed rounded-lg p-4 text-center ${file ? "border-emerald-500 bg-emerald-900/10" : "border-slate-700"}`}>
                                                {file ? <p className="text-emerald-400 font-bold text-xs">{file.name} (Ready)</p> : <p className="text-slate-500 font-bold text-xs">Drag & Drop Image/Disk Image</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Hardware Details (Common) */}
                                <div className="grid grid-cols-3 gap-3">
                                    <input placeholder="Make" value={make} onChange={e => setMake(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 text-sm focus:border-emerald-500 outline-none" />
                                    <input placeholder="Model" value={model} onChange={e => setModel(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 text-sm focus:border-emerald-500 outline-none" />
                                    <input placeholder="Serial No." value={serialNumber} onChange={e => setSerialNumber(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 text-sm focus:border-emerald-500 outline-none" />
                                </div>
                            </div>
                        )}

                        {category === "Phishing" && (
                            <div className="space-y-3">
                                <input type="url" placeholder="Malicious URL" value={phishingURL} onChange={e => setPhishingURL(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-blue-300 focus:border-blue-500 outline-none font-mono text-sm" />
                            </div>
                        )}

                        {/* 4. Action */}
                        <div className="pt-4 border-t border-slate-800">
                            {hashingStatus === "SUCCESS" ? (
                                <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg p-4 text-center">
                                    <p className="text-emerald-400 font-bold flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Secured on Blockchain</p>
                                    <button type="button" onClick={() => { setFile(null); setFileHash(""); setHashingStatus("IDLE"); setEvidenceID(""); setSelectedCase(""); }} className="mt-2 text-xs text-slate-400">Next Item</button>
                                </div>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={
                                        !selectedCase || // Needs Case
                                        (category === "Physical" && evidenceType === "PHYSICAL" && physicalHash.length !== 64) || // Needs valid hash if physical
                                        (category === "Physical" && evidenceType === "DIGITAL" && !file) || // Needs file if digital
                                        hashingStatus !== "IDLE"
                                    }
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {hashingStatus === "IDLE" ? "SEIZE & NOTARIZE" : <><Loader2 className="animate-spin w-4 h-4" /> PROCESSING...</>}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* List View (Condensed) */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col h-[600px]">
                    <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2"><List className="w-5 h-5 text-blue-500" /> Recent Seizures</h2>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                        {mySeizures.map(item => (
                            <div key={item.evidenceID} className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex gap-4 hover:border-slate-700 transition-all">
                                <div className="w-12 h-12 bg-slate-900 rounded flex items-center justify-center border border-slate-800 shrink-0">
                                    {item.fileType === "PHYSICAL" ? <HardDrive className="w-6 h-6 text-emerald-500" /> : <FileIcon className="w-6 h-6 text-blue-500" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between">
                                        <h4 className="font-bold text-slate-200 text-sm truncate">{item.evidenceID}</h4>
                                        <span className={`text-[10px] px-2 rounded border ${item.status === 'COLLECTED' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{item.status}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{item.fileName}</p>
                                    {item.status === 'COLLECTED' && (
                                        <button onClick={() => handleRequestTransfer(item.evidenceID, item.caseID)} disabled={false} className="mt-2 text-[10px] bg-blue-600/20 text-blue-400 border border-blue-600/50 px-3 py-1 rounded hover:bg-blue-600 hover:text-white transition-all w-full">
                                            TRANSFER
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

