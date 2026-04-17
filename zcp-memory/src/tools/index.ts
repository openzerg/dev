import type { IZcpTool } from "@openzerg/zcp"
import type { DB } from "../db.js"
import { createMemorySave } from "./memory-save.js"
import { createMemoryRead } from "./memory-read.js"
import { createMemoryList } from "./memory-list.js"
import { createTodoWrite } from "./todo-write.js"
import { createTodoRead } from "./todo-read.js"

export function createMemoryTools(db: DB): IZcpTool[] {
  return [
    createMemorySave(db),
    createMemoryRead(db),
    createMemoryList(db),
    createTodoWrite(db),
    createTodoRead(db),
  ]
}
