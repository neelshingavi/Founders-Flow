"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserChatRooms, getMessages, sendMessage, ChatRoom, Message } from "@/lib/messaging-service";
import { getUserData, UserData } from "@/lib/startup-service";
import {
    Send, User as UserIcon, MessageSquare, Search,
    ChevronLeft, Loader2, Sparkles, MoreHorizontal, Phone, Video
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
    const { user: currentUser } = useAuth();
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [roomUsers, setRoomUsers] = useState<Record<string, UserData>>({});
    const [messageText, setMessageText] = useState("");
    const [loadingRooms, setLoadingRooms] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!currentUser) return;
        const unsub = getUserChatRooms(currentUser.uid, (data) => {
            setRooms(data);
            setLoadingRooms(false);
            // Pre-fetch user data for room participants
            data.forEach(room => {
                const otherId = room.participants.find(p => p !== currentUser.uid);
                if (otherId && !roomUsers[otherId]) {
                    getUserData(otherId).then(u => {
                        if (u) setRoomUsers(prev => ({ ...prev, [otherId]: u }));
                    });
                }
            });
        });
        return () => unsub();
    }, [currentUser]);

    useEffect(() => {
        if (!activeRoom || !currentUser) return;
        const otherId = activeRoom.participants.find(p => p !== currentUser.uid);
        if (!otherId) return;

        const unsub = getMessages(currentUser.uid, otherId, (msgs) => {
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });
        return () => unsub();
    }, [activeRoom, currentUser]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !activeRoom || !currentUser) return;
        const otherId = activeRoom.participants.find(p => p !== currentUser.uid);
        if (!otherId) return;

        const text = messageText;
        setMessageText("");
        await sendMessage(currentUser.uid, otherId, text);
    };

    const activeOtherUser = activeRoom?.participants.find(p => p !== currentUser?.uid);
    const otherUserData = activeOtherUser ? roomUsers[activeOtherUser] : null;

    return (
        <div className="flex h-[calc(100vh-120px)] bg-white dark:bg-zinc-950 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-2xl animate-in fade-in duration-700">
            {/* Sidebar */}
            <div className={cn(
                "w-full md:w-[380px] border-r border-zinc-100 dark:border-zinc-800 flex flex-col bg-zinc-50/30 dark:bg-zinc-900/10",
                activeRoom ? "hidden md:flex" : "flex"
            )}>
                <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-500/10 rounded-xl">
                                <MessageSquare className="w-4 h-4 text-indigo-500" />
                            </div>
                            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-900 dark:text-zinc-50">Intel Relay</h2>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Find connection..."
                            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2 custom-scrollbar">
                    {loadingRooms ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="w-6 h-6 animate-spin text-zinc-200" />
                        </div>
                    ) : rooms.length > 0 ? (
                        rooms.map((room) => {
                            const otherId = room.participants.find(p => p !== currentUser?.uid);
                            const u = otherId ? roomUsers[otherId] : null;

                            return (
                                <button
                                    key={room.id}
                                    onClick={() => setActiveRoom(room)}
                                    className={cn(
                                        "w-full flex items-center gap-4 p-5 rounded-[1.8rem] transition-all group",
                                        activeRoom?.id === room.id
                                            ? "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm"
                                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                                    )}
                                >
                                    <div className="relative shrink-0">
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u?.displayName || room.id}`} className="w-full h-full" />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full" />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h4 className="text-xs font-black uppercase text-zinc-900 dark:text-zinc-50 truncate tracking-tight">{u?.displayName || "System Node"}</h4>
                                            {room.lastTimestamp && (
                                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                                                    {formatDistanceToNow(room.lastTimestamp.toDate(), { addSuffix: false })}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-zinc-500 font-medium truncate uppercase tracking-tighter">
                                            {room.lastMessage || "Establish connection..."}
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="py-20 text-center space-y-4 opacity-50">
                            <Sparkles className="w-8 h-8 mx-auto text-zinc-300" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Zero Active Waves</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col bg-white dark:bg-zinc-950",
                !activeRoom && "hidden md:flex items-center justify-center"
            )}>
                {activeRoom ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setActiveRoom(null)}
                                    className="md:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserData?.displayName || activeRoom.id}`} className="w-full h-full" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-50">{otherUserData?.displayName}</h3>
                                        <div className="flex items-center gap-1.5 font-bold text-green-500 text-[9px] uppercase tracking-[0.2em]">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            Active Protocol
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-3 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-2xl transition-all">
                                    <Phone className="w-4 h-4" />
                                </button>
                                <button className="p-3 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-2xl transition-all">
                                    <Video className="w-4 h-4" />
                                </button>
                                <button className="p-3 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-2xl transition-all">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-zinc-50/30 dark:bg-zinc-900/10">
                            {messages.map((msg, idx) => {
                                const isMe = msg.senderId === currentUser?.uid;
                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn(
                                            "flex items-end gap-3",
                                            isMe ? "flex-row-reverse" : "flex-row"
                                        )}
                                    >
                                        <div className={cn(
                                            "max-w-[70%] p-5 rounded-[2rem]",
                                            isMe
                                                ? "bg-zinc-900 text-white dark:bg-white dark:text-black rounded-br-none"
                                                : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border border-zinc-100 dark:border-zinc-800 rounded-bl-none shadow-sm"
                                        )}>
                                            <p className="text-sm font-medium leading-relaxed tracking-tight">{msg.text}</p>
                                        </div>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                                            {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "---"}
                                        </div>
                                    </motion.div>
                                );
                            })}
                            <div ref={scrollRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-8 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                            <form onSubmit={handleSend} className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2rem] opacity-0 group-hover:opacity-10 blur-xl transition duration-500" />
                                <div className="relative flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        placeholder="Transmit intelligence..."
                                        className="flex-1 px-8 py-5 rounded-[1.8rem] bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!messageText.trim()}
                                        className="h-[60px] w-[60px] rounded-[1.8rem] bg-indigo-600 text-white flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:scale-100"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-6 text-center max-w-sm">
                        <div className="w-24 h-24 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
                            <MessageSquare className="w-10 h-10 text-zinc-300" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black uppercase tracking-tight">Zero Transmission</h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 leading-relaxed">
                                Select a verified connection from the sidebar to establish a secure intelligence channel.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
