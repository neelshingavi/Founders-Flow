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

    // Initial Data & Real-time Listeners
    useEffect(() => {
        if (!currentUser) return;

        // 1. Real-time Connection Listener
        const unsubConnections = getConnectedUsersSnapshot(currentUser.uid, (ids: string[]) => {
            setConnectedUserIds(ids);
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

            data.forEach(room => {
                const otherId = room.participants.find(p => p !== currentUser.uid);
                if (otherId && !roomUsers[otherId]) {
                    getUserData(otherId).then(u => {
                        if (u) setRoomUsers(prev => ({ ...prev, [otherId]: u }));
                    });
                }
            });
        });

        return () => {
            unsubConnections();
            unsubRooms();
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
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: "instant" });
            }, 50);
        });
        return () => unsub();
    }, [activeOtherId, currentUser]);

    // Derived Messaging List
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
            return (roomUsers[a.userId]?.displayName || "").localeCompare(roomUsers[b.userId]?.displayName || "");
        }).filter(item => {
            const u = roomUsers[item.userId];
            const nameMatch = u?.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
            const msgMatch = item.room?.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase());
            return nameMatch || msgMatch;
        });
    }, [connectedUserIds, rooms, roomUsers, searchTerm]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!messageText.trim() || !activeOtherId || !currentUser) return;

        const text = messageText;
        setMessageText("");

        try {
            await sendMessage(currentUser.uid, activeOtherId, text);
        } catch (error) {
            console.error("Transmission failed:", error);
            setMessageText(text);
        }
    };

    const activeOtherUserData = activeOtherId ? roomUsers[activeOtherId] : null;

    if (!currentUser) return null;

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white dark:bg-[#09090b] rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800/50 overflow-hidden shadow-2xl relative">

            {/* Conversations List */}
            <div className={cn(
                "w-full md:w-[350px] border-r border-zinc-50 dark:border-zinc-800/50 flex flex-col bg-zinc-50/20 dark:bg-black/20",
                activeOtherId ? "hidden md:flex" : "flex"
            )}>
                <div className="p-6 space-y-4">
                    <div className="space-y-1">
                        <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">Relay Hub</h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                            {roleContext} Context
                        </p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Locate connection..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-xs focus:outline-none transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-10 space-y-1 custom-scrollbar">
                    {loadingRooms ? (
                        <div className="flex justify-center p-12 opacity-20">
                            <Loader2 className="w-5 h-5 animate-spin" />
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
                                        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all group",
                                        isActive
                                            ? "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm"
                                            : "hover:bg-white/60 dark:hover:bg-zinc-900/40"
                                    )}
                                >
                                    <div className="relative shrink-0">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                            <img
                                                src={u?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u?.displayName || item.userId}`}
                                                className="w-full h-full object-cover"
                                                alt=""
                                            />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full" />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <h4 className="text-[11px] font-black uppercase text-zinc-900 dark:text-white truncate">
                                                {u?.displayName || "Loading Node..."}
                                            </h4>
                                            {item.room?.lastTimestamp && (
                                                <span className="text-[8px] font-black text-zinc-400 uppercase">
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
                        <div className="py-20 text-center space-y-4 opacity-30">
                            <Sparkles className="w-6 h-6 mx-auto text-zinc-400" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Zero Transmissions</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col bg-white dark:bg-[#09090b]",
                !activeOtherId && "hidden md:flex items-center justify-center"
            )}>
                {activeOtherId ? (
                    <>
                        {/* Header */}
                        <div className="p-4 md:px-8 border-b border-zinc-50 dark:border-zinc-800/50 flex items-center justify-between z-30 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setActiveOtherId(null)}
                                    className="md:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                                >
                                    <ChevronLeft className="w-5 h-5 text-zinc-400" />
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                                        <img
                                            src={activeOtherUserData?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeOtherUserData?.displayName || activeOtherId}`}
                                            className="w-full h-full object-cover"
                                            alt=""
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                            {activeOtherUserData?.displayName || "System Node"}
                                        </h3>
                                        <div className="flex items-center gap-1.5 font-black text-green-500 text-[8px] uppercase tracking-widest">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            Active Transmitting
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2.5 text-zinc-400 hover:text-indigo-500 transition-all"><Phone className="w-4 h-4" /></button>
                                <button className="p-2.5 text-zinc-400 hover:text-indigo-500 transition-all"><Video className="w-4 h-4" /></button>
                                <button className="p-2.5 text-zinc-400 hover:text-indigo-500 transition-all"><MoreHorizontal className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {/* Stream */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-gradient-to-b from-zinc-50/20 to-white dark:from-zinc-900/5 dark:to-[#09090b]">
                            {messages.map((msg) => {
                                const isMe = msg.senderId === currentUser?.uid;
                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={cn(
                                            "flex items-end gap-3",
                                            isMe ? "flex-row-reverse" : "flex-row"
                                        )}
                                    >
                                        <div className={cn(
                                            "max-w-[75%] p-4 rounded-2xl",
                                            isMe
                                                ? "bg-zinc-900 text-white dark:bg-white dark:text-black rounded-br-[0.5rem] shadow-sm"
                                                : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border border-zinc-100 dark:border-zinc-800 rounded-bl-[0.5rem]"
                                        )}>
                                            <p className="text-[13px] font-medium leading-relaxed tracking-tight">{msg.text}</p>
                                        </div>
                                        <div className="text-[7px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                                            {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---"}
                                        </div>
                                    </motion.div>
                                );
                            })}
                            <div ref={scrollRef} className="h-4" />
                        </div>

                        {/* Input */}
                        <div className="p-6 md:px-8 border-t border-zinc-50 dark:border-zinc-800 bg-white dark:bg-[#09090b] z-30">
                            <form
                                onSubmit={handleSend}
                                className="relative group flex items-center gap-3"
                            >
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        placeholder="Transmit message..."
                                        className="w-full px-6 py-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm focus:outline-none transition-all font-medium"
                                    />
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="submit"
                                    disabled={!messageText.trim()}
                                    className="h-[48px] w-[48px] rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl hover:bg-black dark:hover:bg-zinc-100 transition-all disabled:opacity-30 disabled:scale-100"
                                >
                                    <Send className="w-5 h-5" />
                                </motion.button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-6 text-center max-w-xs px-6">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center border border-zinc-100 dark:border-zinc-800 shadow-xl">
                            <MessageSquare className="w-8 h-8 text-zinc-200 dark:text-zinc-800" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black tracking-tighter uppercase">Secure Hub</h3>
                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-relaxed italic opacity-60">
                                Select a verified connection to establish an encrypted transmission channel.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
