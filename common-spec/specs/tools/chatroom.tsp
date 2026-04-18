import "@typespec/json-schema";
using TypeSpec.JsonSchema;

@jsonSchema
namespace ChatroomTools {

  model ChatroomInfoArgs {
    chatroomId?: string;
  }

  model MemberInfo {
    memberId: string;
    memberType: string;
    name: string;
  }

  model ChatroomMessageReadArgs {
    chatroomId?: string;

    @maxValue(100)
    limit?: int32;

    before?: int64;
  }

  model ChatroomMessageSendArgs {
    content: string;
    chatroomId?: string;
    mentions?: string[];
    attachmentBase64?: string;
    attachmentName?: string;
    attachmentMimeType?: string;
  }
}
