import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

const HTTP_MESSAGES: Partial<Record<number, string>> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  402: 'Pagamento necessário',
  403: 'Acesso negado',
  404: 'Recurso não encontrado',
  409: 'Conflito com estado atual',
  422: 'Dados inválidos',
  429: 'Muitas requisições',
  500: 'Erro interno do servidor',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno do servidor';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const specificMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message?: string }).message ?? '';
      // Use specific message when provided, fall back to generic HTTP label
      message = specificMessage || HTTP_MESSAGES[status] || message;
      details =
        typeof exceptionResponse === 'object' ? exceptionResponse : undefined;
    } else {
      this.logger.error('Erro não tratado:', exception);
      if (process.env['NODE_ENV'] !== 'production') {
        message = exception instanceof Error ? exception.message : String(exception);
        details = exception instanceof Error ? { stack: exception.stack } : undefined;
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
