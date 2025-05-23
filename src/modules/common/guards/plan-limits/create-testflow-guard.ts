import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";
import { PlanService } from "@src/modules/identity/services/plan.service";

@Injectable()
export class CreateTestflowGuard implements CanActivate {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly configService: ConfigService,
    private readonly planService: PlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const defaultHubPlan = this.configService.get<string>("app.defaultHubPlan");
    const userWorkspaceId = request?.body?.workspaceId;
    const workspaceDetails = await this.workspaceService.get(userWorkspaceId);
    const planData = await this.planService.get(
      workspaceDetails?.plan?.id.toString(),
    );
    if (
      workspaceDetails?.testflows?.length ===
      Number(planData?.limits?.testflowPerHub?.value)
    ) {
      throw new ForbiddenException(
        "Can't create new Testflow, Plan limit reached for this Workspace.",
      );
    }
    return true;
  }
}
