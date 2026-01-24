"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile, sendPasswordResetEmail, getAuth } from "firebase/auth";
import {
    User, Mail, Save, Phone, MapPin, GraduationCap, Briefcase,
    Award, Clock, ShieldCheck, Lock, Loader2, Users, ExternalLink,
    X, Camera, Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { UserData } from "@/lib/startup-service";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { onSnapshot } from "firebase/firestore";

export default function ProfileEditor() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [connectedUsers, setConnectedUsers] = useState<UserData[]>([]);
    const [showConnections, setShowConnections] = useState(false);

    // Profile Data
    const [formData, setFormData] = useState({
        displayName: "",
        email: "",
        about: "",
        skills: "",
        age: "",
        phone: "",
        education: "",
        location: "",
        photoURL: "",
        bannerURL: "",
        role: "Founder",
        socialLinks: { linkedin: "", twitter: "", website: "" },
        connectionCount: 0
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            const docRef = doc(db, "users", user.uid);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                setFormData(prev => ({
                    ...prev,
                    displayName: user.displayName || "",
                    email: user.email || "",
                    role: data.role || "Founder",
                    about: data.about || "",
                    skills: data.skills || "",
                    age: data.age || "",
                    phone: data.phone || "",
                    education: data.education || "",
                    location: data.location || "",
                    photoURL: data.photoURL || "",
                    bannerURL: data.bannerURL || "",
                    socialLinks: data.socialLinks || { linkedin: "", twitter: "", website: "" },
                    connectionCount: data.connectionCount || 0
                }));
            }
        };

        const unsubUser = user ? onSnapshot(doc(db, "users", user.uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setFormData(prev => ({
                    ...prev,
                    connectionCount: data.connectionCount || 0,
                    photoURL: data.photoURL || prev.photoURL,
                    bannerURL: data.bannerURL || prev.bannerURL
                }));
            }
        }) : () => { };

        fetchProfile();

        const fetchConnectionsList = async () => {
            if (!user) return;
            const { getConnectedUsers } = await import("@/lib/connection-service");
            const { getUserData } = await import("@/lib/startup-service");
            const ids = await getConnectedUsers(user.uid);
            const profiles = await Promise.all(ids.map((id: string) => getUserData(id)));
            setConnectedUsers(profiles.filter(Boolean) as UserData[]);
        };
        fetchConnectionsList();

        return () => unsubUser();
    }, [user]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setSuccess(false);

        try {
            await updateProfile(user, { displayName: formData.displayName });
            await updateDoc(doc(db, "users", user.uid), {
                displayName: formData.displayName,
                about: formData.about,
                skills: formData.skills,
                age: formData.age,
                phone: formData.phone,
                education: formData.education,
                location: formData.location,
                photoURL: formData.photoURL,
                bannerURL: formData.bannerURL,
                socialLinks: formData.socialLinks
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to update profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        setResetSent(true);
        try {
            const auth = getAuth();
            await sendPasswordResetEmail(auth, user.email);
            setTimeout(() => setResetSent(false), 5000);
        } catch (error) {
            console.error("Reset failed:", error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        setLoading(true);
        try {
            const fileName = `${type}_${Date.now()}`;
            const storageRef = ref(storage, `users/${user.uid}/${fileName}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            const field = type === 'avatar' ? 'photoURL' : 'bannerURL';
            await updateDoc(doc(db, "users", user.uid), { [field]: downloadURL });
            if (type === 'avatar') {
                await updateProfile(user, { photoURL: downloadURL });
            }
            setFormData(prev => ({ ...prev, [field]: downloadURL }));
            setSuccess(true);
            setTimeout(() => setSuccess(false), 2000);
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const InputField = ({ label, icon: Icon, name, type = "text", placeholder, disabled }: any) => (
        <div className="space-y-1.5 flex-1 min-w-[180px]">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 pl-1">{label}</label>
            <div className="relative group">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                    type={type}
                    value={(formData as any)[name]}
                    disabled={disabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, [name]: e.target.value }))}
                    className={cn(
                        "w-full pl-9 pr-3 py-2 text-[11px] font-bold rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:border-indigo-500/50 outline-none transition-all",
                        disabled && "bg-zinc-50 dark:bg-zinc-950 text-zinc-400 cursor-not-allowed"
                    )}
                    placeholder={placeholder}
                />
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">
                        Command Hub Identity
                    </div>
                    <h1 className="text-2xl font-black tracking-tighter">Founder Profile</h1>
                    <p className="text-[11px] text-zinc-500 font-medium">Personal intelligence parameters for ecosystem matching.</p>
                </div>
                <div
                    onClick={() => setShowConnections(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-all"
                >
                    <Users className="w-3 h-3" />
                    {formData.connectionCount} Connections
                </div>
            </header>

            <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-6">
                        <div className="flex items-center gap-6 pb-4 border-b border-zinc-50 dark:border-zinc-800">
                            <div className="relative group cursor-pointer">
                                <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                    <img
                                        src={formData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Camera className="w-5 h-5 text-white" />
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} />
                                    </label>
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">Node Status</p>
                                <p className="text-xl font-black text-indigo-500 uppercase">{formData.role}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <InputField label="Display Name" icon={User} name="displayName" placeholder="Username" />
                            <InputField label="Email Address" icon={Mail} name="email" placeholder="example@domain.com" disabled />
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <InputField label="Phone Vector" icon={Phone} name="phone" placeholder="+91 ..." />
                            <InputField label="Cycle Age" icon={Clock} name="age" type="number" placeholder="24" />
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <InputField label="Registry Location" icon={MapPin} name="location" placeholder="City, Country" />
                            <InputField label="Knowledge Hub" icon={GraduationCap} name="education" placeholder="Field of Study" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 pl-1">Strategic Overview</label>
                            <textarea
                                value={formData.about}
                                onChange={(e) => setFormData(prev => ({ ...prev, about: e.target.value }))}
                                rows={3}
                                className="w-full px-4 py-3 text-[11px] font-medium rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:border-indigo-500/50 outline-none transition-all leading-relaxed"
                                placeholder="Vision summary..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 pl-1">Intelligence Specialization</label>
                            <div className="relative group">
                                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 group-focus-within:text-indigo-500" />
                                <input
                                    value={formData.skills}
                                    onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
                                    className="w-full pl-9 pr-3 py-2 text-[11px] font-bold rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:border-indigo-500/50 outline-none transition-all"
                                    placeholder="e.g. AI, Growth, Product..."
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-black text-[11px] hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Synchronize Registry
                            </button>
                            {success && (
                                <p className="text-green-500 font-black text-[9px] uppercase tracking-widest animate-in fade-in">
                                    Logic Persisted
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-6 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xl space-y-4 relative overflow-hidden">
                        <div className="relative z-10 space-y-4">
                            <div>
                                <h3 className="text-lg font-black tracking-tight">Access Credentials</h3>
                                <p className="text-[10px] opacity-60 font-medium">Manage ecosystem encryption.</p>
                            </div>

                            <button
                                type="button"
                                onClick={handlePasswordReset}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 dark:bg-black/5 border border-white/10 dark:border-black/5 hover:bg-white/10 transition-all font-bold text-[11px]"
                            >
                                <div className="flex items-center gap-2">
                                    <Lock className="w-3.5 h-3.5 opacity-60" />
                                    Reset Keys
                                </div>
                                <span className="text-[9px] opacity-50 underline">E-Mail Vector</span>
                            </button>
                            {resetSent && <p className="text-[9px] text-indigo-400 font-bold text-center">Reset link dispatched.</p>}
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 space-y-4 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-500/20 mx-auto">
                            <ShieldCheck className="w-3 h-3" />
                            System Verified
                        </div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">
                            Your node is fully integrated into the founder-flow ecosystem.
                        </p>
                    </div>
                </div>
            </form>

            <AnimatePresence>
                {showConnections && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-8">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowConnections(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 p-8"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black tracking-tight uppercase">Venture Partners</h3>
                                <X onClick={() => setShowConnections(false)} className="w-5 h-5 text-zinc-400 cursor-pointer" />
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {connectedUsers.map((u) => (
                                    <div key={u.uid} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 group transition-all">
                                        <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-10 h-10 rounded-xl object-cover" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold truncate">{u.displayName}</h4>
                                            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{u.role}</p>
                                        </div>
                                    </div>
                                ))}
                                {connectedUsers.length === 0 && (
                                    <p className="py-12 text-center text-[10px] text-zinc-400 font-bold uppercase">No active connections in registry</p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
