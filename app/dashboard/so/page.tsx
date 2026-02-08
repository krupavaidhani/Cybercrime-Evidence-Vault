"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { generateFileHash } from "@/utils/forensics";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot, StorageError } from "firebase/storage";
import { doc, setDoc, collection, query, where, onSnapshot, updateDoc } from "firebase/firestore";
import { ethers } from "ethers";
import { Shield, Upload, File as FileIcon, CheckCircle, AlertTriangle, Loader2, ArrowRight, List, HardDrive, Smartphone, MailWarning, Fingerprint, MapPin, Clock, Wifi, Power, Lock, Globe, Server, AlertOctagon } from "lucide-react";
import contractConfig from "@/app/contractConfig.json";

const CONTRACT_ABI = contractConfig.abi;
const CONTRACT_ADDRESS = contractConfig.address;

// Default Custodian Address for Demo (Account #3 from Hardhat)
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
}

export default function SeizureOfficerDashboard() {
    const { userData } = useAuth();

    // Core State
    const [activeTab, setActiveTab] = useState<"ingest" | "list">("ingest");
    const [assignedCases, setAssignedCases] = useState<any[]>([]);

    // Form State
    const [selectedCase, setSelectedCase] = useState("");
    const [evidenceID, setEvidenceID] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<"Physical" | "Phishing">("Physical");

    // Physical Details
    const [bagTag, setBagTag] = useState("");
    const [recoveryLocation, setRecoveryLocation] = useState("");
    const [condition, setCondition] = useState("Intact");

    // Digital Details
    const [deviceState, setDeviceState] = useState("Powered Off");
    const [connectionState, setConnectionState] = useState("Disconnected");

    // File & Processing
    const [file, setFile] = useState<File | null>(null);
    const [fileHash, setFileHash] = useState("");
    const [hashingStatus, setHashingStatus] = useState<"IDLE" | "HASHING" | "UPLOADING" | "NOTARIZING" | "SUCCESS">("IDLE");
    const [successTx, setSuccessTx] = useState("");

    // Data List
    const [mySeizures, setMySeizures] = useState<EvidenceItem[]>([]);
    const [custodianAddr, setCustodianAddr] = useState(DEFAULT_CUSTODIAN);

    // Auth
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    // Legacy State for Transfer
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    // Fetch Assigned Cases
    // Fetch Assigned Cases
    useEffect(() => {
        if (!userData?.walletAddress) return;

        console.log("Fetching cases for SO:", userData.walletAddress);

        // Filter by Status AND Assigned Wallet
        // Filter by Status ONLY (removed assignedSO constraint to show ALL active cases)
        const q = query(
            collection(db, "cases"),
            where("status", "in", ["OPEN", "COLLECTED", "IN_TRANSIT"])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Cases Found:", cases.length);
            setAssignedCases(cases);
        }, (err) => {
            console.error("Error fetching cases:", err);
        });

        return () => unsubscribe();
    }, [userData]);

    // Smart Context: Geolocation & Time
    const [locationCoords, setLocationCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [captureTime, setCaptureTime] = useState(new Date().toISOString());

    useEffect(() => {
        // Update time every second for "Live" feel until capture
        const timer = setInterval(() => setCaptureTime(new Date().toISOString()), 1000);

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                setLocationCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            }, (error) => {
                console.warn("Geolocation access denied:", error);
            });
        }

        return () => clearInterval(timer);
    }, []);

    // Form State
    // const [selectedCase, setSelectedCase] = useState(""); // Already defined
    // const [evidenceID, setEvidenceID] = useState(""); // Already defined
    // const [description, setDescription] = useState(""); // Already defined
    // const [category, setCategory] = useState<"Physical" | "Phishing">("Physical"); // Already defined, just updated type

    // --- Physical Hardware Context ---
    const [make, setMake] = useState("");
    const [model, setModel] = useState("");
    const [serialNumber, setSerialNumber] = useState("");
    // const [bagTag, setBagTag] = useState(""); // Already defined
    const [sealNumber, setSealNumber] = useState("");
    // const [recoveryLocation, setRecoveryLocation] = useState(""); // Already defined
    // const [condition, setCondition] = useState("Intact"); // Already defined

    // Physical State Radios
    // const [deviceState, setDeviceState] = useState("Powered Off"); // Already defined
    // const [connectionState, setConnectionState] = useState("Disconnected"); // Already defined

    // --- Phishing / Virtual Context ---
    const [phishingURL, setPhishingURL] = useState("");
    const [senderEmail, setSenderEmail] = useState("");
    const [subjectLine, setSubjectLine] = useState("");
    const [emailHeaders, setEmailHeaders] = useState("");
    const [victimPlatform, setVictimPlatform] = useState("Email");
    const [victimID, setVictimID] = useState("");

    // File & Processing
    // const [file, setFile] = useState<File | null>(null); // Already defined
    // const [fileHash, setFileHash] = useState(""); // Already defined
    // const [hashingStatus, setHashingStatus] = useState<"IDLE" | "HASHING" | "UPLOADING" | "NOTARIZING" | "SUCCESS">("IDLE"); // Already defined
    // const [successTx, setSuccessTx] = useState(""); // Already defined

    // Auto-generate Evidence ID
    useEffect(() => {
        if (selectedCase) {
            const random = Math.floor(1000 + Math.random() * 9000);
            setEvidenceID(`EVID-${new Date().getFullYear()}-${random}`);
        } else {
            setEvidenceID("");
        }
    }, [selectedCase]);



    useEffect(() => {
        const checkRole = async () => {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();
                    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

                    // Check Role
                    // Use a static call to avoid gas estimation issues if something is wrong
                    try {
                        const SO_ROLE = await contract.SO_ROLE();
                        const hasRole = await contract.hasRole(SO_ROLE, signer.address);
                        setIsAuthorized(hasRole);

                        if (!hasRole) {
                            console.warn(`Address ${signer.address} lacks SO_ROLE`);
                        }
                    } catch (roleError) {
                        console.error("Failed to check role:", roleError);
                        // If contract interaction fails, it might be wrong network, but NetworkGuard handles that.
                        // We can just leave isAuthorized as null or false.
                    }

                    // Sync Wallet Address to Firestore if different
                    if (userData?.uid && userData.walletAddress !== signer.address) {
                        try {
                            await updateDoc(doc(db, "users", userData.uid), {
                                walletAddress: signer.address
                            });
                        } catch (err) {
                            console.error("Failed to sync wallet address:", err);
                        }
                    }

                } catch (e: any) {
                    console.error("Error checking role:", e);
                }
            }
        };

        checkRole();
    }, [userData]);


    useEffect(() => {
        if (!userData?.uid) return;

        // Listen for evidence created by this user
        const q = query(collection(db, "evidence"), where("officerID", "==", userData.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: EvidenceItem[] = [];
            snapshot.forEach(doc => items.push(doc.data() as EvidenceItem));
            // Sort by new
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

            // Immediate Client-Side Hash Display
            try {
                const hash = await generateFileHash(selectedFile);
                setFileHash(hash);
                setHashingStatus("IDLE"); // Ready to upload
            } catch (err) {
                console.error(err);
                setHashingStatus("IDLE");
            }
        }
    };

    const processEvidence = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !selectedCase) return;

        if (isAuthorized === false) {
            alert("Unauthorized: Your connected wallet does not have the Seizure Officer role.");
            return;
        }

        setHashingStatus("UPLOADING");

        try {
            // 1. Upload to Cloudinary
            // Dynamic import
            const { uploadToCloudinary } = await import("@/utils/cloudinary");
            const downloadURL = await uploadToCloudinary(file);

            // 2. Blockchain Transaction
            setHashingStatus("NOTARIZING");

            if (!window.ethereum) throw new Error("MetaMask is not installed.");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            const tx = await contract.addEvidence(evidenceID, fileHash, downloadURL, file.type || "UNKNOWN");
            await tx.wait();

            // 3. Save Metadata to Firestore
            // 3. Save Metadata to Firestore
            // Construct payload based on category
            const evidenceData: any = {
                evidenceID,
                caseID: selectedCase,
                description,
                category,
                // Common Context
                timestamp: Date.now(),
                captureTimeISO: captureTime,
                location: locationCoords, // { lat, lng }
                officerID: userData?.uid || "UNKNOWN",
                officerName: userData?.name || "Unknown Officer",

                // File Info
                fileHash,
                fileName: file.name,
                fileType: file.type,
                storageURL: downloadURL,

                // Status
                status: "COLLECTED",
                txHash: tx.hash
            };

            if (category === "Physical") {
                evidenceData.bagTag = bagTag;
                evidenceData.sealNumber = sealNumber;
                evidenceData.recoveryLocation = recoveryLocation;
                evidenceData.condition = condition;
                // Hardware Specs
                evidenceData.make = make;
                evidenceData.model = model;
                evidenceData.serialNumber = serialNumber;
                // States
                evidenceData.deviceState = deviceState;
                evidenceData.connectionState = connectionState;
            } else { // category === "Phishing"
                // Phishing/Virtual
                evidenceData.phishingURL = phishingURL;
                evidenceData.senderEmail = senderEmail;
                evidenceData.subjectLine = subjectLine;
                evidenceData.emailHeaders = emailHeaders;
                evidenceData.victimPlatform = victimPlatform;
                evidenceData.victimID = victimID;
            }

            await setDoc(doc(db, "evidence", evidenceID), evidenceData);

            // 4. Update Case Status
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

    const handleRequestTransfer = async (evidenceID: string, caseID?: string) => { // Updated to accept caseID
        if (!window.ethereum) return;
        setLoading(true);
        setStatus(`Initiating transfer for ${evidenceID}...`);

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            const tx = await contract.requestTransfer(evidenceID, custodianAddr);
            await tx.wait();

            // Update Firestore Evidence
            await setDoc(doc(db, "evidence", evidenceID), { status: "IN_TRANSIT" }, { merge: true });

            // Sync Cases - ONLY if caseID is provided
            if (caseID) {
                await updateDoc(doc(db, "cases", caseID), {
                    status: "IN_TRANSIT",
                    blockchainStatus: "IN_TRANSIT"
                });
            } else {
                console.warn("No caseID provided for transfer update.");
            }

            setStatus(`Transfer requested for ${evidenceID}. Custodian notified.`);
            alert("Transfer Request Sent to Blockchain!");
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            setStatus(`Transfer Error: ${error.message}`);
            alert(`Transfer Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ingestion Tool (Mobile First Stack) */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="bg-slate-900/80 p-6 border-b border-slate-800 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                                <Shield className="w-6 h-6 text-emerald-500" />
                                Cyber-Forensic Ingestion
                            </h2>
                            <div className="flex gap-4 mt-2 text-[10px] text-slate-500 font-mono">
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-emerald-500/50" />
                                    {locationCoords ? `${locationCoords.lat.toFixed(4)}, ${locationCoords.lng.toFixed(4)}` : "Locating..."}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-emerald-500/50" />
                                    {new Date(captureTime).toLocaleTimeString()}
                                </span>
                            </div>

                        </div>
                        {isAuthorized === false && (
                            <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
                        )}
                    </div>

                    <form onSubmit={processEvidence} className="p-6 space-y-8">

                        {/* 0. Mode Selector */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setCategory("Physical")}
                                className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${category === "Physical"
                                    ? "bg-slate-800 border-emerald-500 text-emerald-400"
                                    : "bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800/50"
                                    }`}
                            >
                                <HardDrive className="w-8 h-8 mb-2" />
                                <span className="text-xs font-bold uppercase tracking-widest">Physical Device</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategory("Phishing")}
                                className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${category === "Phishing"
                                    ? "bg-slate-800 border-blue-500 text-blue-400"
                                    : "bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800/50"
                                    }`}
                            >
                                <MailWarning className="w-8 h-8 mb-2" />
                                <span className="text-xs font-bold uppercase tracking-widest">Phishing / Virtual</span>
                            </button>
                        </div>

                        {/* 1. Source Identity */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Fingerprint className="w-4 h-4 text-emerald-500" />
                                01. Context & Identity
                            </h3>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Associated Case</label>
                                <select
                                    value={selectedCase}
                                    onChange={(e) => setSelectedCase(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-emerald-500 outline-none"
                                    required
                                >
                                    <option value="">-- Select Active Case --</option>
                                    {assignedCases.map(c => (
                                        <option key={c.id} value={c.id}>{c.caseID} - {c.incidentType}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Evidence ID</label>
                                    <input
                                        type="text"
                                        value={evidenceID}
                                        readOnly
                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-slate-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Item Description</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={category === "Physical" ? "e.g. iPhone 13 Pro" : "e.g. Suspicious Email PDF"}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-emerald-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. CONDITIONAL FORENSIC FORMS */}

                        {/* A. PHYSICAL DEVICE FORM */}
                        {category === "Physical" && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-4">

                                {/* Hardware Specs */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Smartphone className="w-4 h-4 text-emerald-500" />
                                        02. Hardware Specs
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        <input
                                            placeholder="Make (e.g. Dell)"
                                            value={make} onChange={e => setMake(e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 text-sm focus:border-emerald-500 outline-none"
                                        />
                                        <input
                                            placeholder="Model"
                                            value={model} onChange={e => setModel(e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 text-sm focus:border-emerald-500 outline-none"
                                        />
                                        <input
                                            placeholder="Serial No."
                                            value={serialNumber} onChange={e => setSerialNumber(e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 text-sm focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Operational State */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                            <Power className="w-3 h-3" /> Power State
                                        </label>
                                        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                            {["Powered On", "Sleep Mode", "Powered Off"].map(s => (
                                                <button
                                                    key={s} type="button" onClick={() => setDeviceState(s)}
                                                    className={`flex-1 py-2 text-[10px] font-bold rounded uppercase ${deviceState === s ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                                                >{s}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                            <Wifi className="w-3 h-3" /> Network State
                                        </label>
                                        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                            {["Connected", "Airplane", "Disconnected"].map(s => (
                                                <button
                                                    key={s} type="button" onClick={() => setConnectionState(s)}
                                                    className={`flex-1 py-2 text-[10px] font-bold rounded uppercase ${connectionState === s ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"}`}
                                                >{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Sealing */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                        <Lock className="w-3 h-3" /> Security Filters
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            placeholder="Evidence Bag ID"
                                            value={bagTag} onChange={e => setBagTag(e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-emerald-500 outline-none"
                                        />
                                        <input
                                            placeholder="Tamper Seal Number"
                                            value={sealNumber} onChange={e => setSealNumber(e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* B. PHISHING / VIRTUAL FORM */}
                        {category === "Phishing" && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-blue-500" />
                                    02. Threat Intelligence
                                </h3>

                                <div className="space-y-3">
                                    <input
                                        type="url" placeholder="Malicious URL / Link"
                                        value={phishingURL} onChange={e => setPhishingURL(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-blue-300 placeholder-blue-900/50 focus:border-blue-500 outline-none font-mono text-sm"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="email" placeholder="Sender Email Address"
                                            value={senderEmail} onChange={e => setSenderEmail(e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-blue-500 outline-none"
                                        />
                                        <input
                                            type="text" placeholder="Subject Line"
                                            value={subjectLine} onChange={e => setSubjectLine(e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                        <Server className="w-3 h-3" /> Technical Headers / Source
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder="Paste email headers (Received-SPF, DKIM) or Page Source here..."
                                        value={emailHeaders}
                                        onChange={e => setEmailHeaders(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-400 focus:border-blue-500 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        placeholder="Victim Platform (e.g. Gmail)"
                                        value={victimPlatform} onChange={e => setVictimPlatform(e.target.value)}
                                        className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-blue-500 outline-none"
                                    />
                                    <input
                                        placeholder="Victim ID / Phone"
                                        value={victimID} onChange={e => setVictimID(e.target.value)}
                                        className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-slate-200 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* 4. The Trust Workflow (Hashing) */}
                        <div className="pt-6 border-t border-slate-800 space-y-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider text-center">04. Trust & Security</h3>

                            {/* File Upload Button */}
                            <div className="relative group">
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    disabled={hashingStatus !== "IDLE" && hashingStatus !== "SUCCESS"}
                                />
                                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${file ? "border-emerald-500 bg-emerald-900/10" : "border-slate-700 hover:border-slate-500 hover:bg-slate-900"
                                    }`}>
                                    {file ? (
                                        <div>
                                            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                            <p className="text-white font-bold">{file.name}</p>
                                            <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <Upload className="w-10 h-10 text-slate-500 mx-auto mb-2 group-hover:text-slate-300" />
                                            <p className="text-slate-300 font-bold">Tap to Capture / Upload</p>
                                            <p className="text-xs text-slate-500 mt-1">Photos, Videos, or Disk Images</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Live Hash Display */}
                            {fileHash && (
                                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-center">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">SHA-256 Fingerprint</p>
                                    <p className="font-mono text-emerald-500 text-xs break-all">{fileHash}</p>
                                </div>
                            )}

                            {/* Action Button & Stepper */}
                            {hashingStatus === "SUCCESS" ? (
                                <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg p-4 text-center">
                                    <p className="text-emerald-400 font-bold flex items-center justify-center gap-2">
                                        <CheckCircle className="w-5 h-5" /> Secured on Blockchain
                                    </p>
                                    <a
                                        href={`https://sepolia.etherscan.io/tx/${successTx}`}
                                        target="_blank"
                                        className="text-xs text-emerald-600 hover:text-emerald-500 underline mt-2 block"
                                    >
                                        View Transaction: {successTx.substring(0, 10)}...
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFile(null); setFileHash(""); setHashingStatus("IDLE"); setEvidenceID(""); setSelectedCase("");
                                        }}
                                        className="mt-4 text-xs text-slate-400 hover:text-white"
                                    >
                                        Populate Next Item
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <button
                                        type="submit"
                                        disabled={!file || !selectedCase || hashingStatus !== "IDLE"}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:shadow-none transition-all flex justify-center items-center gap-2"
                                    >
                                        {hashingStatus === "IDLE" ? "SUBMIT TO VAULT" : "PROCESSING..."}
                                    </button>

                                    {/* Stepper */}
                                    {hashingStatus !== "IDLE" && (
                                        <div className="flex justify-between items-center px-4">
                                            {["HASHING", "UPLOADING", "NOTARIZING"].map((step, i) => {
                                                const states = ["HASHING", "UPLOADING", "NOTARIZING", "SUCCESS"];
                                                const currentIndex = states.indexOf(hashingStatus);
                                                const stepIndex = states.indexOf(step);

                                                return (
                                                    <div key={step} className="flex flex-col items-center gap-2 transition-all duration-500">
                                                        <div className={`w-3 h-3 rounded-full ${currentIndex >= stepIndex ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-slate-800"
                                                            }`}></div>
                                                        <span className={`text-[10px] font-bold ${currentIndex >= stepIndex ? "text-emerald-500" : "text-slate-600"
                                                            }`}>
                                                            {step}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </form>
                </div>

                {/* My Seizures & Transfer */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-4">
                        <List className="w-5 h-5 text-blue-500" />
                        My Seizures
                    </h2>

                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Custodian Address (For Transfers)</label>
                        <input
                            type="text"
                            value={custodianAddr}
                            onChange={(e) => setCustodianAddr(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-400 focus:border-blue-500 outline-none"
                        />
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {mySeizures.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                                <List className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 font-bold">No evidence logged yet.</p>
                                <p className="text-xs text-slate-600">Captured items will appear here.</p>
                            </div>
                        ) : (
                            mySeizures.map(item => (
                                <div key={item.evidenceID} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-lg transition-all hover:border-slate-700 group relative overflow-hidden">

                                    {/* Glowing Shield for Collected/Secured Items */}
                                    {["COLLECTED", "SECURED", "IN_TRANSIT"].includes(item.status) && (
                                        <div className="absolute top-0 right-0 p-2">
                                            <Shield className={`w-5 h-5 ${item.status === 'COLLECTED' ? "text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "text-slate-600"
                                                }`} />
                                        </div>
                                    )}

                                    <div className="flex items-start gap-4">
                                        {/* Thumbnail / Icon */}
                                        <div className="w-16 h-16 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                            {item.fileType?.startsWith('image/') && item.storageURL ? (
                                                <img src={item.storageURL} alt="Evidence" className="w-full h-full object-cover" />
                                            ) : (
                                                <FileIcon className="w-8 h-8 text-slate-600" />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start pr-8">
                                                <h4 className="font-bold text-slate-200 truncate text-sm">{item.evidenceID}</h4>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate mt-1">{item.fileName}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-1 rounded font-mono uppercase">
                                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${item.status === 'COLLECTED' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900' :
                                                    item.status === 'IN_TRANSIT' ? 'bg-amber-900/20 text-amber-400 border-amber-900' :
                                                        'bg-slate-800 text-slate-500 border-slate-700'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action: Transfer Link */}
                                    {item.status === 'COLLECTED' && (
                                        <button
                                            onClick={() => handleRequestTransfer(item.evidenceID, item.caseID)}
                                            disabled={loading}
                                            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                            TRANSFER TO CUSTODIAN
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {status && (
                    <div className={`col-span-1 lg:col-span-2 mt-4 p-3 rounded text-xs text-center border ${status.startsWith("Error") ? "bg-red-900/20 border-red-900 text-red-400" : "bg-emerald-900/20 border-emerald-900 text-emerald-400"
                        }`}>
                        {status}
                    </div>
                )}
            </div>
        </div >
    );
}
