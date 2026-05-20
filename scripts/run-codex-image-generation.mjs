#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const USER_PROMPT =
  '첨부한 이미지를 개발새발 세상에서 제일 하찮은 선으로 그려줘. 배경은 흰색, 그림판에서 마우스로 그린것 같은 맞는듯 아닌듯 비슷한듯 아닌듯 아리까리하게 픽셀단위의 그림으로 하찮음을 제대로 뽑내줘. 야 됐고 그냥 니맘대로 그려.';

function isImageFile(name) {
  return /\.(png|jpe?g|webp)$/i.test(name);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCodexHome(env) {
  if (env.CODEX_HOME) {
    return env.CODEX_HOME;
  }
  return path.join(os.homedir(), ".codex");
}

function findSavedPath(candidate, seen = new Set()) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  if (seen.has(candidate)) {
    return null;
  }
  seen.add(candidate);

  if (typeof candidate.saved_path === "string") {
    return candidate.saved_path;
  }
  if (typeof candidate.savedPath === "string") {
    return candidate.savedPath;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const match = findSavedPath(item, seen);
      if (match) {
        return match;
      }
    }
    return null;
  }

  for (const value of Object.values(candidate)) {
    const match = findSavedPath(value, seen);
    if (match) {
      return match;
    }
  }
  return null;
}

function buildPrompt(selectedImagePath) {
  return [
    "You are a backend worker that must generate one new image using the image_generation tool.",
    "Use the attached image as the only visual reference.",
    "Do not edit files other than the generated image artifact managed by Codex.",
    "After generating the image, reply with exactly OK.",
    "",
    `Selected image path: ${selectedImagePath}`,
    `User prompt: ${USER_PROMPT}`
  ].join("\n");
}

async function listGeneratedImages(rootDir) {
  try {
    const sessionDirs = await readdir(rootDir, { withFileTypes: true });
    const files = [];
    for (const sessionDir of sessionDirs) {
      if (!sessionDir.isDirectory()) {
        continue;
      }
      const sessionPath = path.join(rootDir, sessionDir.name);
      const entries = await readdir(sessionPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) {
          continue;
        }
        files.push(path.join(sessionPath, entry.name));
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function pickNewestFile(paths) {
  if (paths.length === 0) {
    return null;
  }
  const withStats = await Promise.all(
    paths.map(async (filePath) => ({
      filePath,
      mtimeMs: (await stat(filePath)).mtimeMs
    })),
  );
  withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return withStats[0]?.filePath || null;
}

async function listGeneratedImagesWithStats(rootDir) {
  const files = await listGeneratedImages(rootDir);
  return await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await stat(filePath)).mtimeMs
    })),
  );
}

async function pickNewestFileSince(rootDir, sinceMs) {
  const entries = await listGeneratedImagesWithStats(rootDir);
  const candidates = entries
    .filter((entry) => entry.mtimeMs >= sinceMs)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.filePath || null;
}

async function runCodex({ codexBin, selectedImagePath, outputPath, cwd, env, timeoutMs }) {
  const args = [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ephemeral",
    "--color",
    "never",
    "-s",
    "read-only",
    "--image",
    selectedImagePath,
    "-o",
    outputPath,
    "-"
  ];

  return await new Promise((resolve, reject) => {
    const child = spawn(codexBin, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error(`codex exec timed out after ${timeoutMs}ms`);
      error.code = "codex_exec_timeout";
      reject(error);
    }, timeoutMs);

    let stdoutBuffer = "";
    let stderr = "";
    const events = [];

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          events.push(JSON.parse(line));
        } catch {
          // Ignore non-JSON lines defensively.
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (stdoutBuffer.trim()) {
        try {
          events.push(JSON.parse(stdoutBuffer.trim()));
        } catch {
          // Ignore trailing non-JSON line.
        }
      }

      if (code !== 0 || signal) {
        reject(
          new Error(
            `codex exec failed with ${signal ? `signal ${signal}` : `exit code ${code}`}\n${stderr}`,
          ),
        );
        return;
      }

      resolve({ events, stderr });
    });

    child.stdin.end(buildPrompt(selectedImagePath));
  });
}

async function main() {
  const startedAtMs = Date.now();
  const cwd = process.cwd();
  const imageDir = path.resolve(process.argv[2] || path.join(cwd, "image-gen"));
  const codexBin = process.env.CODEX_BIN || "codex";
  const env = { ...process.env };
  const timeoutMs = Math.max(60000, Number.parseInt(process.env.CODEX_IMAGE_TIMEOUT_MS || "180000", 10));
  const generatedImagesRoot = path.join(normalizeCodexHome(env), "generated_images");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "codex-image-gen-"));
  const outputPath = path.join(tempDir, "codex-output.json");

  try {
    const dirEntries = await readdir(imageDir, { withFileTypes: true });
    const candidates = dirEntries
      .filter((entry) => entry.isFile() && isImageFile(entry.name))
      .map((entry) => path.join(imageDir, entry.name));

    if (candidates.length === 0) {
      throw new Error(`No image files found in ${imageDir}`);
    }

    const selectedImagePath = pickRandom(candidates);
    const beforeImages = new Set(await listGeneratedImages(generatedImagesRoot));

    let events = [];
    let stderr = "";
    let runError = null;
    try {
      const runResult = await runCodex({
        codexBin,
        selectedImagePath,
        outputPath,
        cwd,
        env,
        timeoutMs
      });
      events = runResult.events;
      stderr = runResult.stderr;
    } catch (error) {
      runError = error;
      stderr = error instanceof Error ? error.message : String(error);
    }

    const threadStartedEvent = events.find(
      (event) => event && event.type === "thread.started" && typeof event.thread_id === "string",
    );
    let generatedImagePath = events.map((event) => findSavedPath(event)).find(Boolean) || null;
    let afterImages = await listGeneratedImages(generatedImagesRoot);
    let newImages = afterImages.filter((filePath) => !beforeImages.has(filePath));

    if (!generatedImagePath && newImages.length === 0 && runError?.code === "codex_exec_timeout") {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await sleep(2000);
        afterImages = await listGeneratedImages(generatedImagesRoot);
        newImages = afterImages.filter((filePath) => !beforeImages.has(filePath));
        if (newImages.length > 0) {
          break;
        }
      }
    }

    generatedImagePath ||=
      (await pickNewestFile(newImages)) ||
      (await pickNewestFileSince(generatedImagesRoot, startedAtMs - 5000)) ||
      null;
    const codexFinalMessage = await readFile(outputPath, "utf8")
      .then((text) => text.trim() || null)
      .catch(() => null);

    if (!generatedImagePath && runError) {
      throw runError;
    }

    const result = {
      ok: true,
      completionStatus: runError ? "image_created_after_timeout" : "completed",
      selectedImagePath,
      prompt: USER_PROMPT,
      timeoutMs,
      threadId: threadStartedEvent?.thread_id || null,
      generatedImagePath,
      generatedImagesDir: generatedImagePath ? path.dirname(generatedImagePath) : generatedImagesRoot,
      codexFinalMessage,
      stderr: stderr.trim() || null
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const failure = {
      ok: false,
      prompt: USER_PROMPT,
      timeoutMs,
      error: error instanceof Error ? error.message : String(error)
    };
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
