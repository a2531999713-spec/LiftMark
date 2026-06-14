/* global __dirname */

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const targets = [
  "android/app/.cxx",
  "android/app/build",
  "android/build",
  "android/.gradle",
  "android/.kotlin",
];

for (const relativePath of targets) {
  const target = path.resolve(projectRoot, relativePath);

  if (!target.startsWith(projectRoot + path.sep)) {
    throw new Error(`Refusing to delete outside project root: ${target}`);
  }

  if (!fs.existsSync(target)) {
    console.log(`skip ${relativePath}`);
    continue;
  }

  fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  console.log(`removed ${relativePath}`);
}
