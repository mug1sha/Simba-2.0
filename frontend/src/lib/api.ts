const flattenErrorParts = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenErrorParts(item));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.msg === "string") return [record.msg];
    if (typeof record.message === "string") return [record.message];
    if (typeof record.detail === "string") return [record.detail];
    if (record.detail) return flattenErrorParts(record.detail);
    if (record.error) return flattenErrorParts(record.error);
  }
  return [];
};

export const extractErrorMessage = (value: unknown, fallback = "Request failed") => {
  const parts = flattenErrorParts(value).filter(Boolean);
  return parts.length ? parts.join(". ") : fallback;
};

export const readErrorMessage = async (response: Response, fallback = "Request failed") => {
  const data = await response.json().catch(() => null);
  return extractErrorMessage(data, fallback);
};

export const readJsonResponse = async <T>(response: Response, fallback = "Server returned an invalid response") => {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    throw new Error(fallback);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallback);
  }
};
