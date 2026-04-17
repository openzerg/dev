export interface FrontmatterResult {
  name: string
  description: string
  content: string
}

export function parseFrontmatter(raw: string): FrontmatterResult | null {
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith("---")) return null

  const end = trimmed.indexOf("---", 3)
  if (end === -1) return null

  const frontmatter = trimmed.slice(3, end).trim()
  const content = trimmed.slice(end + 3).trim()

  let name = ""
  let description = ""

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (key === "name") name = val
    else if (key === "description") description = val
  }

  if (!name) return null

  return { name, description, content }
}
