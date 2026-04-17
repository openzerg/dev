export function loadConfig() {
  return {
    port: parseInt(process.env.PORT ?? "15345", 10),
    databaseURL: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/registry",
    skillsDir: process.env.SKILLS_DIR ?? "/data/skills",
  }
}
