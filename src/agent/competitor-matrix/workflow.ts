import type { InputStateType, OverallStateType } from "../state.js";

import crypto from "crypto";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import {
  getContextVariable,
  setContextVariable,
} from "@langchain/core/context";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { InputStateAnnotation, OverallStateAnnotation } from "../state.js";
import { nodeCompetitorList } from "./node-competitor-list.js";
import { nodeExtractProductFeature } from "../node-extract-product-feature.js";
import { nodeCompetitorFeatureDetails } from "./node-competitor-feature-details.js";
import { nodeCompetitorTableMatrix } from "./node-competitor-table-matrix.js";
import { nodeCompetitorAnalysisPdf } from "./node-competitor-analysis-pdf.js";
import { toolTavilySearch } from "../tool-tavily-search.js";
import { LANGGRAPH_CONFIG } from "../../utils/constants.js";
import { RedisCheckpointSaver } from "../../utils/redis-checkpoint.js";
import { getConfig } from "../../config.js";

const config = getConfig();

const toolNodeWithGraphState = async (state: OverallStateType) => {
  setContextVariable("currentState", state);

  const toolNodeWithConfig = new ToolNode([toolTavilySearch]);
  const toolResult = await toolNodeWithConfig.invoke(state);

  // Merge the tool's state changes back into the main state
  const toolState = getContextVariable("currentState");
  Object.assign(state, toolState);

  return state;
};

const isToolCall = (state: OverallStateType) => {
  let isToolCall = false;
  if (state.messages?.length) {
    const lastMessage = state.messages[state.messages.length - 1];

    if (
      lastMessage &&
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls?.length
    ) {
      // If we have a tool call, process it
      isToolCall = true;
    }
  }
  return isToolCall;
};

const scFetchCompetitorList = (state: OverallStateType) => {
  //should continue FetchCompetitorList

  let nextNode = "fetchCompetitorFeatureDetails";

  if (isToolCall(state)) {
    nextNode = "tavilySearchCL";
  }

  return nextNode;
};

const scFetchCompetitorFeatureDetails = (state: OverallStateType) => {
  //should continue FetchCompetitorFeatureDetails

  let nextNode = "createCompetitorTableMatrix";

  if (isToolCall(state)) {
    nextNode = "tavilySearchCFD";
  } else if (state.pendingProcessCompetitorList?.length > 0) {
    nextNode = "fetchCompetitorFeatureDetails"; // Continue processing same node
  }
  return nextNode;
};

const getCompetitorSubgraph = () => {
  const graph = new StateGraph({
    stateSchema: OverallStateAnnotation,
  });

  graph
    .addNode("fetchCompetitorList", nodeCompetitorList)
    .addNode("tavilySearchCL", toolNodeWithGraphState)
    .addNode("tavilySearchCFD", toolNodeWithGraphState)
    .addNode("fetchCompetitorFeatureDetails", nodeCompetitorFeatureDetails)
    .addNode("createCompetitorTableMatrix", nodeCompetitorTableMatrix)
    .addNode("createCompetitorAnalysisPdf", nodeCompetitorAnalysisPdf)

    .addEdge(START, "fetchCompetitorList")

    .addConditionalEdges("fetchCompetitorList", scFetchCompetitorList, [
      "tavilySearchCL",
      "fetchCompetitorFeatureDetails",
    ])
    .addEdge("tavilySearchCL", "fetchCompetitorList")

    .addConditionalEdges(
      "fetchCompetitorFeatureDetails",
      scFetchCompetitorFeatureDetails,
      [
        "tavilySearchCFD",
        "fetchCompetitorFeatureDetails",
        "createCompetitorTableMatrix",
      ]
    )
    .addEdge("tavilySearchCFD", "fetchCompetitorFeatureDetails")

    .addEdge("createCompetitorTableMatrix", "createCompetitorAnalysisPdf")
    .addEdge("createCompetitorAnalysisPdf", END);

  return graph;
};

const generateGraph = () => {
  const checkpointer = new RedisCheckpointSaver({
    connectionString: config.REDIS_URL,
    insertRawJson: config.LANGGRAPH.DEBUG_RAW_JSON,
    commonPrefix: config.REDIS_KEYS.ROOT_PREFIX,
    ttl: config.REDIS_KEYS.CACHE_TTL,
  });

  //const checkpointer = new MemorySaver();

  const graph = new StateGraph({
    input: InputStateAnnotation,
    stateSchema: OverallStateAnnotation,
  });

  const competitorSubgraphBuilder = getCompetitorSubgraph();

  graph
    .addNode("extractProductFeature", nodeExtractProductFeature)
    .addNode(
      "competitorSubgraph",
      competitorSubgraphBuilder.compile({
        checkpointer,
      })
    )

    .addEdge(START, "extractProductFeature")
    .addEdge("extractProductFeature", "competitorSubgraph")
    .addEdge("competitorSubgraph", END);

  const finalGraph = graph.compile({
    checkpointer,
  });

  return finalGraph;
};

const compiledGraph = generateGraph(); //compiledGraph for langgraph studio

const runWorkflow = async (input: InputStateType) => {
  const graph = generateGraph();
  const result = await graph.invoke(input, {
    configurable: {
      thread_id: crypto.randomUUID(), //MemorySaver checkpointer requires a thread ID for storing state.
    },
    recursionLimit: LANGGRAPH_CONFIG.RECURSION_LIMIT,
  });
  return result;
};

export { compiledGraph, runWorkflow, getCompetitorSubgraph };
