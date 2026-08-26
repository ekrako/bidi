export const SET_SITE_RTL_THRESHOLD = "setSiteRtlThreshold";

export interface SetSiteRtlThresholdMessage {
  type: typeof SET_SITE_RTL_THRESHOLD;
  hostname: string;
  threshold: number;
}

export interface SetSiteRtlThresholdResponse {
  ok: boolean;
}

export function isSetSiteRtlThresholdMessage(
  message: unknown,
): message is SetSiteRtlThresholdMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<SetSiteRtlThresholdMessage>;
  return (
    candidate.type === SET_SITE_RTL_THRESHOLD &&
    typeof candidate.hostname === "string" &&
    typeof candidate.threshold === "number"
  );
}
