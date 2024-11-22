import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GoogleOAuthGuard extends AuthGuard("google") {
  handleRequest(err: string, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const error = request.query.error;
    if (error) {
      return error;
    }
    return user;
  }
}
