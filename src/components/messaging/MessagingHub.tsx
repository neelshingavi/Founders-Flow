"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserChatRooms, getMessages, sendMessage, ChatRoom, Message } from "@/lib/messaging-service";
import { getUserData, UserData } from "@/lib/startup-service";
import { getConnectedUsersSnapshot } from "@/lib/connection-service";
import {
    Send, MessageSquare, Search,
    ChevronLeft, Loader2, Sparkles, MoreHorizontal, Phone, Video,
    Shield, Info, Paperclip, Smile, Star
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export interface MessagingHubProps {
    roleContext: "founder" | "investor" | "customer" | "job-seeker" | "admin";
}

export function MessagingHub({ roleContext }: MessagingHubProps) {
    const { user: currentUser } = useAuth();
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [activeOtherId, setActiveOtherId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [roomUsers, setRoomUsers] = useState<Record<string, UserData>>({});
    const [connectedUserIds, setConnectedUserIds] = useState<string[]>([]);
    const [messageText, setMessageText] = useState("");
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);

    // Initial Data & Real-time Listeners
    useEffect(() => {
        if (!currentUser) return;

        getUserData(currentUser.uid).then(setCurrentUserData);

        // 1. Real-time Connection Listener
        const unsubConnections = getConnectedUsersSnapshot(currentUser.uid, (ids: string[]) => {
            setConnectedUserIds(ids);
            // Fetch names for anyone missing
            ids.forEach(id => {
                if (!roomUsers[id]) {
                    getUserData(id).then(u => {
                        if (u) setRoomUsers(prev => ({ ...prev, [id]: u }));
                    });
                }
            });
        });

        // 2. Real-time Rooms Listener
        const unsubRooms = getUserChatRooms(currentUser.uid, (data) => {
            setRooms(data);
            setLoadingRooms(false);

            // Sync metadata for room participants
            data.forEach(room => {
                const otherId = room.participants.find(p => p !== currentUser.uid);
                if (otherId && !roomUsers[otherId]) {
                    getUserData(otherId).then(u => {
                        if (u) setRoomUsers(prev => ({ ...prev, [otherId]: u }));
                    });
                }
            });
        });

        // Lock body scroll to prevent layout jump on focus
        document.body.style.overflow = "hidden";

        return () => {
            unsubConnections();
            unsubRooms();
            document.body.style.overflow = "unset";
        };
    }, [currentUser]);

    // Active Message Stream Listener
    useEffect(() => {
        if (!activeOtherId || !currentUser) {
            setMessages([]);
            return;
        }

        const unsub = getMessages(currentUser.uid, activeOtherId, (msgs) => {
            setMessages(msgs);
            // Immediate scroll to bottom
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: "instant" });
            }, 50);
        });
        return () => unsub();
    }, [activeOtherId, currentUser]);

    // Derived Messaging List (All connections, attach room data)
    const displayList = useMemo(() => {
        const list = connectedUserIds.map(userId => {
            const existingRoom = rooms.find(r => r.participants.includes(userId));
            return {
                userId,
                room: existingRoom || null
            };
        });

        return list.sort((a, b) => {
            const timeA = a.room?.lastTimestamp?.toDate?.().getTime() || 0;
            const timeB = b.room?.lastTimestamp?.toDate?.().getTime() || 0;
            if (timeA !== timeB) return timeB - timeA;

            const nameA = roomUsers[a.userId]?.displayName || "";
            const nameB = roomUsers[b.userId]?.displayName || "";
            return nameA.localeCompare(nameB);
        }).filter(item => {
            const u = roomUsers[item.userId];
            const nameMatch = u?.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
            const msgMatch = item.room?.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase());
            return nameMatch || msgMatch;
        });
    }, [connectedUserIds, rooms, roomUsers, searchTerm, currentUser]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!messageText.trim() || !activeOtherId || !currentUser) return;

        const text = messageText;
        setMessageText(""); // Clear for UX responsiveness

        try {
            await sendMessage(currentUser.uid, activeOtherId, text);
        } catch (error) {
            console.error("Transmission failed:", error);
            setMessageText(text); // Restore on failure
        }
    };

    const activeOtherUserData = activeOtherId ? roomUsers[activeOtherId] : null;

    if (!currentUser) return null;

    return (
        <div className="flex h-full w-full bg-white dark:bg-[#050505] overflow-hidden relative overscroll-contain">

            {/* Conversations List */}
            <div className={cn(
                "w-full md:w-[380px] border-r border-zinc-50 dark:border-zinc-800/50 flex flex-col bg-zinc-50/20 dark:bg-black/20 backdrop-blur-3xl z-20",
                activeOtherId ? "hidden md:flex" : "flex"
            )}>
                <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase italic underline decoration-indigo-500 underline-offset-8">Relay Hub</h2>
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-500/80 pt-2">
                                {roleContext} Secure Channel
                            </p>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute -inset-1 bg-indigo-500/5 rounded-2xl blur-lg group-focus-within:bg-indigo-500/10 transition duration-500" />
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Locate connection..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium placeholder:text-zinc-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-2 custom-scrollbar">
                    {loadingRooms ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-20">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Initialising...</span>
                        </div>
                    ) : displayList.length > 0 ? (
                        displayList.map((item) => {
                            const u = roomUsers[item.userId];
                            const isActive = activeOtherId === item.userId;

                            return (
                                <button
                                    key={item.userId}
                                    onClick={() => setActiveOtherId(item.userId)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-5 rounded-[2rem] transition-all group duration-300",
                                        isActive
                                            ? "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-xl"
                                            : "hover:bg-white/60 dark:hover:bg-zinc-900/40 border border-transparent"
                                    )}
                                >
                                    <div className="relative shrink-0">
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700 group-hover:scale-105 transition-transform">
                                            <img
                                                src={u?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u?.displayName || item.userId}`}
                                                className="w-full h-full object-cover"
                                                alt=""
                                            />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full shadow-lg" />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h4 className="text-[11px] font-black uppercase text-zinc-900 dark:text-white truncate tracking-tight">
                                                {u?.displayName || "Loading Node..."}
                                            </h4>
                                            {item.room?.lastTimestamp && (
                                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                                                    {formatDistanceToNow(item.room.lastTimestamp.toDate())}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-zinc-400 font-medium truncate uppercase tracking-tighter">
                                            {item.room?.lastMessage || "Begin stable connection..."}
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="py-20 text-center space-y-6 opacity-30">
                            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] mx-auto flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                                <Sparkles className="w-6 h-6 text-zinc-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Zero Transmissions</p>
                                <p className="text-[8px] font-medium text-zinc-500 max-w-[180px] mx-auto leading-relaxed">Ensure users are in your 'Accepted' connection list to begin relayed messaging.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Window */}
            <div className={cn(
                "flex-1 flex flex-col bg-white dark:bg-[#09090b] relative",
                !activeOtherId && "hidden md:flex items-center justify-center bg-zinc-50/20 dark:bg-transparent"
            )}>
                {activeOtherId ? (
                    <>
                        {/* Header */}
                        <div className="p-6 md:px-12 border-b border-zinc-50 dark:border-zinc-800/50 flex items-center justify-between z-30 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl">
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={() => setActiveOtherId(null)}
                                    className="md:hidden p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-all"
                                >
                                    <ChevronLeft className="w-5 h-5 text-zinc-400" />
                                </button>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-lg shadow-black/5">
                                            <img
                                                src={activeOtherUserData?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeOtherUserData?.displayName || activeOtherId}`}
                                                className="w-full h-full object-cover"
                                                alt=""
                                            />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-white dark:border-[#09090b] rounded-full" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                            {activeOtherUserData?.displayName || "Protocol Node"}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 font-black text-green-500 text-[8px] uppercase tracking-[0.2em]">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                Verified Transmission
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-3.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-2xl transition-all border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800">
                                    <Phone className="w-4.5 h-4.5" />
                                </button>
                                <button className="p-3.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-2xl transition-all border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800">
                                    <Video className="w-4.5 h-4.5" />
                                </button>
                                <button className="p-3.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-2xl transition-all">
                                    <MoreHorizontal className="w-4.5 h-4.5" />
                                </button>
                            </div>
                        </div>

                        {/* Stream Area */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 custom-scrollbar bg-gradient-to-b from-zinc-50/10 to-white dark:from-zinc-900/5 dark:to-[#09090b]">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 gap-6">
                                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                        <Info className="w-6 h-6" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">E2E Secure Channel Ready</p>
                                </div>
                            ) : messages.map((msg, idx) => {
                                const isMe = msg.senderId === currentUser?.uid;
                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        className={cn(
                                            "flex items-end gap-3",
                                            isMe ? "flex-row-reverse" : "flex-row"
                                        )}
                                    >
                                        <div className={cn(
                                            "max-w-[80%] p-6 rounded-[2.5rem] relative shadow-lg shadow-black/5",
                                            isMe
                                                ? "bg-zinc-900 text-white dark:bg-white dark:text-black rounded-br-[0.5rem] ring-4 ring-zinc-900/5 dark:ring-white/5"
                                                : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border border-zinc-100 dark:border-zinc-800 rounded-bl-[0.5rem] ring-4 ring-zinc-50 dark:ring-zinc-950/20"
                                        )}>
                                            <p className="text-[14px] font-medium leading-relaxed tracking-tight whitespace-pre-wrap">{msg.text}</p>
                                        </div>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-4 px-2">
                                            {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---"}
                                        </div>
                                    </motion.div>
                                );
                            })}
                            <div ref={scrollRef} className="h-4" />
                        </div>

                        {/* Interactive Input Hub */}
                        <div className="p-10 border-t border-zinc-50 dark:border-zinc-800 bg-white dark:bg-[#09090b] z-30 shadow-[0_-20px_40px_rgba(0,0,0,0.02)]">
                            <div className="relative group flex items-end gap-5">
                                <div className="flex-1 relative">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2.2rem] opacity-0 group-focus-within:opacity-[0.05] blur-xl transition duration-500" />
                                    <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-[2.2rem] border border-zinc-100 dark:border-zinc-800 px-6 py-2 transition-all focus-within:border-indigo-500/50 focus-within:bg-white dark:focus-within:bg-zinc-900">
                                        <button className="p-3 text-zinc-400 hover:text-indigo-500 transition-colors">
                                            <Paperclip className="w-5 h-5" />
                                        </button>
                                        <textarea
                                            rows={1}
                                            value={messageText}
                                            onFocus={() => {
                                                // Removed redundant scroll that causes UI jump
                                            }}
                                            onChange={(e) => {
                                                setMessageText(e.target.value);
                                                // Auto-resize logic
                                                e.target.style.height = 'auto';
                                                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            placeholder="Transmit intelligence..."
                                            className="flex-1 bg-transparent border-none text-[15px] font-medium focus:ring-0 placeholder:text-zinc-400 py-4 max-h-[150px] resize-none overflow-y-auto custom-scrollbar"
                                        />
                                        <button className="p-3 text-zinc-400 hover:text-indigo-500 transition-colors">
                                            <Smile className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleSend()}
                                    disabled={!messageText.trim()}
                                    className="h-[68px] w-[68px] rounded-[2.2rem] bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xl hover:bg-black dark:hover:bg-zinc-100 transition-all disabled:opacity-30 disabled:scale-100 group/send"
                                >
                                    <Send className="w-6 h-6 group-hover/send:translate-x-1 group-hover/send:-translate-y-1 transition-transform" />
                                </motion.button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-8 text-center max-w-sm px-8 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                        <div className="relative">
                            <div className="absolute -inset-12 bg-indigo-500/10 rounded-full blur-[80px]" />
                            <div className="relative w-32 h-32 rounded-[3.5rem] bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center border border-zinc-100 dark:border-zinc-800 shadow-2xl">
                                <MessageSquare className="w-12 h-12 text-zinc-200 dark:text-zinc-800" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-2xl font-black tracking-tighter uppercase text-zinc-900 dark:text-white underline decoration-indigo-500 decoration-4 underline-offset-8">Secure Relay Hub</h3>
                            <div className="pt-4 space-y-2 px-6">
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 leading-relaxed italic opacity-80">
                                    Initialize end-to-end encrypted protocol with verified connections in your network.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full pt-10">
                            {[
                                { icon: Shield, label: "Encrypted" },
                                { icon: Star, label: "Verified" }
                            ].map((item, i) => (
                                <div key={i} className="p-6 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-3xl border border-zinc-100 dark:border-zinc-800/50 flex flex-col items-center gap-3">
                                    <item.icon className="w-5 h-5 text-indigo-500" />
                                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Aesthetic Background Overlays */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none z-0" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none z-0" />
        </div>
    );
}
