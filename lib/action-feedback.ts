export function actionErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof Error && error.message && !/^(Failed to fetch|Load failed|NetworkError)/i.test(error.message)) return error.message;
  return fallback;
}
