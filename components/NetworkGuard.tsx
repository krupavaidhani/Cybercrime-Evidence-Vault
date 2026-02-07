"use client";

import { useEffect, useState } from "react";
import { Shield, AlertTriangle } from "lucide-react";

const TARGET_CHAIN_ID = "0x13882"; // 80002 in hex (Polygon Amoy)
const TARGET_CHAIN_NAME = "Polygon Amoy Testnet";

export default function NetworkGuard() {
    const [isWrongNetwork, setIsWrongNetwork] = useState(false);

    useEffect(() => {
        if (!window.ethereum) return;

        const checkNetwork = async () => {
            const chainId = await window.ethereum.request({ method: "eth_chainId" });
            setIsWrongNetwork(chainId !== TARGET_CHAIN_ID);
        };

        checkNetwork();

        window.ethereum.on("chainChanged", (chainId: string) => {
            setIsWrongNetwork(chainId !== TARGET_CHAIN_ID);
        });

        return () => {
            // Cleanup listener if needed (modern providers handle this well)
        };
    }, []);

    const switchNetwork = async () => {
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: TARGET_CHAIN_ID }],
            });
        } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [
                            {
                                chainId: TARGET_CHAIN_ID,
                                chainName: TARGET_CHAIN_NAME,
                                rpcUrls: ["https://rpc-amoy.polygon.technology/"],
                                nativeCurrency: {
                                    name: "MATIC",
                                    symbol: "MATIC",
                                    decimals: 18,
                                },
                                blockExplorerUrls: ["https://amoy.polygonscan.com/"],
                            },
                        ],
                    });
                } catch (addError) {
                    console.error("Failed to add network:", addError);
                }
            } else {
                console.error("Failed to switch network:", switchError);
            }
        }
    };

    if (!isWrongNetwork) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                        <AlertTriangle className="w-12 h-12 text-red-500" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Wrong Network Detected</h2>
                <p className="text-slate-400 text-sm mb-8">
                    Digipol 2.0 operates exclusively on the <strong>{TARGET_CHAIN_NAME}</strong>.
                    Please switch your wallet network to continue.
                </p>

                <button
                    onClick={switchNetwork}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
                >
                    <Shield className="w-5 h-5" />
                    Switch to Polygon Amoy
                </button>
            </div>
        </div>
    );
}
