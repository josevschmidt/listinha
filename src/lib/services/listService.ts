import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp
} from "firebase/firestore";

export interface List {
  id: string;
  name: string;
  share_code: string;
  owner_id: string;
  member_ids?: string[];
  created_at: Timestamp | Date;
}

// Generate a random 6-character alphanumeric code
function generateShareCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const listService = {
  // Create a new list
  async createList(name: string, userId: string) {
    const shareCode = `LST-${generateShareCode()}`;
    const listData = {
      name,
      share_code: shareCode,
      owner_id: userId,
      member_ids: [userId],
      created_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "lists"), listData);

    // Auto-join the creator to the list's shared_with subcollection
    await setDoc(doc(db, "lists", docRef.id, "shared_with", userId), {
      joined_at: serverTimestamp()
    });

    return docRef.id;
  },

  // Listen to lists where the user is the owner
  subscribeToOwnedLists(userId: string, callback: (lists: List[], error?: Error) => void) {
    const q = query(
      collection(db, "lists"),
      where("owner_id", "==", userId)
    );

    return onSnapshot(q, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as List[];
      callback(lists);
    }, (error) => {
      console.error("Error subscribing to owned lists:", error);
      callback([], error);
    });
  },

  // Listen to all lists where user is a member (includes owned + shared)
  subscribeToMemberLists(userId: string, callback: (lists: List[], error?: Error) => void) {
    const q = query(
      collection(db, "lists"),
      where("member_ids", "array-contains", userId)
    );

    return onSnapshot(q, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as List[];
      callback(lists);
    }, (error) => {
      console.error("Error subscribing to member lists:", error);
      callback([], error);
    });
  },

  // Join a list via share_code
  async joinListByCode(shareCode: string, userId: string): Promise<{ success: boolean; listId?: string; error?: string }> {
    const normalized = shareCode.trim().toUpperCase();
    const q = query(collection(db, "lists"), where("share_code", "==", normalized));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: "Código não encontrado. Verifique e tente novamente." };
    }

    const listDoc = snapshot.docs[0];
    const listId = listDoc.id;
    const listData = listDoc.data() as List;

    if (listData.member_ids?.includes(userId)) {
      return { success: false, error: "Você já faz parte desta lista.", listId };
    }

    // Add user to member_ids array and to shared_with subcollection
    await updateDoc(doc(db, "lists", listId), {
      member_ids: arrayUnion(userId)
    });

    await setDoc(doc(db, "lists", listId, "shared_with", userId), {
      joined_at: serverTimestamp()
    });

    return { success: true, listId };
  },
};
