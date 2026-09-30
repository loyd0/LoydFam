import assert from "node:assert/strict";
import test from "node:test";
import { hasMediaSignature, mediaPathname, mediaUrl } from "./media-url";

const personId = "00000000-0000-4000-8000-000000000001";

test("mediaUrl builds only same-origin id-based links", () => {
  assert.equal(mediaUrl("a/b"), "/api/media/a%2Fb");
  assert.equal(mediaUrl("abc", { download: true }), "/api/media/abc?download=1");
});

test("mediaPathname scopes supported upload keys to their person", () => {
  assert.deepEqual(
    mediaPathname(personId, `media/${personId}/00000000-0000-4000-8000-000000000002.pdf`),
    { extension: "pdf", mimeType: "application/pdf" },
  );
  assert.equal(mediaPathname(personId, "https://elsewhere.example/file.pdf"), null);
  assert.equal(mediaPathname(personId, `media/another-person/00000000-0000-4000-8000-000000000002.pdf`), null);
  assert.equal(mediaPathname(personId, `media/${personId}/../../file.pdf`), null);
});

test("media signatures reject content that does not match its declared type", () => {
  assert.equal(hasMediaSignature(new TextEncoder().encode("%PDF-1.7"), "application/pdf"), true);
  assert.equal(hasMediaSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
  assert.equal(hasMediaSignature(new TextEncoder().encode("not a pdf"), "application/pdf"), false);
  assert.equal(hasMediaSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"), true);
});
