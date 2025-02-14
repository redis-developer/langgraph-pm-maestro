import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

const InputStateAnnotation = Annotation.Root({
  inputText: Annotation<string>,
});

//#region OverallStateAnnotation

const executionStateAnnotation = Annotation.Root({
  toolSystemSalesForceProcessed: Annotation<boolean>,
  toolSystemJiraProcessed: Annotation<boolean>,
});

const CustomerDemandAnalysisAnnotation = Annotation.Root({
  systemSalesForceData: Annotation<any>,
  systemJiraData: Annotation<any>,
});

const EffortEstimationAnnotation = Annotation.Root({
  effortEstimationData: Annotation<any>,
});

const OverallStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  ...InputStateAnnotation.spec,
  productFeature: Annotation<any>,
  ...CustomerDemandAnalysisAnnotation.spec,
  ...EffortEstimationAnnotation.spec,
  ...executionStateAnnotation.spec,
  outputProductPRD: Annotation<any>,
  productPRDFilePath: Annotation<string>,
  error: Annotation<any>,
});
//#endregion
export { InputStateAnnotation, OverallStateAnnotation };

type OverallStateType = typeof OverallStateAnnotation.State;
type InputStateType = typeof InputStateAnnotation.State;

export type { OverallStateType, InputStateType };
