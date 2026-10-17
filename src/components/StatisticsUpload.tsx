import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseUrl, publishableKey } from "../services/supabase";
import { uploadStatistics } from "../services/statisticsUpload";

export function StatisticsUpload({ upload, session }: { upload: any; session: Session }) {
  const busy = useRef(false);
  const attempted = useRef(null);
  const [sending, setSending] = useState(false);
  const allowed = Boolean(session?.user.id);

  useEffect(() => {
    if (!allowed || !upload || upload === attempted.current || busy.current) return;
    busy.current = true;
    attempted.current = upload;
    setSending(true);

    void uploadStatistics(upload.analyses, {
      endpoint: `${supabaseUrl}/functions/v1/ingest-matches`,
      publishableKey,
      bulk: upload.bulk,
      getToken: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session || data.session.user.id !== session.user.id) throw new Error("Your account changed or you signed out. Sign in again before uploading.");
        return data.session.access_token;
      },
    }).then((result) => {
      console.info("[Replay statistics] Upload result:", result);
    }).catch((error) => {
      console.warn("[Replay statistics] Upload failed:", error);
    }).finally(() => {
      busy.current = false;
      setSending(false);
    });
  }, [upload, allowed, session.user.id, sending]);

  return null;
}
