import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { UserService } from "@src/modules/identity/services/user.service";
import { AdminUpdatesRepository } from "../repositories/user-admin.updates.repository";
import { ObjectId } from "mongodb";
import { AdminMembersRepository } from "../repositories/user-admin.members.repository";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly teamsRepo: AdminHubsRepository,
    private readonly userService: UserService,
    private readonly adminUpdatesRepository: AdminUpdatesRepository,
    private readonly adminUserRepository: AdminMembersRepository,
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

      // Count users per hub (if a user appears in multiple hubs, count them multiple times)
      let totalUsers = 0;
      let newUsers = 0;
      let totalInvites = 0;
      let newInvites = 0;

      teams.forEach((team) => {
        // Count users in each hub
        (team.users || []).forEach((user: any) => {
          totalUsers++;

          // Check if user joined this month
          if (user.joinedAt && new Date(user.joinedAt) >= firstDayThisMonth) {
            newUsers++;
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
          total: totalUsers,
          changeFromLastMonth: newUsers,
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

  /**
   * Get activity records for all users in the admin's teams
   */

  async getUserActivities(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    activities: any[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      // Find all teams where the user is owner or admin
      const teams = await this.teamsRepo.findTeamsByOwnerOrAdmin(userId);

      if (!teams || teams.length === 0) {
        return {
          activities: [],
          totalCount: 0,
          currentPage: page,
          totalPages: 0,
          limit: limit,
        };
      }

      // Extract all team members' user IDs
      const teamUserIds = new Set<string>();
      teams.forEach((team) => {
        (team.users || []).forEach((user) => {
          if (user.id) {
            teamUserIds.add(user.id.toString());
          }
        });
      });

      // Extract all workspace IDs from these teams
      const workspaceIds = new Set<string>();
      teams.forEach((team) => {
        (team.workspaces || []).forEach((workspace) => {
          if (workspace.id) {
            workspaceIds.add(workspace.id.toString());
          }
        });
      });

      // Convert user IDs to ObjectIds for MongoDB query
      const userObjectIds = [];
      for (const id of teamUserIds) {
        try {
          userObjectIds.push(new ObjectId(id));
        } catch (e) {
          console.warn(`Invalid ObjectId format: ${id}`);
        }
      }

      // Build the query for updates repository
      const query: any = {};
      if (userObjectIds.length > 0 && workspaceIds.size > 0) {
        query.$or = [
          { createdBy: { $in: userObjectIds } },
          { workspaceId: { $in: Array.from(workspaceIds) } },
        ];
      } else if (userObjectIds.length > 0) {
        query.createdBy = { $in: userObjectIds };
      } else if (workspaceIds.size > 0) {
        query.workspaceId = { $in: Array.from(workspaceIds) };
      } else {
        return {
          activities: [],
          totalCount: 0,
          currentPage: page,
          totalPages: 0,
          limit: limit,
        };
      }

      // Fetch updates using simplified repository method
      const { updates, total } = await this.adminUpdatesRepository.findUpdates(
        query,
        page,
        limit,
      );

      // Extract unique creator IDs from the updates
      const uniqueUserIds = new Set<string>();
      updates.forEach((update) => {
        if (update.createdBy) {
          uniqueUserIds.add(update.createdBy.toString());
        }
      });

      // Fetch user details for those IDs
      const userObjectIdsToFetch = Array.from(uniqueUserIds)
        .map((id) => {
          try {
            return new ObjectId(id);
          } catch (e) {
            console.warn(`Invalid user ObjectId: ${id}`);
            return null;
          }
        })
        .filter(Boolean);

      const users =
        await this.adminUserRepository.findUsersByIds(userObjectIdsToFetch);

      // Create a user lookup map in the service
      const userMap: { [userId: string]: any } = {};
      users.forEach((user) => {
        userMap[user._id.toString()] = {
          _id: user._id,
          name: user.name,
          email: user.email,
        };
      });

      // Attach user info to each update in the service
      const activities = updates.map((update) => {
        const userId = update.createdBy ? update.createdBy.toString() : null;
        return {
          ...update,
          user: userId && userMap[userId] ? userMap[userId] : null,
        };
      });

      return {
        activities,
        totalCount: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      console.error("Error fetching user activities:", error);
      throw new InternalServerErrorException("Failed to fetch user activities");
    }
  }

  /**
   * Get user distribution data for pie chart visualization
   * @param userId The admin user ID
   * @returns Formatted data for user distribution pie chart
   */
  async getUserDistribution(userId: string) {
    const teams = await this.teamsRepo.findTeamsByUserId(userId);

    if (!teams.data.length) {
      throw new NotFoundException("No teams found for this user");
    }

    // Count user roles per hub - if a user appears in multiple hubs, count them multiple times
    let adminCount = 0;
    let memberCount = 0;

    // Count each user in each hub
    for (const hub of teams.data) {
      for (const user of hub.users) {
        const role =
          user.role === "owner" || user.role === "admin" ? "admin" : "member";

        if (role === "admin") {
          adminCount++;
        } else {
          memberCount++;
        }
      }
    }

    // Format for pie chart with percentages
    return [
      {
        label: "Admin",
        value: adminCount,
        color: "#2B9ACA",
      },
      {
        label: "Members",
        value: memberCount,
        color: "#CA2689",
      },
    ];
  }

  /**
   * Get user role trend data for line graph visualization
   */
  async getUserRoleTrends(userId: string) {
    try {
      // Get all teams where the user is owner or admin
      const teams = await this.teamsRepo.findTeamsByUserId(userId);

      if (!teams.data || teams.data.length === 0) {
        throw new NotFoundException("No teams found for this user");
      }

      // Generate dates for the past 11 months plus current month's 1st day and today
      const datePoints = [];
      const now = new Date();

      // Add first day of each month for the past 11 months
      for (let i = 11; i >= 1; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        datePoints.push({
          date: month.toISOString().slice(0, 10), // Format as YYYY-MM-DD
          month: month,
        });
      }

      // Add first day of current month
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      datePoints.push({
        date: firstDayThisMonth.toISOString().slice(0, 10),
        month: firstDayThisMonth,
      });

      // Add today as the final data point
      datePoints.push({
        date: now.toISOString().slice(0, 10),
        month: now,
      });

      // Initialize result structure with two series (Admin and Member)
      const adminSeries = {
        name: "Admin",
        color: "#30A5D6",
        data: datePoints.map((dp) => ({
          date: dp.date,
          value: 0,
        })),
      };

      const memberSeries = {
        name: "Member",
        color: "#E5259B",
        data: datePoints.map((dp) => ({
          date: dp.date,
          value: 0,
        })),
      };

      // Rest of the function remains the same...
      datePoints.forEach((dp, index) => {
        // existing logic for counting users at each date point
        let adminCount = 0;
        let memberCount = 0;

        // Loop through each team
        for (const team of teams.data) {
          // existing team counting logic...

          // Get team creation date
          const teamCreatedAt = team.createdAt
            ? new Date(team.createdAt)
            : null;

          // Only include teams that existed by this date point
          if (!teamCreatedAt || teamCreatedAt > dp.month) {
            continue;
          }

          // Count users in this team/hub
          for (const user of team.users || []) {
            // existing user counting logic...

            // Get user join date (default to team creation if not specified)
            const userJoinedAt = user.joinedAt
              ? new Date(user.joinedAt)
              : teamCreatedAt;

            // Only count users who had joined by this date point
            if (userJoinedAt && userJoinedAt <= dp.month) {
              const role =
                user.role === "owner" || user.role === "admin"
                  ? "admin"
                  : "member";

              if (role === "admin") {
                adminCount++;
              } else {
                memberCount++;
              }
            }
          }
        }

        // Update the series data
        adminSeries.data[index].value = adminCount;
        memberSeries.data[index].value = memberCount;
      });

      return {
        series: [adminSeries, memberSeries],
      };
    } catch (error) {
      console.error("Error generating user role trend data:", error);
      throw new InternalServerErrorException("Failed to generate trend data");
    }
  }
}
