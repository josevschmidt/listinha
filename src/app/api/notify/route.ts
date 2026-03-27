import { NextRequest, NextResponse } from "next/server";
import { getAdminMessaging } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";

export async function POST(request: NextRequest) {
  try {
    const { itemName, listName, listId, memberIds, senderUid } = await request.json();

    if (!itemName || !listName || !listId || !memberIds || !senderUid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get admin messaging (initializes admin app if needed)
    const messaging = getAdminMessaging();

    // Get Firestore admin instance
    const adminApp = getApps()[0];
    const adminDb = getFirestore(adminApp);

    // Get FCM tokens for all members except the sender
    const recipientIds = (memberIds as string[]).filter((id: string) => id !== senderUid);
    if (recipientIds.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Fetch tokens from fcm_tokens collection
    const tokensSnapshot = await adminDb
      .collection("fcm_tokens")
      .where("userId", "in", recipientIds)
      .get();

    const tokens = tokensSnapshot.docs.map((doc) => doc.data().token as string);
    if (tokens.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Send push notification to all tokens
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: "Listinha",
        body: `Adicionaram ${itemName} na lista ${listName}`,
      },
      webpush: {
        notification: {
          title: "Listinha",
          body: `Adicionaram ${itemName} na lista ${listName}`,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
        },
        data: {
          listId,
        },
      },
    });

    // Clean up invalid tokens
    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (
        !resp.success &&
        resp.error &&
        (resp.error.code === "messaging/invalid-registration-token" ||
          resp.error.code === "messaging/registration-token-not-registered")
      ) {
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length > 0) {
      const batch = adminDb.batch();
      for (const token of invalidTokens) {
        const snap = await adminDb.collection("fcm_tokens").where("token", "==", token).get();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
      }
      await batch.commit();
    }

    return NextResponse.json({
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
