import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

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

  async getDashboardStats(userId: string) {
    try {
      // Get current date and first day of current month
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get teams where user is owner or admin
      const teams = await this.teamsRepo.findTeamsByOwnerOrAdmin(
        userId.toString(),
      );

      if (!teams || teams.length === 0) {
        return {
          users: { total: 0, changeFromLastMonth: 0 },
          hubs: { total: 0, changeFromLastMonth: 0 },
          invites: { total: 0, changeFromLastMonth: 0 },
        };
      }

      // Count totals and changes
      const totalHubs = teams.length;
      const newHubs = teams.filter(
        (team) =>
          team.createdAt && new Date(team.createdAt) >= firstDayThisMonth,
      ).length;

      // Count total users across teams
      const uniqueUsers = new Set();
      const newUsers = new Set();
      let totalInvites = 0;
      let newInvites = 0;

      teams.forEach((team) => {
        // Count users
        (team.users || []).forEach((user: any) => {
          uniqueUsers.add(user.id.toString());

          // Check if user joined this month
          if (user.joinedAt && new Date(user.joinedAt) >= firstDayThisMonth) {
            newUsers.add(user.id.toString());
          }
        });

        // Count invites
        const invites = team.invites || [];
        totalInvites += invites.length;

        // Count new invites
        newInvites += invites.filter(
          (invite: any) =>
            invite.createdAt && new Date(invite.createdAt) >= firstDayThisMonth,
        ).length;
      });

      return {
        users: {
          total: uniqueUsers.size,
          changeFromLastMonth: newUsers.size,
        },
        hubs: {
          total: totalHubs,
          changeFromLastMonth: newHubs,
        },
        invites: {
          total: totalInvites,
          changeFromLastMonth: newInvites,
        },
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw new InternalServerErrorException(
        "Failed to fetch dashboard statistics",
      );
    }
  }
}
