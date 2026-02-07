"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface UserData {
    uid: string;
    name: string;
    email: string;
    role: "INVESTIGATION_OFFICER" | "SEIZURE_OFFICER" | "EVIDENCE_CUSTODIAN" | "FORENSIC_EXAMINER" | "HOD" | "SUPER_ADMIN";
    walletAddress?: string;
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    logout: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let unsubscribeFirestore: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                setLoading(true);

                // Subscribe to Firestore User Data
                unsubscribeFirestore = onSnapshot(doc(db, "users", firebaseUser.uid), (doc) => {
                    if (doc.exists()) {
                        setUserData(doc.data() as UserData);
                    } else {
                        console.error("User document not found in Firestore");
                        setUserData(null);
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Error fetching user data:", err);
                    setUserData(null);
                    setLoading(false);
                });

            } else {
                setUser(null);
                setUserData(null);
                setLoading(false);
                if (unsubscribeFirestore) {
                    unsubscribeFirestore();
                    unsubscribeFirestore = null;
                }
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeFirestore) unsubscribeFirestore();
        };
    }, []);

    const logout = async () => {
        try {
            await firebaseSignOut(auth);
            router.push("/login");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
