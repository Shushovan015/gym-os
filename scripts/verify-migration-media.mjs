import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

const maxBytes = 64 * 1024 * 1024;
try {
  const [rootPath, manifestPath, digest] = process.argv.slice(2);
  if (process.argv.length !== 5 || !/^[a-f0-9]{64}$/.test(digest) ||
      (await stat(manifestPath)).size > 8 * 1024 * 1024) {
    throw new Error("Usage: node scripts/verify-migration-media.mjs MEDIA_ROOT MANIFEST.json VERIFIED_SHA256");
  }
  const raw = await readFile(manifestPath);
  if (createHash("sha256").update(raw).digest("hex") !== digest) throw new Error("Manifest checksum differs.");
  const manifest = JSON.parse(raw);
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error("Invalid manifest.");
  const root = await realpath(rootPath);
  const rows = [];
  const paths = new Set();
  const names = new Set();
  const hashes = new Set();
  for (const [index, file] of manifest.files.entries()) {
    const row = { entry: index + 1, status: "verified" };
    rows.push(row);
    const path = file?.path;
    if (typeof path !== "string" || !path.split("/").every((part) =>
      part && !/[\\:\x00-\x1f]/.test(part) && !/[. ]$/.test(part) &&
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) ||
      !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > maxBytes ||
      !/^[a-f0-9]{64}$/.test(file.sha256) || !["public", "private"].includes(file.visibility)) {
      row.status = "invalid-entry";
      continue;
    }
    const normalized = path.toLowerCase();
    if (paths.has(normalized)) {
      row.status = "duplicate-path";
      continue;
    }
    paths.add(normalized);
    const name = basename(normalized);
    row.duplicateName = names.has(name);
    names.add(name);
    const candidate = resolve(root, path);
    try {
      const location = await realpath(candidate);
      const fromRoot = relative(root, location);
      if (location !== candidate || !fromRoot || fromRoot === ".." || fromRoot.startsWith(".." + sep) || isAbsolute(fromRoot)) {
        row.status = "unsafe-path";
        continue;
      }
      const info = await lstat(location);
      if (!info.isFile() || info.size !== file.bytes) {
        row.status = "wrong-size-or-type";
        continue;
      }
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(location, { end: file.bytes })) hash.update(chunk);
      if (hash.digest("hex") !== file.sha256) {
        row.status = "checksum-mismatch";
        continue;
      }
      row.duplicateContent = hashes.has(file.sha256);
      hashes.add(file.sha256);
    } catch (error) {
      row.status = error.code === "ENOENT" ? "missing" : "unreadable";
    }
  }
  const valid = rows.every(({ status }) => status === "verified");
  process.stdout.write(JSON.stringify({ valid, entries: rows }, null, 2) + "\n");
  process.exitCode = valid ? 0 : 1;
} catch (error) {
  const messages = ["Manifest checksum differs.", "Invalid manifest."];
  process.stderr.write((messages.includes(error.message) ? error.message : "Could not verify the manifest. Supply a media root, JSON manifest and verified SHA-256.") + "\n");
  process.exitCode = 2;
}
