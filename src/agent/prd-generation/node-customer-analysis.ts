import type { OverallStateType } from "../state.js";
import { addSystemMsg } from "../common.js";
import { STEP_EMOJIS } from "../../utils/constants.js";
import { getPromptCustomerAnalysis } from "../prompts/prompt-mini-prd.js";
import { generatePRDSection } from "./prd-utils.js";
import { checkErrorToStopWorkflow } from "../error.js";
import { SemanticCacheFactory } from "../../utils/cache/cache.js";
import { getConfig } from "../../config.js";

const updateStateFromCache = async (state: OverallStateType) => {
  let isCacheHit = false;

  const cacheInst = await SemanticCacheFactory.createInstance();
  const cached = await cacheInst.getCache({
    prompt: `CustomerAnalysis`,
    scope: {
      nodeName: "nodeCustomerAnalysis",
      feature: state.productFeature,
      competitorsListStr: [...state.competitorList].sort().join(","),
    },
  });

  if (cached) {
    const response = cached.response;
    if (response) {
      isCacheHit = true;

      state.prdCustomerAnalysis = response;

      const config = getConfig();
      const lblPrefix = config.LANGCACHE.ENABLED ? "(Langcache)" : "(Cache)";

      await addSystemMsg(
        state,
        `${lblPrefix} Customer Analysis section generated`,
        STEP_EMOJIS.docWriting
      );
    }
  }

  return isCacheHit;
};

const updateState = async (
  state: OverallStateType,
  customerAnalysis: string
) => {
  const cacheInst = await SemanticCacheFactory.createInstance();
  await cacheInst.setCache({
    prompt: `CustomerAnalysis`,
    response: customerAnalysis,
    scope: {
      nodeName: "nodeCustomerAnalysis",
      feature: state.productFeature,
      competitorsListStr: [...state.competitorList].sort().join(","),
    },
  });

  state.prdCustomerAnalysis = customerAnalysis;

  await addSystemMsg(
    state,
    "Customer Analysis section generated",
    STEP_EMOJIS.docWriting
  );
};

const nodeCustomerAnalysis = async (state: OverallStateType) => {
  try {
    const isCacheHit = await updateStateFromCache(state);

    if (!isCacheHit) {
      const customerAnalysis = await generatePRDSection(
        state,
        getPromptCustomerAnalysis,
        "Customer Analysis"
      );

      await updateState(state, customerAnalysis);
    }
  } catch (error) {
    state.error = error;
  }

  checkErrorToStopWorkflow(state);

  return state;
};

export { nodeCustomerAnalysis };
