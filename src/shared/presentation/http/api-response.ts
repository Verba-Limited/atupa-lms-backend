export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

export function ok<T>(data: T, message = 'Success'): ApiResponse<T> {
  return { success: true, message, data };
}
