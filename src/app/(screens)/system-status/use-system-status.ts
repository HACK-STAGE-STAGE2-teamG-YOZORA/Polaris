"use client";

import { useCallback, useEffect, useState } from "react";

import { getHealth, getLmStudioStatus } from "@/lib/api/system";
import type { HealthResponse, LmStudioStatus } from "@/types/system";

interface SystemStatusState {
  health: HealthResponse | null;
  lmStudio: LmStudioStatus | null;
  // 初回読み込みと「もう一度確認する」で共通に使う。実行中は再確認ボタンを無効化する
  checking: boolean;
  // アプリサーバー自体へ到達できなかった場合だけ入る。依存先の停止はhealth/lmStudioに載る
  unreachable: boolean;
}

const initialState: SystemStatusState = {
  health: null,
  lmStudio: null,
  checking: true,
  unreachable: false,
};

// 起動確認画面のロジック。GET /system/health と GET /system/lm-studio は
// どちらも認証不要で、依存先が停止していても200を返す契約なので、
// 片方が失敗しても取得できたほうは表示する
export function useSystemStatus() {
  const [state, setState] = useState<SystemStatusState>(initialState);

  const check = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true }));
    const [health, lmStudio] = await Promise.all([
      getHealth().catch(() => null),
      getLmStudioStatus().catch(() => null),
    ]);
    setState({
      health,
      lmStudio,
      checking: false,
      // 両方失敗した場合はアプリサーバー自体が起動していないと判断する
      unreachable: health === null && lmStudio === null,
    });
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { ...state, check };
}
