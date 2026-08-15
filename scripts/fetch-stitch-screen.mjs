import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stitch } from "@google/stitch-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  const envText = await readFile(join(root, ".env"), "utf8");
  const keyLine = envText.split("\n").find((l) => l.startsWith("X-Goog-Api-Key="));
  if (!keyLine) {
    console.error("Missing X-Goog-Api-Key in .env");
    process.exit(1);
  }
  const apiKey = keyLine.split("=", 2)[1]?.trim();
  if (!apiKey) {
    process.exit(1);
  }

  process.env.STITCH_API_KEY = apiKey;

  const projectId = process.argv[2] || "1429768812508174051";
  /** Gestion des Crédits — Remix Paiements Échelonnés */
  const screenId =
    process.argv[3] || "faa87256c1694837a0109d0b0e6e9819";

  const project = stitch.project(projectId);
  const screen = await project.getScreen(screenId);
  const htmlUrl = await screen.getHtml();
  const imageUrl = await screen.getImage();

  const outDir = join(root, ".stitch-export");
  await mkdir(outDir, { recursive: true });

  const meta = { htmlUrl, imageUrl, projectId, screenId };
  await writeFile(join(outDir, "urls.json"), JSON.stringify(meta, null, 2));

  console.log("Wrote", join(outDir, "urls.json"));
  console.log("htmlUrl:", htmlUrl);
  console.log("imageUrl:", imageUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
