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
    const userTeams = await this.teamService.getAllTeams(user._id.toString());
  
    const ownedTeams = userTeams.filter((team)=>{
      if(team.owner === user._id.toString()) return true;
      return false;
    });
    if(ownedTeams.length === 1 && ownedTeams[0].plan.name === "Community"){
      throw new ForbiddenException("Can't create new Hub, Plan limit reached.");
    }
    return true;
  }
}