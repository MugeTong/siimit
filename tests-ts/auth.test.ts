import { describe, expect, test } from "bun:test";

import { encryptCasPassword, extractLoginForm } from "../src/auth";

const exponent = "10001";
const modulus = "c1".repeat(128);

describe("CAS helpers", () => {
  test("extracts hidden form fields", () => {
    const form = extractLoginForm(`<form id="fm1" action="/cas"><input name="execution" value="e1s1"><input name="username"><input name="password"></form>`, "https://sso.test/login");
    expect(form.action).toBe("https://sso.test/cas");
    expect(form.fields.get("execution")).toBe("e1s1");
  });

  test("encrypts deterministically without exposing plaintext", () => {
    const encrypted = encryptCasPassword("secret", exponent, modulus);
    expect(encrypted).toBe(encryptCasPassword("secret", exponent, modulus));
    expect(encrypted).not.toContain("secret");
  });
});

