"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Shield, Fingerprint, Stamp } from "lucide-react";

export default function CertificatePage() {
    const params = useParams();
    const evidenceID = params.evidenceID as string;
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        if (!evidenceID) return;
        getDoc(doc(db, "evidence", evidenceID)).then(snap => {
            if (snap.exists()) setData(snap.data());
        });
    }, [evidenceID]);

    if (!data) return <div className="p-12 text-center">Loading Certificate...</div>;

    return (
        <div className="min-h-screen bg-white text-black p-12 print:p-0">
            <div className="max-w-4xl mx-auto border-4 border-slate-900 p-12 relative">

                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                    <Shield className="w-96 h-96" />
                </div>

                {/* Header */}
                <div className="text-center border-b-2 border-slate-900 pb-8 mb-8">
                    <div className="flex justify-center items-center gap-4 mb-4">
                        <Shield className="w-12 h-12" />
                        <h1 className="text-4xl font-serif font-bold uppercase tracking-widest">Digipol Chain of Custody</h1>
                    </div>
                    <p className="text-sm font-serif italic">Official Digital Evidence Certificate • Immutable Blockchain Record</p>
                </div>

                {/* Content */}
                <div className="space-y-8 font-serif">

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="uppercase text-xs font-bold tracking-wider mb-1">Evidence ID</h3>
                            <p className="text-xl font-mono bg-slate-100 p-2 border border-slate-300 inline-block">
                                {data.evidenceID}
                            </p>
                        </div>
                        <div>
                            <h3 className="uppercase text-xs font-bold tracking-wider mb-1">Date Created</h3>
                            <p className="text-lg">
                                {new Date(data.timestamp).toLocaleDateString()} at {new Date(data.timestamp).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 className="uppercase text-xs font-bold tracking-wider mb-2">Cryptographic Hash (SHA-256)</h3>
                        <p className="font-mono text-xs break-all bg-slate-100 p-4 border border-slate-300">
                            {data.fileHash}
                        </p>
                        <p className="text-xs italic mt-1 opacity-70">
                            *This hash uniquely identifies the digital asset. Any alteration to the file will result in a completely different hash value.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mt-8">
                        <div>
                            <h3 className="uppercase text-xs font-bold tracking-wider mb-1">Seizing Officer</h3>
                            <p className="text-lg border-b border-black pb-1">{data.officerName}</p>
                            <p className="text-xs font-mono mt-1 opacity-70">UID: {data.officerID}</p>
                        </div>
                        {data.examinerName && (
                            <div>
                                <h3 className="uppercase text-xs font-bold tracking-wider mb-1">Forensic Examiner</h3>
                                <p className="text-lg border-b border-black pb-1">{data.examinerName}</p>
                                <p className="text-xs font-mono mt-1 opacity-70">Verified Integrity</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-12 p-6 border-2 border-dashed border-slate-400 bg-slate-50">
                        <h3 className="flex items-center gap-2 font-bold uppercase tracking-wider mb-4">
                            <Fingerprint className="w-5 h-5" />
                            Blockchain Verification
                        </h3>
                        <div className="space-y-4 text-xs font-mono">
                            <div>
                                <span className="block opacity-50">Genesis Transaction (Ingestion)</span>
                                <span className="break-all">{data.txHash}</span>
                            </div>
                            {data.analysisTxHash && (
                                <div>
                                    <span className="block opacity-50">Analysis Transaction</span>
                                    <span className="break-all">{data.analysisTxHash}</span>
                                </div>
                            )}
                            <div>
                                <span className="block opacity-50">Current Status</span>
                                <span className="font-bold text-lg">{data.status}</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t-2 border-slate-900 flex justify-between items-end">
                    <div className="text-xs opacity-60 w-1/2">
                        <p>Generated by Digipol 2.0 Secure Vault.</p>
                        <p>This document is a certified representation of the immutable ledger.</p>
                    </div>
                    <div className="text-center">
                        <Stamp className="w-16 h-16 mx-auto opacity-20 rotate-12" />
                        <p className="font-serif font-bold mt-2">OFFICIAL SEAL</p>
                    </div>
                </div>

                {/* Print Fab */}
                <button
                    onClick={() => window.print()}
                    className="fixed bottom-8 right-8 bg-blue-600 text-white p-4 rounded-full shadow-xl print:hidden hover:bg-blue-700"
                >
                    <Stamp className="w-6 h-6" />
                </button>

            </div>
        </div>
    );
}
