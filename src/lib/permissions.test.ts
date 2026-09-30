import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PERMISSIONS, PERMISSION_KEYS, allowedRevisionTypes, parseDefaultPatch, parseOverridePatch,
  resolvePermissions,
} from "./permissions";

test("all permissions are explicit and existing viewer access is preserved", () => {
  assert.deepEqual(Object.keys(DEFAULT_PERMISSIONS).sort(), [...PERMISSION_KEYS].sort());
  const viewer = resolvePermissions(undefined, undefined, "VIEWER");
  assert.equal(viewer["people.view"], true);
  assert.equal(viewer["tree.view"], true);
  assert.equal(viewer["history.view"], false);
  assert.equal(viewer["people.edit"], false);
  assert.equal(viewer["sources.download"], false);
});

test("individual overrides take precedence and an edit requires its view", () => {
  const permissions = resolvePermissions(
    { ...DEFAULT_PERMISSIONS, "people.view": false, "people.edit": true },
    { "people.edit": "allow", "map.view": "deny", "notes.edit": "allow" },
    "VIEWER",
  );
  assert.equal(permissions["people.edit"], false);
  assert.equal(permissions["notes.edit"], false);
  assert.equal(permissions["map.view"], false);
  assert.equal(permissions["tree.view"], true);
  assert.equal(resolvePermissions(DEFAULT_PERMISSIONS, { "people.view": "allow", "people.edit": "allow" }, "VIEWER")["people.edit"], true);
});

test("administrator cannot be restricted by defaults or individual overrides", () => {
  const allDenied = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, false]));
  const resolved = resolvePermissions(allDenied, { "people.view": "deny" }, "ADMIN");
  assert.ok(PERMISSION_KEYS.every((key) => resolved[key]));
});

test("patch parsers reject unknown keys and invalid values", () => {
  assert.deepEqual(parseDefaultPatch({ "tree.view": false }), { "tree.view": false });
  assert.equal(parseDefaultPatch({ "wrong.view": true }), null);
  assert.equal(parseDefaultPatch({ "tree.view": "false" }), null);
  assert.equal(parseDefaultPatch({}), null);
  assert.deepEqual(parseOverridePatch({ "tree.view": "inherit" }), { "tree.view": "inherit" });
  assert.equal(parseOverridePatch({ "tree.view": true }), null);
  assert.equal(parseOverridePatch({ "admin.role": "allow" }), null);
});

test("history access follows section permissions and protects administrative records", () => {
  const historyOnly = resolvePermissions(
    Object.fromEntries(PERMISSION_KEYS.map((key) => [key, false])),
    { "history.view": "allow" }, "VIEWER",
  );
  assert.deepEqual(allowedRevisionTypes(historyOnly, "VIEWER"), []);
  const people = resolvePermissions(DEFAULT_PERMISSIONS, { "properties.view": "deny", "map.view": "deny" }, "VIEWER");
  const types = allowedRevisionTypes(people, "VIEWER")!;
  assert.ok(types.includes("person"));
  assert.ok(!types.includes("property"));
  assert.ok(!types.includes("place"));
  assert.ok(!types.includes("contact"));
  for (const privateType of ["user", "source_file", "import_run", "import_issue", "permission_policy", "saved_view"]) {
    assert.ok(!types.includes(privateType), privateType);
  }
  const editor = resolvePermissions(DEFAULT_PERMISSIONS, { "people.edit": "allow" }, "VIEWER");
  assert.ok(!allowedRevisionTypes(editor, "VIEWER")!.includes("contact"));
  assert.equal(allowedRevisionTypes(historyOnly, "ADMIN"), null);
});
