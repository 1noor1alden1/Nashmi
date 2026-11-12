export class WorkflowError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function workflowFailure(error: unknown) {
  if (error instanceof WorkflowError) {
    return { status: error.status, error: error.code, message: error.message };
  }
  return { status: 500, error: "server_error", message: "حدث خطأ في الخادم" };
}
