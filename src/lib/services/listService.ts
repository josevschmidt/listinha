import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from "firebase/firestore";

export interface List {
  id: string;
  name: string;
  share_code: string;
  owner_id: string;
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
  subscribeToOwnedLists(userId: string, callback: (lists: List[]) => void) {
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
    });
  },

  // Join a list via share_code
  async joinListByCode(shareCode: string, userId: string) {
    const q = query(collection(db, "lists"), where("share_code", "==", shareCode));
    // Implementation for joining logic will be expanded
  }
};
