import { Injectable, NotFoundException } from "@nestjs/common";

import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { UserService } from "@src/modules/identity/services/user.service";
import { WorkspaceService } from "@src/modules/workspace/services/workspace.service";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly teamsRepo: AdminHubsRepository,
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async getAllUsers(userId: string) {
    const teams = await this.teamsRepo.findBasicTeamsByUserId(userId);

    if (!teams.length) {
      throw new NotFoundException("No teams found for this user");
    }
    const filteredTeams = teams.filter(
      (team) => team?.owner === userId.toString(),
    );
    const uniqueUserMap = new Map<
      string,
      {
        id: string;
        name: string;
        teams: any[];
      }
    >();

    for (const team of filteredTeams) {
      for (const user of team.users) {
        const userIdStr = user.id.toString(); // normalize ObjectId or string
        if (!uniqueUserMap.has(userIdStr)) {
          uniqueUserMap.set(userIdStr, {
            id: userIdStr,
            name: user.name,
            teams: [],
          });
        }
      }
    }

    const uniqueUsers = Array.from(uniqueUserMap.values());

    uniqueUsers.forEach((user) => {
      const userTeams = filteredTeams.filter((team) =>
        team.users.some(
          (teamUser: any) => teamUser.id.toString() === user.id.toString(),
        ),
      );

      // Assign the teams to the user
      user.teams = userTeams;
    });
    // const user = await this.userService.getUserById(userId);
    const newestUniqueUsers = await Promise.all(
      uniqueUsers.map(async (user: any) => {
        const userTeams = user.teams.map((team: any) => {
          const userRole = team.users.find(
            (member: any) => member.id.toString() === user.id.toString(),
          )?.role;

          return {
            id: team._id,
            name: team.name,
            role: userRole,
          };
        });

        const userOrg: any = await this.userService.getUserById(user.id);

        return {
          id: user.id,
          name: user.name,
          email: userOrg.email,
          teams: userTeams,
          teamsAccess: user.teams.length,
          lastActive: userOrg?.lastActive || "",
          joinedOrg: userOrg?.emailVerificationCodeTimeStamp,
        };
      }),
    );

    const updatedFilteredTeams = filteredTeams.map((team) => {
      return {
        name: team.name,
        id: team._id,
        users: team.users,
      };
    });
    return { teams: updatedFilteredTeams, users: newestUniqueUsers };
  }
  async getUserDetails(ownerId: string, userId: string) {
    // Fetch all required data in parallel
    const [teams, userOrg, memberWorkspaces] = await Promise.all([
      this.teamsRepo.findBasicTeamsByUserId(ownerId),
      this.userService.getUserById(userId),
      this.workspaceService.getAllWorkSpaces(userId),
    ]);

    // Validate teams exist
    if (!teams?.length) {
      throw new NotFoundException("No teams found for this user");
    }

    // Filter teams owned by the owner
    const ownerTeams = teams.filter(
      (team) => team?.owner?.toString() === ownerId.toString(),
    );

    // Filter teams where the user is a member
    const userTeams = ownerTeams.filter((team) =>
      team.users?.some(
        (user: any) => user.id?.toString() === userId.toString(),
      ),
    );

    // Build hub details
    const hubDetails = userTeams.map((team) => {
      // Find user in team
      const teamUser = team.users.find(
        (user: any) => user.id?.toString() === userId.toString(),
      );

      // Filter workspaces for this specific team
      const teamWorkspaces = memberWorkspaces.filter(
        (workspace) => workspace.team?.id?.toString() === team._id?.toString(),
      );

      // Build simplified workspaces with user roles
      const simplifiedWorkspaces = teamWorkspaces.map((workspace) => {
        const workspaceUser = workspace.users?.find(
          (user) => user.id?.toString() === userId.toString(),
        );

        return {
          workspace: workspace,
          userRole: workspaceUser?.role || null,
        };
      });

      return {
        id: teamUser.id,
        name: teamUser.name,
        email: teamUser.email,
        teamId: team._id,
        teamName: team.name,
        role: teamUser.role,
        teamJoiningData: teamUser.joinedAt,
        simplifiedWorkspaces: simplifiedWorkspaces,
      };
    });

    return {
      hubDetails: hubDetails,
      userDetails: {
        name: userOrg.name,
        email: userOrg.email,
      },
    };
  }
}
