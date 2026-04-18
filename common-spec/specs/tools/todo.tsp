import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace TodoTools {

  model TodoItem {
    id: string;
    content: string;
    status: string;
    priority: string;
  }

  model TodoWriteArgs {
    todos: TodoItemInput[];
  }

  model TodoItemInput {
    id?: string;
    content: string;
    status: string;
    priority?: string;
  }

  model TodoReadArgs {}
}
