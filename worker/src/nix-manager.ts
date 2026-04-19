import { mkdirSync, writeFileSync, existsSync, rmSync, lstatSync } from "node:fs"
import { join } from "node:path"
import { ResultAsync, ok, err, type Result } from "neverthrow"
import { InternalError, type AppError } from "@openzerg/common"

const PROFILE_DIR = process.env.NIX_PROFILE_DIR || "/opt/nix-profile"
const PROFILE_BIN = join(PROFILE_DIR, "bin")
const WORKER_STATE_DIR = process.env.WORKER_STATE_DIR || "/tmp/openzerg-worker-state"
const ENV_SH_PATH = join(WORKER_STATE_DIR, "env.sh")

function nixBin(): string {
  return process.env.NIX_BIN || "nix"
}

function checkNixAvailable(): ResultAsync<void, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const proc = Bun.spawn([nixBin(), "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      })
      const code = await proc.exited
      if (code !== 0) throw new Error("nix not available")
    })(),
    () => new InternalError("nix not available"),
  )
}

function buildEnvSh(): ResultAsync<void, AppError> {
  const lines: string[] = ["#!/bin/sh"]

  if (existsSync(PROFILE_BIN)) {
    lines.push(`export PATH="${PROFILE_BIN}:\${PATH}"`)
  }

  const libDir = join(PROFILE_DIR, "lib")
  if (existsSync(libDir)) {
    lines.push(`export LD_LIBRARY_PATH="${libDir}:\${LD_LIBRARY_PATH:-}"`)
    lines.push(`export LIBRARY_PATH="${libDir}:\${LIBRARY_PATH:-}"`)
  }

  const pkgConfigDir = join(PROFILE_DIR, "lib", "pkgconfig")
  if (existsSync(pkgConfigDir)) {
    lines.push(`export PKG_CONFIG_PATH="${pkgConfigDir}:\${PKG_CONFIG_PATH:-}"`)
  }

  const includeDir = join(PROFILE_DIR, "include")
  if (existsSync(includeDir)) {
    lines.push(`export C_INCLUDE_PATH="${includeDir}:\${C_INCLUDE_PATH:-}"`)
    lines.push(`export CPLUS_INCLUDE_PATH="${includeDir}:\${CPLUS_INCLUDE_PATH:-}"`)
  }

  return ResultAsync.fromPromise(
    (async () => {
      mkdirSync(WORKER_STATE_DIR, { recursive: true })
      writeFileSync(ENV_SH_PATH, lines.join("\n") + "\n")
      if (!process.env.PATH!.includes(PROFILE_BIN) && existsSync(PROFILE_BIN)) {
        process.env.PATH = `${PROFILE_BIN}:${process.env.PATH}`
      }
    })(),
    (e) => new InternalError(e instanceof Error ? e.message : String(e)),
  )
}

export interface EnsurePackagesResult {
  installed: string[]
  failed: string[]
}

export function ensurePackages(pkgs: string[]): ResultAsync<EnsurePackagesResult, AppError> {
  if (pkgs.length === 0) {
    return ResultAsync.fromSafePromise(Promise.resolve({ installed: [] as string[], failed: [] as string[] }))
  }

  return ResultAsync.fromPromise(
    new Promise<void>((resolve, reject) => {
      try {
        if (existsSync(PROFILE_DIR)) {
          const st = lstatSync(PROFILE_DIR)
          if (st.isDirectory() && !st.isSymbolicLink()) {
            rmSync(PROFILE_DIR, { recursive: true, force: true })
          }
        }
        resolve()
      } catch (e) {
        reject(e)
      }
    }),
    () => new InternalError("profile dir cleanup failed"),
  )
    .orElse(() => ok(undefined as void))
    .andThen(() => checkNixAvailable().orElse(() => err(new InternalError("nix not available"))))
    .andThen(() => checkNixAvailable())
    .andThen(() => installAll(pkgs))
    .andThen((result: EnsurePackagesResult) =>
      buildEnvSh()
        .map(() => result)
        .orElse(() => ok(result) as Result<EnsurePackagesResult, AppError>)
    )
}

function installAll(pkgs: string[]): ResultAsync<EnsurePackagesResult, AppError> {
  return ResultAsync.fromPromise(
    (async (): Promise<EnsurePackagesResult> => {
      const installed: string[] = []
      const failed: string[] = []

      for (const pkg of pkgs) {
        const nixPkg = pkg.includes("#") ? pkg : `nixpkgs#${pkg}`
        const installResult = await installOne(nixPkg)
        const resolved = installResult.isOk() ? installResult.value : "failed"
        if (resolved === "installed") installed.push(pkg)
        else failed.push(pkg)
      }

      return { installed, failed }
    })(),
    (e) => new InternalError(e instanceof Error ? e.message : String(e)),
  )
}

function installOne(nixPkg: string): ResultAsync<"installed" | "failed", AppError> {
  return ResultAsync.fromPromise(
    (async (): Promise<"installed" | "failed"> => {
      const proc = Bun.spawn([
        nixBin(), "profile", "install",
        "--profile", PROFILE_DIR,
        nixPkg,
      ], {
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      })
      await proc.exited
      if (proc.exitCode === 0) return "installed"
      const stderr = await new Response(proc.stderr).text()
      if (stderr.includes("already exists") || stderr.includes("already")) return "installed"
      console.error(`[nix-manager] failed to install ${nixPkg}: ${stderr.slice(0, 200)}`)
      return "failed"
    })(),
    (e) => {
      console.error(`[nix-manager] error installing ${nixPkg}:`, e)
      return new InternalError(e instanceof Error ? e.message : String(e))
    },
  ).orElse(() => ok("failed" as const))
}

export function getEnvShPath(): string {
  return ENV_SH_PATH
}

export function getProfileBin(): string {
  return PROFILE_BIN
}
