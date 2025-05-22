import { Injectable, NotFoundException } from "@nestjs/common";

import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { UserService } from "@src/modules/identity/services/user.service";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly teamsRepo: AdminHubsRepository,
    private readonly userService: UserService,
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
          teams: userTeams,
          teamsAccess: user.teams.length,
          lastActive: userOrg?.lastActive || "",
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
}
