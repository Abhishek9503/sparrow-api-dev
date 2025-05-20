import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { UserDto } from "@src/modules/common/models/workspace.model";

@Injectable()
export class AdminUsersService {
  constructor(private readonly teamsRepo: AdminHubsRepository) {}

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

    for (let i = 0; i < uniqueUsers.length; i++) {
      const id = uniqueUsers[i]?.id?.toString();
      const teams = [];
      for (let j = 0; j < filteredTeams.length; j++) {
        for (let k = 0; k < filteredTeams[j].users.length; k++) {
          if (filteredTeams[j].users[k].id.toString() === id.toString()) {
            teams.push(filteredTeams[j]);
          }
        }
      }
      uniqueUsers[i].teams = teams;
    }

    const newUniqueUsers = uniqueUsers.map((users) => ({
      ...users,
      teamLength: users.teams.length,
    }));
    return { teams: filteredTeams, users: newUniqueUsers };
  }
}
