import { Injectable, NestMiddleware } from "@nestjs/common";
import { ContextService } from "@src/modules/common/services/context.service";

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly contextService: ContextService) {}

  use(req: Request, res: Response, next: any) {
    this.contextService.run(() => {
      next();
    });
  }
}
