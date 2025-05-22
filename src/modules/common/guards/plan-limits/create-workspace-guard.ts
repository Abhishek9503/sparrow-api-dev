import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TeamService } from "@src/modules/identity/services/team.service";
import { PlanService } from "@src/modules/identity/services/plan.service";

@Injectable()
export class CreateWorkspaceGuard implements CanActivate {
  constructor(
    private readonly teamService: TeamService,
    private readonly planService: PlanService,
    private readonly configService: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const defaultHubPlan = this.configService.get<string>("app.defaultHubPlan");
    const teamId = request?.body?.id;
    const usersTeamdetails = await this.teamService.get(teamId);
    const teamPlanId = usersTeamdetails?.plan.id;
    const planData = await this.planService.get(teamPlanId.toString());
    if (
      usersTeamdetails?.workspaces.length ===
        Number(planData?.limits?.workspacesPerHub.value) &&
      usersTeamdetails.plan.name === defaultHubPlan
    ) {
      throw new ForbiddenException(
        "Can't create new Workspace, Plan limit reached for this team.",
      );
    }
    return true;
  }
}
