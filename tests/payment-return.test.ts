import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const envExample = readFileSync(".env.example", "utf8");
const returnRoute = readFileSync("src/app/odeme/donus/route.ts", "utf8");

describe("virtual POS browser return", () => {
  it("does not point the customer-facing callback at the signed webhook", () => {
    // The webhook answers an unsigned browser request with 401 JSON, so the
    // last thing a paying customer saw was an error page.
    const line = envExample
      .split("\n")
      .find((l) => l.includes("IYZICO_CALLBACK_URL=") && !l.startsWith("#   "));
    expect(line).toBeTruthy();
    expect(line).toContain("/odeme/donus");
    expect(line).not.toContain("/api/webhooks/payment");
  });

  it("accepts the provider's form POST", () => {
    expect(returnRoute).toContain("export async function POST");
    expect(returnRoute).toContain("formData()");
  });

  it("asks the provider rather than trusting the returned parameters", () => {
    expect(returnRoute).toContain("provider.confirmReturn");
    // The redirect must be a 303 so the browser turns the POST into a GET.
    expect(returnRoute).toContain("303");
  });
});
