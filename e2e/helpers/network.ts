import type { Page } from "@playwright/test";

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  timestamp: string;
  requestBody?: unknown;
  responseBody?: unknown;
}

export function startCapture(page: Page, baseUrl: string, entries: NetworkEntry[]) {
  page.on("response", async (res) => {
    const url: string = res.url();
    if (!url.includes("/api/")) return;

    const entry: NetworkEntry = {
      method: res.request().method(),
      url: url.replace(baseUrl, ""),
      status: res.status(),
      timestamp: new Date().toISOString(),
    };

    try {
      const reqBody = res.request().postDataJSON();
      if (reqBody) entry.requestBody = reqBody;
    } catch {}

    try {
      const body = await res.text();
      try { entry.responseBody = JSON.parse(body); } catch {}
    } catch {}

    entries.push(entry);
  });
}
