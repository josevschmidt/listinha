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
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";

export interface List {
  id: string;
  name: string;
  share_code: string;
  owner_id: string;
  member_ids?: string[];
  category_order?: string[];
  created_at: Timestamp | Date;
}

export interface MemberInfo {
  uid: string;
  email: string;
  joined_at: Timestamp | Date | null;
}

function generateShareCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const listService = {
  async createList(name: string, userId: string, userEmail = "") {
    const shareCode = `LST-${generateShareCode()}`;
    const docRef = await addDoc(collection(db, "lists"), {
      name,
      share_code: shareCode,
      owner_id: userId,
      member_ids: [userId],
      created_at: serverTimestamp(),
    });
    await setDoc(doc(db, "lists", docRef.id, "shared_with", userId), {
      email: userEmail,
      joined_at: serverTimestamp(),
    });
    return docRef.id;
  },

  subscribeToMemberLists(userId: string, callback: (lists: List[], error?: Error) => void) {
    const q = query(collection(db, "lists"), where("member_ids", "array-contains", userId));
    return onSnapshot(
      q,
      (snapshot) => {
        const lists = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as List[];
        callback(lists);
      },
      (error) => {
        console.error("subscribeToMemberLists error:", error);
        callback([], error);
      }
    );
  },

  async joinListByCode(shareCode: string, userId: string, userEmail = ""): Promise<{ success: boolean; listId?: string; error?: string }> {
    const normalized = shareCode.trim().toUpperCase();
    const snapshot = await getDocs(query(collection(db, "lists"), where("share_code", "==", normalized)));
    if (snapshot.empty) return { success: false, error: "Código não encontrado. Verifique e tente novamente." };
    const listDoc = snapshot.docs[0];
    const listId = listDoc.id;
    const listData = listDoc.data() as List;
    if (listData.member_ids?.includes(userId)) return { success: false, error: "Você já faz parte desta lista.", listId };
    await updateDoc(doc(db, "lists", listId), { member_ids: arrayUnion(userId) });
    await setDoc(doc(db, "lists", listId, "shared_with", userId), { email: userEmail, joined_at: serverTimestamp() });
    return { success: true, listId };
  },

  async renameList(listId: string, newName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await updateDoc(doc(db, "lists", listId), { name: newName.trim() });
      return { success: true };
    } catch {
      return { success: false, error: "Erro ao renomear a lista." };
    }
  },

  async getMembers(listId: string): Promise<MemberInfo[]> {
    try {
      const snapshot = await getDocs(collection(db, "lists", listId, "shared_with"));
      return snapshot.docs.map((d) => ({
        uid: d.id,
        email: (d.data().email as string) || "",
        joined_at: (d.data().joined_at as Timestamp) || null,
      }));
    } catch {
      return [];
    }
  },

  async removeMember(listId: string, memberId: string, ownerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const listSnap = await getDoc(doc(db, "lists", listId));
      if (!listSnap.exists()) return { success: false, error: "Lista não encontrada." };
      const data = listSnap.data() as List;
      if (data.owner_id !== ownerId) return { success: false, error: "Apenas o dono pode remover membros." };
      if (memberId === ownerId) return { success: false, error: "Você não pode remover a si mesmo." };
      await updateDoc(doc(db, "lists", listId), { member_ids: arrayRemove(memberId) });
      await deleteDoc(doc(db, "lists", listId, "shared_with", memberId));
      return { success: true };
    } catch {
      return { success: false, error: "Erro ao remover membro." };
    }
  },

  async duplicateList(sourceListId: string, userId: string, userEmail = ""): Promise<{ success: boolean; listId?: string; error?: string }> {
    try {
      const listSnap = await getDoc(doc(db, "lists", sourceListId));
      if (!listSnap.exists()) return { success: false, error: "Lista não encontrada." };
      const source = listSnap.data() as List;
      const newListId = await this.createList(`${source.name} (cópia)`, userId, userEmail);
      const itemsSnap = await getDocs(collection(db, "lists", sourceListId, "items"));
      await Promise.all(
        itemsSnap.docs.map((itemDoc) => {
          const d = itemDoc.data();
          return addDoc(collection(db, "lists", newListId, "items"), {
            name: d.name,
            status: "pending",
            ...(d.quantity != null && { quantity: d.quantity }),
            ...(d.unit && { unit: d.unit }),
            ...(d.category && { category: d.category }),
            created_at: serverTimestamp(),
          });
        })
      );
      return { success: true, listId: newListId };
    } catch {
      return { success: false, error: "Erro ao duplicar a lista." };
    }
  },

  async deleteList(listId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const listSnap = await getDoc(doc(db, "lists", listId));
      if (!listSnap.exists()) return { success: false, error: "Lista não encontrada." };
      if ((listSnap.data() as List).owner_id !== userId) return { success: false, error: "Apenas o dono pode excluir a lista." };
      const [itemsSnap, sharedSnap] = await Promise.all([
        getDocs(collection(db, "lists", listId, "items")),
        getDocs(collection(db, "lists", listId, "shared_with")),
      ]);
      await Promise.all([
        ...itemsSnap.docs.map((d) => deleteDoc(d.ref)),
        ...sharedSnap.docs.map((d) => deleteDoc(d.ref)),
      ]);
      await deleteDoc(doc(db, "lists", listId));
      return { success: true };
    } catch {
      return { success: false, error: "Erro ao excluir a lista. Tente novamente." };
    }
  },

  async leaveList(listId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await updateDoc(doc(db, "lists", listId), { member_ids: arrayRemove(userId) });
      await deleteDoc(doc(db, "lists", listId, "shared_with", userId));
      return { success: true };
    } catch {
      return { success: false, error: "Erro ao sair da lista." };
    }
  },
};
