import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PlanService } from '@src/modules/identity/services/plan.service';
import { TeamService } from '@src/modules/identity/services/team.service';
import { UserService } from '@src/modules/identity/services/user.service';

@Injectable()
export class CreateTeamGuard implements CanActivate {

    constructor(private readonly planService: PlanService, private readonly userService: UserService, private readonly teamService: TeamService) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
  
    const user = request.user;
    const userObject = await this.userService.getUserById(user._id.toString());
    const userTeams = await this.teamService.getAllTeams(user._id.toString());
    const ownedTeam = userTeams.find((team) => {
      if(team.owner === userObject._id.toString()) return true;
      return false;
    });
    
    const userPlan = await this.planService.get(ownedTeam.plan.id.toString());
    
    const event = userPlan.limits.privateHubs;
    if (userObject.hubCount >= event.value) {
        throw new ForbiddenException("Cant create new Hubs in community plan");
    }
    return true;
  }
}