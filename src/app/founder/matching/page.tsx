"use client";

import { useEffect, useState } from "react";
import { Users, Search, MapPin, TrendingUp, Mail, ExternalLink, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UserData, getActiveStartup, Startup } from "@/lib/startup-service";
import { sendConnectionRequest, getConnectedUsers, getSentRequests } from "@/lib/connection-service";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

interface UserWithStartup extends UserData {
    activeStartup?: Startup | null;
}

export default function MatchingPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserWithStartup[]>([]);
    const [connections, setConnections] = useState<string[]>([]);
    const [sentRequests, setSentRequests] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(collection(db, "users"), where("uid", "!=", currentUser.uid));
        const unsubUsers = onSnapshot(q, async (snap) => {
            const rawUsers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserData[];
            const enriched = await Promise.all(rawUsers.map(async (u) => {
                const activeStartup = await getActiveStartup(u.uid);
                return { ...u, activeStartup };
            }));
            setUsers(enriched);
            setLoading(false);
        });

        const unsubSent = getSentRequests(currentUser.uid, (ids) => setSentRequests(ids));
        const fetchConnections = async () => {
            const myConns = await getConnectedUsers(currentUser.uid);
            setConnections(myConns);
        };
        fetchConnections();

        return () => {
            unsubUsers();
            unsubSent();
        };
    }, [currentUser]);

    const handleConnect = async (targetId: string) => {
        if (!currentUser) return;
        try {
            await sendConnectionRequest(currentUser.uid, targetId);
        } catch (error) {
            console.error("Connection failed:", error);
        }
    };

    const getStatus = (uid: string) => {
        if (connections.includes(uid)) return "connected";
        if (sentRequests.includes(uid)) return "pending";
        return "none";
    };

    const filteredUsers = users.filter(user =>
        user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Agentic Matching</h1>
                        <p className="text-zinc-500 text-sm">Gemini-curated connections based on your startup intent.</p>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search ecosystem..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-64 rounded-[2rem] bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
                    ))
                ) : filteredUsers.map((u) => {
                    const status = getStatus(u.uid as string);
                    return (
                        <div key={u.uid as string} className="group p-8 rounded-[2.5rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:shadow-2xl transition-all duration-500">
                            <div className="flex items-start justify-between mb-6">
                                <img
                                    src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.displayName || u.uid}`}
                                    className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-800 object-cover"
                                />
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/5 px-3 py-1 rounded-full">
                                        Ecosystem Node
                                    </span>
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold">{u.displayName || "Anonymous User"}</h3>
                            <p className="text-zinc-500 font-medium mb-1">{u.role || "Founder"}</p>
                            <div className="flex items-center gap-1 text-zinc-400 text-sm mb-6">
                                <MapPin className="w-3 h-3" />
                                {u.location || "Global"}
                            </div>

                            <div className="flex flex-wrap gap-2 mb-8 min-h-[32px]">
                                {u.activeStartup && (
                                    <span className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-zinc-950 border border-indigo-100 dark:border-zinc-800 text-xs text-indigo-600">
                                        {u.activeStartup.industry}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleConnect(u.uid)}
                                    disabled={status !== "none"}
                                    className={cn(
                                        "flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all",
                                        status === "none" ? "bg-black dark:bg-white text-white dark:text-black hover:scale-105" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                    )}
                                >
                                    {status === "pending" ? <Clock className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                                    {status === "none" ? "Connect" : status === "pending" ? "Pending" : "Connected"}
                                </button>
                                <button className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                                    <ExternalLink className="w-4 h-4" />
                                    Profile
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-12 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-indigo-900 text-white">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-indigo-200">
                            <TrendingUp className="w-5 h-5" />
                            <h4 className="font-bold uppercase tracking-wider">AI Optimizer</h4>
                        </div>
                        <h3 className="text-3xl font-black">Boost Visibility</h3>
                        <p className="opacity-60 max-w-sm">
                            Let the Matching Agent highlight your project to the top relevant investors based on your latest roadmap activity.
                        </p>
                    </div>
                    <button className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-bold hover:scale-105 transition-all">
                        Enable Hyper-Growth
                    </button>
                </div>
            </div>
        </div>
    );
}
