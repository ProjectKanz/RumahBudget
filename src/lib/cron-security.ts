export function isAuthorizedCronRequest(
  request: Request,
  cronSecret: string | undefined,
) {
  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export function prepareCronResultsForResponse(
  results: readonly Record<string, unknown>[],
  isProduction: boolean,
) {
  if (!isProduction) {
    return results;
  }

  return results.map((result) => {
    const redactedResult = { ...result };
    delete redactedResult.userId;
    return redactedResult;
  });
}
