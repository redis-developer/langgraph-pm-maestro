import type { OverallStateType } from "./state.js";

import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const addSystemMsg = async (
  state: OverallStateType,
  msg: string,
  notifyEmoji?: string,
  notifyMsg?: string
) => {
  if (msg) {
    notifyEmoji = notifyEmoji || "";
    notifyMsg = notifyMsg || msg;

    state.messages.push(new SystemMessage(msg));
    if (state.onNotifyProgress) {
      //slack notification
      await state.onNotifyProgress(notifyEmoji + notifyMsg);
    }
  }
};

const createChatPrompt = (systemPrompt: string) => {
  return () => [
    new SystemMessage(systemPrompt),
    new HumanMessage("Please process the above input."), //claude sonnet issue
  ];

  // Original template-based behavior
  // return ChatPromptTemplate.fromMessages([
  //   ["system", systemPrompt],
  //   ["human", "Please process the above input."], //claude sonnet issue
  // ]);
};

export { addSystemMsg, createChatPrompt };
