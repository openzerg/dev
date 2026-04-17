import { join } from "node:path"

export async function gitClone(gitUrl: string, targetDir: string): Promise<void> {
  const proc = Bun.spawn(["git", "clone", gitUrl, targetDir], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`git clone failed (exit ${exitCode}): ${stderr}`)
  }
}

export async function gitPull(dir: string): Promise<void> {
  const proc = Bun.spawn(["git", "pull"], {
    cwd: dir,
    stderr: "pipe",
    stdout: "pipe",
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`git pull failed (exit ${exitCode}): ${stderr}`)
  }
}

export async function gitRevParse(dir: string): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
    cwd: dir,
    stdout: "pipe",
    stderr: "pipe",
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`git rev-parse failed (exit ${exitCode}): ${stderr}`)
  }
  const stdout = await new Response(proc.stdout).text()
  return stdout.trim()
}
