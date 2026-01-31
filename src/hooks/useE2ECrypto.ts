import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrCreateKeyPair,
  exportPublicKey,
  importPublicKey,
  encryptMessage,
  decryptMessage,
  EncryptedPayload,
} from "@/lib/e2eCrypto";

/**
 * React hook to manage E2E encryption keys and provide encrypt/decrypt helpers.
 */
export function useE2ECrypto(userId: string | undefined) {
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize key pair on mount, publish public key to Supabase
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      try {
        const kp = await getOrCreateKeyPair();
        if (cancelled) return;
        setKeyPair(kp);

        const pubKeyB64 = await exportPublicKey(kp.publicKey);

        // Upsert public key to Supabase
        const { error } = await (supabase as any)
          .from("user_public_keys")
          .upsert({ user_id: userId, public_key: pubKeyB64 }, { onConflict: "user_id" });

        if (error) {
          console.error("Failed to publish public key:", error);
        }

        setReady(true);
      } catch (err) {
        console.error("E2E crypto init error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Fetch the public key for a given user.
   */
  const fetchPublicKey = useCallback(async (targetUserId: string): Promise<CryptoKey | null> => {
    const { data, error } = await (supabase as any)
      .from("user_public_keys")
      .select("public_key")
      .eq("user_id", targetUserId)
      .single();

    if (error || !data?.public_key) {
      console.error("Failed to fetch public key for user", targetUserId, error);
      return null;
    }

    return importPublicKey(data.public_key as string);
  }, []);

  /**
   * Encrypt a message for a recipient.
   */
  const encrypt = useCallback(
    async (plaintext: string, recipientUserId: string): Promise<EncryptedPayload | null> => {
      if (!keyPair) return null;
      const recipientPubKey = await fetchPublicKey(recipientUserId);
      if (!recipientPubKey) return null;
      return encryptMessage(plaintext, keyPair.privateKey, recipientPubKey);
    },
    [keyPair, fetchPublicKey]
  );

  /**
   * Decrypt a message from a sender.
   */
  const decrypt = useCallback(
    async (payload: EncryptedPayload, senderUserId: string): Promise<string | null> => {
      if (!keyPair) return null;
      const senderPubKey = await fetchPublicKey(senderUserId);
      if (!senderPubKey) return null;
      try {
        return await decryptMessage(payload, keyPair.privateKey, senderPubKey);
      } catch (err) {
        console.error("Decryption failed:", err);
        return null;
      }
    },
    [keyPair, fetchPublicKey]
  );

  return { ready, encrypt, decrypt };
}
