const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const authoredHtml = [
  "index.html",
  "stories-info.html",
  "poems-info.html",
  "authorToAuthor3D.html",
  "authorToAuthor3DSmall.html",
  "author_info_smaller.html",
  "author_info_smaller_stories.html",
  "custom-icons.html",
  "static/particleDraw.html",
];

test("authored HTML pages do not contain duplicate ids", () => {
  for (const file of authoredHtml) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    assert.deepEqual(duplicates, [], `${file} has duplicate ids: ${duplicates.join(", ")}`);
  }
});

test("local HTML resources exist", () => {
  const htmlFiles = fs.readdirSync(root)
    .filter(file => file.endsWith(".html") && file !== "embeddings.html")
    .concat(["static/particleDraw.html"]);
  const missing = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const reference = match[1].split(/[?#]/)[0];
      if (!reference
        || /^(?:https?:)?\/\//i.test(reference)
        || /^(?:#|data:|mailto:|javascript:)/i.test(reference)
        || reference.includes("{{")
        || reference.startsWith("[[")) continue;
      const resolved = reference.startsWith("/")
        ? path.join(root, reference)
        : path.resolve(path.dirname(path.join(root, file)), reference);
      if (!fs.existsSync(resolved)) missing.push(`${file}: ${reference}`);
    }
  }
  assert.deepEqual(missing, [], `missing resources:\n${missing.join("\n")}`);
});
