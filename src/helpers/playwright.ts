import { test, type Locator, type Page } from "@playwright/test";

export interface SnapOptions {
  fullPage?: boolean;
  /** Parts that change every run (clock, toasts) — painted over in the screenshot. */
  mask?: Locator[];
}

/**
 * Takes a screenshot and attaches it to the current test under `name`.
 * The testkit report shows these in order as step thumbnails.
 */
export async function snap(page: Page, name: string, options: SnapOptions = {}): Promise<void> {
  const body = await page.screenshot({ fullPage: options.fullPage, mask: options.mask });
  await test.info().attach(name, { body, contentType: "image/png" });
}
