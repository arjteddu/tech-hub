import { ArgumentsHost, Catch, HttpException, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";

// Wraps Nest's default error formatting to add Sentry reporting — only
// for 5xx. A 404 or a validation 400 is normal traffic, not an incident;
// reporting those would just bury the errors that actually need attention.
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}
