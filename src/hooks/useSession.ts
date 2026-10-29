"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/client/api";
import type { SessionStatus } from "@/lib/types";

interface SessionState {
  data: SessionStatus | null;
  error: string | null;
}

export function useSession() {
  const [state, setState] = useState<SessionState>({ data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    apiGet<SessionStatus>("/api/session", ctrl.signal).then(
      (data) => setState({ data, error: null }),
      (error: unknown) => {
        if (!ctrl.signal.aborted) setState({ data: null, error: error instanceof Error ? error.message : "상태를 불러오지 못했습니다." });
      },
    );
    return () => ctrl.abort();
  }, [version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, refresh };
}
