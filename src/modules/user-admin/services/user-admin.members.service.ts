import { Injectable, NotFoundException } from "@nestjs/common";
import { ObjectId } from "mongodb";
import { AdminHubsRepository } from "../repositories/user-admin.hubs.repository";
import { AdminMembersRepository } from "../repositories/user.admin.members.repository";

@Injectable()
export class AdminMembersService {
  constructor(
    private readonly adminHubsRepo: AdminHubsRepository,
    private readonly adminMembersRepo: AdminMembersRepository,
  ) {}

  async getPaginatedHubMembers(
    hubId: string,
    page: number,
    limit: number,
    search: string,
  ) {
    const hub = await this.adminHubsRepo.findHubById(hubId);
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }

    // Get all members
    let members = hub.users || [];

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      members = members.filter(
        (member: any) =>
          member.name?.toLowerCase().includes(searchLower) ||
          member.email?.toLowerCase().includes(searchLower),
      );
    }

    // Get total count for pagination
    const totalCount = members.length;

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedMembers = members.slice(skip, skip + limit);

    // Format each member with the required fields
    const formattedMembers = await Promise.all(
      paginatedMembers.map(async (member: any) => {
        const workspaceAccess =
          await this.adminMembersRepo.countUserWorkspacesByHubId(
            member.id,
            hubId,
          );

        return {
          id: member.id,
          name: member.name || "Unknown",
          email: member.email,
          role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
          workspaceAccess,
          lastActive: "",
        };
      }),
    );

    return {
      members: formattedMembers,
      totalCount,
      hubName: hub.name,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit,
    };
  }

  async getPaginatedHubInvites(
    hubId: string,
    page: number,
    limit: number,
    search: string,
  ) {
    const hub = await this.adminHubsRepo.findHubById(hubId);
    if (!hub) {
      throw new NotFoundException("Hub not found");
    }

    // Get all invites
    let invites = hub.invites || [];

    // Filter by search term if provided
    if (search) {
      const searchLower = search.toLowerCase();
      invites = invites.filter((invite: any) =>
        invite.email?.toLowerCase().includes(searchLower),
      );
    }

    // Get total count for pagination
    const totalCount = invites.length;

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedInvites = invites.slice(skip, skip + limit);

    // Format each invite with the required fields
    const formattedInvites = paginatedInvites.map((invite: any) => ({
      id: invite.inviteId,
      email: invite.email,
      role: invite.role.charAt(0).toUpperCase() + invite.role.slice(1),
      lastInvited: invite.updatedAt,
    }));

    return {
      invites: formattedInvites,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit,
    };
  }

  // Helper method to count workspaces a member has access to
  private countMemberWorkspaces(memberId: string | ObjectId, hub: any): number {
    const memberIdStr = memberId.toString();

    // If we had workspace data in the hub, we could check workspace access
    // For now, we'll assume all members have access to all workspaces
    return hub.workspaces?.length || 0;
  }
}
