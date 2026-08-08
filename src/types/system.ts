// docs/openapi.yaml の HealthResponse / LmStudioStatus に対応する型定義。
// 起動確認画面（GET /system/health, GET /system/lm-studio）だけが使う。

export type HealthStatus = "OK" | "DEGRADED";

export type DependencyStatus = "UP" | "DOWN";

export interface DependencyHealth {
  status: DependencyStatus;
  message?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  database: DependencyHealth;
  ai: DependencyHealth;
  timestamp: string;
}

// CONNECTED以外はいずれも復旧手順の案内が必要な状態。
// guidanceにサーバー側が組み立てた手順が入る
export type LmStudioConnectionStatus =
  | "CONNECTED"
  | "SERVER_UNREACHABLE"
  | "MODEL_NOT_LOADED"
  | "INVALID_RESPONSE"
  | "INVALID_CONFIGURATION";

export interface LmStudioStatus {
  status: LmStudioConnectionStatus;
  baseUrl: string;
  modelId?: string;
  contextLength?: number;
  checkedAt: string;
  guidance?: string[];
}
