import { Injectable, HttpException, HttpStatus, ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';

/**
 * 统一业务异常
 * 使用: throw new BizException(1004, '门店不存在');
 */
export class BizException extends HttpException {
  constructor(code: number, message: string, httpStatus: HttpStatus = HttpStatus.OK) {
    super({ code, message, data: null }, httpStatus);
  }

  getCode(): number {
    const response = this.getResponse() as { code: number };
    return response.code;
  }
}

@Catch(BizException)
export class BizExceptionFilter implements ExceptionFilter {
  catch(exception: BizException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const { code, message } = exception.getResponse() as { code: number; message: string };
    const status = exception.getStatus();

    response.status(status).json({ code, message, data: null });
  }
}
