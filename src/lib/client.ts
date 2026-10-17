/** Browser-side API helper. Sends cookies and bounces to login on 401. */
export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (response.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "ডেটা আনা যায়নি।");
  }
  return (await response.json()) as T;
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("unauthorized");
  }

  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    errors?: Record<string, string>;
  };

  if (!response.ok) {
    const error = new Error(data.error ?? "অনুরোধ ব্যর্থ হয়েছে।") as Error & {
      errors?: Record<string, string>;
    };
    error.errors = data.errors;
    throw error;
  }

  return data as T;
}
