import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PlanService } from '@src/modules/identity/services/plan.service';
import { UserService } from '@src/modules/identity/services/user.service';

@Injectable()
export class CreateTeamGuard implements CanActivate {

    constructor(private readonly planService: PlanService, private readonly userService: UserService) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
  
    const user = request.user;
    const userObject = await this.userService.getUserById(user._id.toString());
    const userPlan = await this.planService.get(userObject.planId.toString());

    const event = userPlan.limits.noOfOwnedHub;
    if (userObject.hubCount >= event.value) {
        throw new ForbiddenException("Cant create new Hubs in community plan");
    }
    return true;
  }
}