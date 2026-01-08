export interface APIError {
  code: string;
  message: string;
  suggestedAction?: string;
}

export const ERROR_MESSAGES = {
  NETWORK_TIMEOUT: 'The request timed out. Please check your connection and try again.',
  CONNECTION_ERROR: 'Unable to connect to the server. Please try again later.',
  ANALYSIS_ABORTED: 'Analysis was cancelled.',
  INVALID_RESPONSE: 'Received an invalid response from the server.',
};

export const VALIDATION_ERRORS = {
  INVALID_URL: 'Please enter a valid URL starting with http:// or https://',
  TEXT_TOO_LONG: 'Text exceeds the maximum limit of 10,000 characters',
  EMPTY_INPUT: 'Please enter a URL or text to analyze',
};
