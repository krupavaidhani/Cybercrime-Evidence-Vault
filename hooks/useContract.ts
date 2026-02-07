"use client";

import { useState, useEffect } from "react";
import { ethers, Contract } from "ethers";
import { useAuth } from "@/contexts/AuthContext";
import contractConfig from "@/app/contractConfig.json";

const CONTRACT_ABI = contractConfig.abi;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || contractConfig.address;
const AMOY_RPC_URL = process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/";

export function useContract() {
    const { user } = useAuth();
    const [contract, setContract] = useState<Contract | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(true);
    const [provider, setProvider] = useState<ethers.Provider | null>(null);

    useEffect(() => {
        const initContract = async () => {
            // 1. Try to use Wallet (Signer) if connected
            if (window.ethereum && user) {
                try {
                    const browserProvider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await browserProvider.getSigner();
                    const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

                    setProvider(browserProvider);
                    setContract(contractInstance);
                    setIsReadOnly(false);
                    return;
                } catch (e) {
                    console.warn("Failed to get signer:", e);
                }
            }

            // 2. Fallback to Read-Only RPC (Amoy)
            try {
                const rpcProvider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
                const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, rpcProvider);

                setProvider(rpcProvider);
                setContract(contractInstance);
                setIsReadOnly(true);
            } catch (e) {
                console.error("Failed to initialize Read-Only Provider:", e);
            }
        };

        initContract();
    }, [user]); // Re-run when user auth state changes

    return { contract, isReadOnly, provider };
}
