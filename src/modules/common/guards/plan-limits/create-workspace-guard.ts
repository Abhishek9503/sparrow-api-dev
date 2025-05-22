import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TeamService } from "@src/modules/identity/services/team.service";

@Injectable()
export class CreateWorkspaceGuard implements CanActivate {
  constructor(
    private readonly teamService: TeamService,
    private readonly configService: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const defaultHubPlan = this.configService.get<string>("app.defaultHubPlan");
    const planLimit = this.configService.get<string>(
      "communityPlan.worksapceLimit",
    );
    const user = request?.user;
    const teamId = request?.body?.id;
    const usersTeamdetails = await this.teamService.get(teamId);
    if (
      usersTeamdetails?.workspaces.length === Number(planLimit) &&
      usersTeamdetails.plan.name === defaultHubPlan
    ) {
      throw new ForbiddenException(
        "Can't create new Workspace, Plan limit reached for this team.",
      );
    }
    return true;
  }
}
