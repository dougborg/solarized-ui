import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { packageFiles, siteFiles } from "../src/bundle.ts";

async function write(root: string, files: Map<string, Buffer>) {
  await rm(root, { recursive: true, force: true });
  for (const [path, bytes] of files) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), bytes);
  }
  console.log(`Built ${files.size} files in ${root}/`);
}

await write("dist", await packageFiles());
await write("site", await siteFiles());
