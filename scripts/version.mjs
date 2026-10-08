import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    encoding: "utf8",
  }).trim() !== "";
writeFileSync(
  "dist/version.json",
  JSON.stringify(
    { commit, dirty, builtAt: new Date().toISOString() },
    null,
    2,
  ) + "\n",
);
