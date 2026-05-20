export class ApiResponse<T = unknown> {
  success: boolean = false;
  data?: T;
  message?: string;
  error?: string;

  static ok<T>(data: T, message?: string): ApiResponse<T> {
    return { success: true, data, message };
  }

  static fail(error: string, message?: string): ApiResponse<never> {
    return { success: false, error, message };
  }
}
