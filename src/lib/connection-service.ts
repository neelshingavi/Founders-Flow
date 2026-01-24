import { db } from "./firebase";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    Timestamp,
    limit,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDoc
} from "firebase/firestore";
import { Connection, ConnectionStatus } from "./types/connection";
export type { ConnectionStatus };

// Shape of an individual social connection request (used in dashboards & profile)
export interface ConnectionRequest {
    id: string;
    fromId: string;
    toId: string;
    status: "pending" | "accepted" | "rejected";
    createdAt?: Timestamp | null;
}

// Collection for social/matching connections between users
const SOCIAL_CONNECTIONS_COLLECTION = "connections";
const CONNECTION_REQUESTS_COLLECTION = "connection_requests";

// Collection for project-scoped deals (Investor-Founder)
const PROJECT_CONNECTIONS_COLLECTION = "project_connections";

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT-SCOPED CONNECTIONS (DEAL FLOW)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ensures a project-scoped connection exists between an investor and founder.
 */
export async function getOrCreateConnection(
    investorId: string,
    founderId: string,
    projectId: string,
    metadata?: Connection["metadata"]
): Promise<string> {
    const q = query(
        collection(db, PROJECT_CONNECTIONS_COLLECTION),
        where("investorId", "==", investorId),
        where("founderId", "==", founderId),
        where("projectId", "==", projectId),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        return snapshot.docs[0].id;
    }

    const now = Timestamp.now();
    const newConnection: Omit<Connection, "connectionId"> = {
        investorId,
        founderId,
        projectId,
        status: "ACTIVE",
        createdAt: now,
        lastActivityAt: now,
        metadata
    };

    const docRef = await addDoc(collection(db, PROJECT_CONNECTIONS_COLLECTION), newConnection);
    return docRef.id;
}

/**
 * Get all active project connections for a user.
 */
export async function getConnectionsForUser(userId: string, role: "INVESTOR" | "FOUNDER"): Promise<Connection[]> {
    const field = role === "INVESTOR" ? "investorId" : "founderId";
    const q = query(
        collection(db, PROJECT_CONNECTIONS_COLLECTION),
        where(field, "==", userId),
        orderBy("lastActivityAt", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ connectionId: d.id, ...d.data() } as Connection));
}

/**
 * Update the last activity timestamp on a project connection.
 */
export async function updateConnectionActivity(connectionId: string): Promise<void> {
    const docRef = doc(db, PROJECT_CONNECTIONS_COLLECTION, connectionId);
    await updateDoc(docRef, {
        lastActivityAt: Timestamp.now()
    });
}

/**
 * Verify if a project connection is active.
 */
export async function isConnectionActive(connectionId: string): Promise<boolean> {
    const docRef = doc(db, PROJECT_CONNECTIONS_COLLECTION, connectionId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;
    return (snap.data() as Connection).status === "ACTIVE";
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL CONNECTIONS (MATCHING SYSTEM)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sends a connection request from one user to another.
 */
export async function sendConnectionRequest(fromId: string, toId: string) {
    return await addDoc(collection(db, CONNECTION_REQUESTS_COLLECTION), {
        from: fromId,
        to: toId,
        status: "pending",
        createdAt: serverTimestamp()
    });
}

/**
 * Subscribe to incoming pending connection requests for a target user.
 * Used by the founder dashboard to render notifications.
 */
export function getConnectionRequests(
    userId: string,
    callback: (reqs: ConnectionRequest[]) => void
) {
    const q = query(
        collection(db, CONNECTION_REQUESTS_COLLECTION),
        where("to", "==", userId),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const requests: ConnectionRequest[] = snapshot.docs.map((d) => {
            const data = d.data() as any;
            return {
                id: d.id,
                fromId: data.from,
                toId: data.to,
                status: data.status ?? "pending",
                createdAt: data.createdAt ?? null
            };
        });
        callback(requests);
    });
}

/**
 * Accept a pending connection request and materialize a social connection.
 */
export async function acceptConnectionRequest(
    requestId: string,
    fromId: string,
    toId: string
): Promise<void> {
    // 1. Mark request as accepted
    const reqRef = doc(db, CONNECTION_REQUESTS_COLLECTION, requestId);
    await updateDoc(reqRef, {
        status: "accepted",
        respondedAt: serverTimestamp()
    });

    // 2. Create (or reuse) a social connection document
    const existing = await getDocs(
        query(
            collection(db, SOCIAL_CONNECTIONS_COLLECTION),
            where("users", "array-contains", fromId)
        )
    );

    const alreadyConnected = existing.docs.some((d) => {
        const users = (d.data() as any).users as string[] | undefined;
        return users && users.includes(fromId) && users.includes(toId);
    });

    if (!alreadyConnected) {
        await addDoc(collection(db, SOCIAL_CONNECTIONS_COLLECTION), {
            users: [fromId, toId],
            status: "ACTIVE" satisfies ConnectionStatus,
            createdAt: serverTimestamp()
        });
    }
}

/**
 * Reject / dismiss a pending connection request.
 */
export async function rejectConnectionRequest(requestId: string): Promise<void> {
    const reqRef = doc(db, CONNECTION_REQUESTS_COLLECTION, requestId);
    await updateDoc(reqRef, {
        status: "rejected",
        respondedAt: serverTimestamp()
    });
}

/**
 * Gets the IDs of all users the specified user is connected to.
 */
export async function getConnectedUsers(userId: string): Promise<string[]> {

    const q = query(
        collection(db, SOCIAL_CONNECTIONS_COLLECTION),
        where("users", "array-contains", userId)
    );

    const snapshot = await getDocs(q);
    const connectedIds: string[] = [];

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const otherId = data.users.find((id: string) => id !== userId);
        if (otherId) connectedIds.push(otherId);
    });

    return connectedIds;
}

/**
 * Subscribes to real-time sent requests for a user.
 */
export function getSentRequests(userId: string, callback: (ids: string[]) => void) {
    const q = query(
        collection(db, CONNECTION_REQUESTS_COLLECTION),
        where("from", "==", userId),
        where("status", "==", "pending")
    );

    return onSnapshot(q, (snapshot) => {
        const ids = snapshot.docs.map(doc => doc.data().to);
        callback(ids);
    });
}

/**
 * Subscribes to the real-time connected users list.
 * Merges logic for social connections.
 */
export function getConnectedUsersSnapshot(userId: string, callback: (ids: string[]) => void) {
    const q = query(
        collection(db, SOCIAL_CONNECTIONS_COLLECTION),
        where("users", "array-contains", userId)
    );

    return onSnapshot(q, (snapshot) => {
        const connectedIds: string[] = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const otherId = data.users.find((id: string) => id !== userId);
            if (otherId) connectedIds.push(otherId);
        });
        callback(connectedIds);
    });
}
