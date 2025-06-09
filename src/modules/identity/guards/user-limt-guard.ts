// user-limit.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { TeamRepository } from "@src/modules/identity/repositories/team.repository";
import { UserLimitService } from "@src/modules/workspace/services/userLimit.service";

@Injectable()
export class UserLimitGuard implements CanActivate {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly userLimitService: UserLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // ✅ Log to debug structure
    console.log("Request body received in guard:", req.body);

    const RequestUser = req.user;

    console.log("This is request use in guard ", RequestUser);

    // Safely extract teamId and emailId
    const teamId = req.body?.teamId;
    const emailId = RequestUser.email;

    console.log("This is team id  in guard ", teamId);
    console.log("This is email id  in guard ", emailId);

    if (!teamId || !emailId) {
      throw new ForbiddenException("Missing teamId or emailId.");
    }

    const teamData = await this.teamRepository.get(teamId);
    if (!teamData || !teamData.users) {
      throw new ForbiddenException("Team not found or invalid.");
    }

    const user = teamData.users.find((u: any) => u.email === emailId);
    if (!user) {
      throw new ForbiddenException("User not found in team.");
    }

    const planName = teamData.plan?.name?.toLowerCase() || "community";

    const status = await this.userLimitService.checkLimitAndLogRequest(
      user.id,
      teamId,
      planName,
    );

    if (status === "LIMIT REACHED") {
      console.log(
        "Limit reached in documentation ===================================================",
      );
      throw new ForbiddenException("Limit reached. Please try again later.");
    }

    return true;
  }
}
