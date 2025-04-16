import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { TeamRepository } from "../repositories/team.repository";
import {
  AddTeamUserDto,
  CreateOrUpdateTeamUserDto,
  SelectedWorkspaces,
  TeamInviteMailDto,
} from "../payloads/teamUser.payload";
import { ObjectId, WithId } from "mongodb";
import { ContextService } from "@src/modules/common/services/context.service";
import { UserRepository } from "../repositories/user.repository";
import { TOPIC } from "@src/modules/common/enum/topic.enum";
import { Invite, Team } from "@src/modules/common/models/team.model";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";
import { TeamRole } from "@src/modules/common/enum/roles.enum";
import { TeamService } from "./team.service";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "@src/modules/common/services/email.service";
import { TeamDto } from "../payloads/team.payload";
import { v4 as uuidv4 } from "uuid";
import { UserInvitesRepository } from "../repositories/userInvites.repository";
import { threadId } from "worker_threads";
/**
 * Team User Service
 */
@Injectable()
export class TeamUserService {
  constructor(
    private readonly teamRepository: TeamRepository,
    private readonly UserInvitesRepository: UserInvitesRepository,
    private readonly contextService: ContextService,
    private readonly userRepository: UserRepository,
    private readonly producerService: ProducerService,
    private readonly teamService: TeamService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async HasPermissionToRemove(
    payload: CreateOrUpdateTeamUserDto,
    teamData: Team,
  ): Promise<boolean> {
    const currentUser = this.contextService.get("user");
    if (payload.userId === teamData.owner) {
      throw new BadRequestException("You cannot remove Owner");
    } else if (currentUser._id.toString() === teamData.owner) {
      return true;
    } else if (teamData.admins.includes(currentUser._id.toString())) {
      return true;
    }
    throw new BadRequestException("You don't have access");
  }

  async isUserTeamMember(
    userId: string,
    userArray: Array<any>,
  ): Promise<boolean> {
    for (const item of userArray) {
      if (item.id.toString() === userId && item.role !== TeamRole.MEMBER) {
        throw new BadRequestException(
          "User is already the admin or owner of Team",
        );
      } else if (item.id.toString() === userId) {
        return true;
      }
    }
    throw new BadRequestException(
      "User is not part of team, first add user in Team",
    );
  }

  async inviteUserInTeamEmail(payload: TeamInviteMailDto, role: string) {
    const currentUser = await this.contextService.get("user");
    const transporter = this.emailService.createTransporter();
    const promiseArray = [];
    for (const user of payload.users) {
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: user.email,
        text: "User Invited",
        template: "inviteTeamEmail",
        context: {
          firstname: user.name.split(" ")[0],
          username: currentUser.name.split(" ")[0],
          teamname: payload.teamName,
          role: role.charAt(0).toUpperCase() + role.slice(1),
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
        },
        subject: `${user.name} Just Joined Your Sparrow Hub!”`,
      };
      promiseArray.push(this.emailService.sendEmail(transporter, mailOptions));
    }
    await Promise.all(promiseArray);
  }

  /**
   * Add a new user in the team
   * @param {CreateOrUpdateTeamUserDto} payload
   * @returns {Promise<InsertOneWriteOpResult<Team>>} result of the insert operation
   */
  async addUser(payload: AddTeamUserDto): Promise<object> {
    const teamFilter = new ObjectId(payload.teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamFilter);
    const usersExist = [];
    const usersNotExist = [];
    const alreadyTeamMember = [];
    for (const emailId of payload.users) {
      const user = await this.userRepository.getUserByEmail(
        emailId.toLowerCase(),
      );
      if (user) {
        const teamMember = await this.teamService.isTeamMember(
          user._id.toString(),
          teamData.users,
        );
        if (!teamMember) {
          usersExist.push(user);
        } else {
          alreadyTeamMember.push(emailId);
        }
      } else {
        usersNotExist.push(emailId);
      }
    }
    // await this.teamService.isTeamOwnerOrAdmin(teamFilter);
    const teamUsers = [...teamData.users];
    const teamAdmins = [...teamData.admins];
    for (const userData of usersExist) {
      teamUsers.push({
        id: userData._id.toString(),
        email: userData.email.toLowerCase(),
        name: userData.name,
        role:
          payload.role === TeamRole.ADMIN ? TeamRole.ADMIN : TeamRole.MEMBER,
      });
      const userTeams = [...userData.teams];
      const userWorkspaces = [...userData.workspaces];
      userTeams.push({
        id: new ObjectId(payload.teamId),
        name: teamData.name,
        role:
          payload.role === TeamRole.ADMIN ? TeamRole.ADMIN : TeamRole.MEMBER,
        isNewInvite: true,
      });
      if (payload.role === TeamRole.ADMIN) {
        teamAdmins.push(userData._id.toString());
        for (const item of teamData.workspaces) {
          userWorkspaces.push({
            teamId: payload.teamId,
            workspaceId: item.id.toString(),
            name: item.name,
          });
        }
      } else {
        for (const item of payload.workspaces) {
          userWorkspaces.push({
            teamId: payload.teamId,
            workspaceId: item.id.toString(),
            name: item.name,
          });
        }
      }
      const updatedTeamParams = {
        users: teamUsers,
        admins: teamAdmins,
      };
      const teamWorkspaces =
        payload.role === TeamRole.ADMIN
          ? [...teamData.workspaces]
          : payload.workspaces;
      const message = {
        teamWorkspaces: teamWorkspaces,
        userId: userData._id,
        role: payload.role,
      };
      await this.producerService.produce(TOPIC.USER_ADDED_TO_TEAM_TOPIC, {
        value: JSON.stringify(message),
      });
      const updateUserParams = {
        teams: userTeams,
        workspaces: userWorkspaces,
      };
      await this.userRepository.updateUserById(userData._id, updateUserParams);

      await this.teamRepository.updateTeamById(teamFilter, updatedTeamParams);
    }
    await this.inviteUserInTeamEmail(
      {
        users: usersExist,
        teamName: teamData.name,
      },
      payload.role,
    );
    const response = {
      nonExistingUsers: usersNotExist,
      alreadyTeamMember: alreadyTeamMember,
    };
    return response;
  }

  async removeUser(payload: CreateOrUpdateTeamUserDto): Promise<WithId<Team>> {
    const teamFilter = new ObjectId(payload.teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamFilter);
    const userFilter = new ObjectId(payload.userId);
    const userData = await this.userRepository.findUserByUserId(userFilter);
    const teamAdmins = [...teamData.admins];
    await this.HasPermissionToRemove(payload, teamData);
    let userTeamRole;
    for (const item of userData.teams) {
      if (item.id.toString() === payload.teamId) {
        userTeamRole = item.role;
      }
    }
    const teamUser = [...teamData.users];
    let filteredAdmin;
    const filteredData = teamUser.filter(
      (item) => item.id.toString() !== payload.userId.toString(),
    );
    if (userTeamRole === TeamRole.ADMIN) {
      filteredAdmin = teamAdmins.filter(
        (id: string) => id.toString() !== payload.userId.toString(),
      );
    }
    const teamUpdatedParams = {
      users: filteredData,
      admins: userTeamRole === TeamRole.ADMIN ? filteredAdmin : teamAdmins,
    };
    const userTeams = [...userData.teams];
    const userFilteredTeams = userTeams.filter(
      (item) => item.id.toString() !== payload.teamId.toString(),
    );
    const userFilteredWorkspaces = userData.workspaces.filter(
      (workspace) => workspace.teamId !== payload.teamId,
    );
    const userUpdatedParams = {
      teams: userFilteredTeams,
      workspaces: userFilteredWorkspaces,
    };
    await this.userRepository.updateUserById(userFilter, userUpdatedParams);
    const teamWorkspaces = [...teamData.workspaces];

    const message = {
      teamWorkspaces: teamWorkspaces,
      userId: userData._id.toString(),
      role: userTeamRole,
    };
    await this.producerService.produce(TOPIC.USER_REMOVED_FROM_TEAM_TOPIC, {
      value: JSON.stringify(message),
    });
    const data = await this.teamRepository.updateTeamById(
      teamFilter,
      teamUpdatedParams,
    );

    const ownerDetails = await this.getOwnerDetails(
      teamData.owner,
      teamData.users,
    );

    await this.removeUserEmail(
      userData.name,
      teamData.name,
      ownerDetails.name.split(" ")[0],
      ownerDetails.email,
    );
    return data;
  }

  async addAdmin(payload: CreateOrUpdateTeamUserDto): Promise<WithId<Team>> {
    const teamFilter = new ObjectId(payload.teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamFilter);
    const teamAdmins = [...teamData.admins];
    await this.teamService.isTeamOwnerOrAdmin(new ObjectId(payload.teamId));
    await this.isUserTeamMember(payload.userId, teamData.users);
    teamAdmins.push(payload.userId);
    const teamUsers = teamData.users;
    for (let index = 0; index < teamUsers.length; index++) {
      if (teamUsers[index].id === payload.userId) {
        teamUsers[index].role = TeamRole.ADMIN;
      }
    }
    const updatedTeamData = {
      admins: teamAdmins,
      users: teamUsers,
    };
    const user = await this.userRepository.getUserById(payload.userId);
    for (let index = 0; index < user.teams.length; index++) {
      if (user.teams[index].id.toString() === payload.teamId) {
        user.teams[index].role = TeamRole.ADMIN;
      }
    }
    for (let index = 0; index < teamData.workspaces.length; index++) {
      let count = 0;
      for (let flag = 0; flag < user.workspaces.length; flag++) {
        if (
          teamData.workspaces[index].id.toString() !==
          user.workspaces[flag].workspaceId
        ) {
          count++;
        }
      }
      if (count === user.workspaces.length) {
        user.workspaces.push({
          workspaceId: teamData.workspaces[index].id.toString(),
          teamId: teamData._id.toString(),
          name: teamData.workspaces[index].name,
        });
      }
    }
    const message = {
      userId: payload.userId,
      teamWorkspaces: teamData.workspaces,
    };
    const response = await this.teamRepository.updateTeamById(
      teamFilter,
      updatedTeamData,
    );
    await this.userRepository.updateUserById(
      new ObjectId(payload.userId),
      user,
    );
    await this.producerService.produce(TOPIC.TEAM_ADMIN_ADDED_TOPIC, {
      value: JSON.stringify(message),
    });

    const userDetails = await this.userRepository.getUserById(payload.userId);

    const role = TeamRole.ADMIN;
    await this.addAdminEmail(
      teamData.name,
      userDetails.name.split(" ")[0],
      userDetails.email,
      role,
    );

    return response;
  }

  async demoteTeamAdmin(
    payload: CreateOrUpdateTeamUserDto,
  ): Promise<WithId<Team>> {
    const teamData = await this.teamRepository.findTeamByTeamId(
      new ObjectId(payload.teamId),
    );
    await this.teamService.isTeamOwnerOrAdmin(new ObjectId(payload.teamId));
    const updatedTeamAdmins = teamData.admins.filter(
      (id) => id !== payload.userId,
    );
    const teamUsers = [...teamData.users];
    for (let index = 0; index < teamUsers.length; index++) {
      if (teamUsers[index].id === payload.userId) {
        teamUsers[index].role = TeamRole.MEMBER;
      }
    }
    const updatedTeamParams = {
      admins: updatedTeamAdmins,
      users: teamUsers,
    };
    const userData = await this.userRepository.getUserById(payload.userId);
    const userTeams = [...userData.teams];
    for (let index = 0; index < userTeams.length; index++) {
      if (userTeams[index].id.toString() === payload.teamId) {
        userTeams[index].role = TeamRole.MEMBER;
      }
    }
    const updatedUserParams = {
      teams: userTeams,
    };
    await this.userRepository.updateUserById(
      new ObjectId(payload.userId),
      updatedUserParams,
    );
    const response = await this.teamRepository.updateTeamById(
      new ObjectId(payload.teamId),
      updatedTeamParams,
    );
    const message = {
      userId: payload.userId,
      teamWorkspaces: teamData.workspaces,
    };
    await this.producerService.produce(TOPIC.TEAM_ADMIN_DEMOTED_TOPIC, {
      value: JSON.stringify(message),
    });

    const userDetails = await this.userRepository.getUserById(payload.userId);

    const role = TeamRole.MEMBER;
    await this.demoteTeamAdminEmail(
      teamData.name,
      userDetails.name,
      userDetails.email,
      role,
    );
    return response;
  }

  async isTeamAdmin(payload: CreateOrUpdateTeamUserDto): Promise<boolean> {
    const teamDetails = await this.teamRepository.findTeamByTeamId(
      new ObjectId(payload.teamId),
    );
    if (teamDetails.admins.includes(payload.userId)) {
      return true;
    } else if (teamDetails.owner === payload.userId) {
      throw new BadRequestException(
        "You cannot transfer ownership to yourself",
      );
    }
    return false;
  }

  /**
   * Get owner details by ID.
   * @param {string} ownerId - The ID of the owner.
   * @param {any[]} users - Array of users.
   * @returns {Promise<{ email: string; name: string } | null>} Owner details or null if not found.
   */
  async getOwnerDetails(
    ownerId: string,
    users: any[],
  ): Promise<{ email: string; name: string } | null> {
    for (const user of users) {
      if (user.id.toString() === ownerId.toString()) {
        return { email: user.email, name: user.name };
      }
    }
    return null;
  }

  /**
   * Change the owner of a team.
   * @param {CreateOrUpdateTeamUserDto} payload - The payload containing team and user information.
   * @returns {Promise<any>} The response from the team update operation.
   * @throws {BadRequestException} If the user does not have access or is not an admin.
   */

  async changeOwner(payload: CreateOrUpdateTeamUserDto) {
    const user = await this.contextService.get("user");
    const teamOwner = await this.teamService.isTeamOwner(payload.teamId);
    if (!teamOwner) {
      throw new BadRequestException("You don't have access");
    }
    const currentUserAdmin = await this.isTeamAdmin(payload);
    if (!currentUserAdmin) {
      throw new BadRequestException("Only existing admin can become owner");
    }
    const teamDetails = await this.teamRepository.findTeamByTeamId(
      new ObjectId(payload.teamId),
    );

    const prevOwner = teamDetails.owner;
    const teamMember = await this.teamService.isTeamMember(
      payload.userId,
      teamDetails.users,
    );
    if (!teamMember) {
      throw new BadRequestException(
        "User is not part of team, first add user in Team",
      );
    }
    const teamUsers = [...teamDetails.users];
    for (let index = 0; index < teamUsers.length; index++) {
      if (teamUsers[index].id.toString() === user._id.toString()) {
        teamUsers[index].role = TeamRole.ADMIN;
      } else if (teamUsers[index].id.toString() === payload.userId) {
        teamUsers[index].role = TeamRole.OWNER;
      }
    }
    const teamAdmins = [...teamDetails.admins];
    const filteredAdmin = teamAdmins.filter(
      (adminId) => adminId !== payload.userId,
    );
    filteredAdmin.push(user._id.toString());
    const updatedTeamParams = {
      users: teamUsers,
      admins: filteredAdmin,
      owner: payload.userId,
    };
    const response = await this.teamRepository.updateTeamById(
      new ObjectId(payload.teamId),
      updatedTeamParams,
    );
    const prevOwnerUserDetails = await this.userRepository.getUserById(
      user._id.toString(),
    );
    const currentOwnerUserDetails = await this.userRepository.getUserById(
      payload.userId,
    );

    const prevOwnerUserTeams = [...prevOwnerUserDetails.teams];
    for (let index = 0; index < prevOwnerUserTeams.length; index++) {
      if (prevOwnerUserTeams[index].id.toString() === payload.teamId) {
        prevOwnerUserTeams[index].role = TeamRole.ADMIN;
      }
    }
    const currentOwnerUserTeams = [...currentOwnerUserDetails.teams];
    for (let index = 0; index < currentOwnerUserTeams.length; index++) {
      if (currentOwnerUserTeams[index].id.toString() === payload.teamId) {
        currentOwnerUserTeams[index].role = TeamRole.OWNER;
      }
    }
    const prevOwnerUpdatedParams = {
      teams: prevOwnerUserTeams,
    };

    await this.userRepository.updateUserById(
      new ObjectId(user._id),
      prevOwnerUpdatedParams,
    );
    const currentOwnerUpdatedParams = {
      teams: currentOwnerUserTeams,
    };
    await this.userRepository.updateUserById(
      new ObjectId(payload.userId),
      currentOwnerUpdatedParams,
    );

    const prevOwnerDetails = await this.userRepository.getUserById(prevOwner);

    const newOwnerDetails = await this.userRepository.getUserById(
      payload.userId,
    );

    //Old Owner Email
    await this.oldOwnerEmail(
      teamDetails.name,
      prevOwnerDetails.name.split(" ")[0],
      prevOwnerDetails.email,
    );

    //New owner Email
    await this.newOwnerEmail(
      teamDetails.name,
      newOwnerDetails.name.split(" ")[0],
      newOwnerDetails.email,
    );

    return response;
  }

  async leaveTeam(teamId: string) {
    const teamOwner = await this.teamService.isTeamOwner(teamId);
    if (teamOwner) {
      throw new BadRequestException("Owner cannot leave team");
    }
    const user = await this.contextService.get("user");
    const adminDto = {
      teamId: teamId,
      userId: user._id.toString(),
    };
    const teamAdmin = await this.isTeamAdmin(adminDto);
    const teamData = await this.teamRepository.findTeamByTeamId(
      new ObjectId(teamId),
    );
    const userData = await this.userRepository.findUserByUserId(user._id);
    const teamAdmins = [...teamData.admins];
    const teamUser = [...teamData.users];
    let filteredAdmin;
    const filteredUser = teamUser.filter(
      (item) => item.id.toString() !== user._id.toString(),
    );
    if (teamAdmin) {
      filteredAdmin = teamAdmins.filter(
        (id: string) => id.toString() !== user._id.toString(),
      );
    }
    const teamUpdatedParams = {
      users: filteredUser,
      admins: teamAdmin ? filteredAdmin : teamAdmins,
    };
    const userTeams = [...userData.teams];
    const userFilteredTeams = userTeams.filter(
      (item) => item.id.toString() !== teamId,
    );
    const userFilteredWorkspaces = userData.workspaces.filter(
      (workspace) => workspace.teamId !== teamId,
    );
    const userUpdatedParams = {
      teams: userFilteredTeams,
      workspaces: userFilteredWorkspaces,
    };
    await this.userRepository.updateUserById(user._id, userUpdatedParams);
    const teamWorkspaces = [...teamData.workspaces];

    const message = {
      teamWorkspaces: teamWorkspaces,
      userId: userData._id.toString(),
      role: teamAdmin ? TeamRole.ADMIN : TeamRole.MEMBER,
    };
    await this.producerService.produce(TOPIC.USER_REMOVED_FROM_TEAM_TOPIC, {
      value: JSON.stringify(message),
    });
    const data = await this.teamRepository.updateTeamById(
      new ObjectId(teamId),
      teamUpdatedParams,
    );

    const ownerDetails = await this.getOwnerDetails(
      teamData.owner,
      teamData.users,
    );

    await this.leaveTeamEmail(
      userData.name,
      teamData.name,
      ownerDetails.name.split(" ")[0],
      ownerDetails.email,
    );

    return data;
  }

  /**
   * Send an email when a user leaves a team.
   * @param {string} MemberName - The name of the member leaving the team.
   * @param {string} teamName - The name of the team.
   * @param {string} OwnerName - The name of the owner.
   * @param {string} email - The email address to send the notification to.
   * @returns {Promise<void>}
   */
  async leaveTeamEmail(
    MemberName: string,
    teamName: string,
    OwnerName: string,
    email: string,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Leaving Team",
      template: "leaveTeamEmail",
      context: {
        ownerName: OwnerName,
        memberName: MemberName,
        teamName: teamName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Hub Member Update: ${MemberName} has left from ${teamName} hub`,
    };

    await this.emailService.sendEmail(transporter, mailOptions);
  }

  /**
   * Send an email when a user is removed from a team.
   * @param {string} MemberName - The name of the member removed from the team.
   * @param {string} teamName - The name of the team.
   * @param {string} OwnerName - The name of the owner.
   * @param {string} email - The email address to send the notification to.
   * @returns {Promise<void>}
   */
  async removeUserEmail(
    MemberName: string,
    teamName: string,
    OwnerName: string,
    email: string,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "User removed",
      template: "removeUserEmail",
      context: {
        ownerName: OwnerName,
        memberName: MemberName,
        teamName: teamName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Hub Member Update: ${MemberName} has been removed from ${teamName} hub`,
    };
    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * Send an email to the old owner when ownership is transferred.
   * @param {string} teamName - The name of the team.
   * @param {string} OwnerName - The name of the old owner.
   * @param {string} email - The email address of old owner to send the notification to.
   * @returns {Promise<void>}
   */
  async oldOwnerEmail(
    teamName: string,
    OwnerName: string,
    email: string,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Owner Notification",
      template: "oldOwnerEmail",
      context: {
        ownerName: OwnerName,
        teamName: teamName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Ownership of ${teamName} hub is transferred `,
    };
    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * Send an email to the new owner when ownership is transferred.
   * @param {string} teamName - The name of the team.
   * @param {string} OwnerName - The name of the new owner.
   * @param {string} email - The email address of new owner  to send the notification to.
   * @returns {Promise<void>}
   */
  async newOwnerEmail(
    teamName: string,
    OwnerName: string,
    email: string,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Owner Notification",
      template: "newOwnerEmail",
      context: {
        ownerName: OwnerName,
        teamName: teamName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
      },
      subject: `Congratulations! You Are Now the Owner of ${teamName} hub.`,
    };
    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * Sends an email notification to a user when their admin role in a team is demoted.
   *
   * @param {string} teamName - The name of the team from which the user is being demoted.
   * @param {string} userName - The name of the user who is being demoted.
   * @param {string} email - The email address of the user who is being demoted.
   * @param {string} role - The role of the user who is being promoted.
   * @returns {Promise<void>} A promise that resolves when the email has been sent.
   *
   * @throws {Error} Throws an error if there is an issue with sending the email.
   */
  async demoteTeamAdminEmail(
    teamName: string,
    userName: string,
    email: string,
    role?: string,
  ): Promise<void> {
    const transporter = this.emailService.createTransporter();
    const sender = this.contextService.get("user");
    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Demote Admin Notification",
      template: "demoteTeamAdminEmail",
      context: {
        teamName: teamName,
        userName: userName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
        role: role,
        senderName: sender.name,
      },
      subject: `Your Role in ${teamName} on Sparrow Has Been Updated`,
    };

    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * Sends an email notification to a user when they are promoted to an admin role in a team.
   *
   * @param {string} teamName - The name of the team to which the user is being promoted.
   * @param {string} userName - The name of the user who is being promoted.
   * @param {string} email - The email address of the user who is being promoted.
   * @param {string} role - The role of the user who is being promoted.
   * @returns {Promise<void>} A promise that resolves when the email has been sent.
   *
   * @throws {Error} Throws an error if there is an issue with sending the email.
   */
  async addAdminEmail(
    teamName: string,
    userName: string,
    email: string,
    role?: string,
  ): Promise<void> {
    const sender = this.contextService.get("user");
    const transporter = this.emailService.createTransporter();

    const mailOptions = {
      from: this.configService.get("app.senderEmail"),
      to: email,
      text: "Promote Member Email",
      template: "addTeamAdminEmail",
      context: {
        teamName: teamName,
        userName: userName,
        sparrowEmail: this.configService.get("support.sparrowEmail"),
        sparrowWebsite: this.configService.get("support.sparrowWebsite"),
        sparrowWebsiteName: this.configService.get(
          "support.sparrowWebsiteName",
        ),
        role: role,
        senderName: sender.name,
      },
      subject: `Your Role in ${teamName} on Sparrow Has Been Updated`,
    };

    const promise = [this.emailService.sendEmail(transporter, mailOptions)];
    await Promise.all(promise);
  }

  /**
   * This will create Invite in the Owner's Team of that Particular user.
   *
   * @param {string} email - This is the Email receive Invitation.
   * @param {string} role - The Role select by the Inviter.
   * @param {ObjectId} teamId - We will send this TeamId a Invite
   * @param {ObjectId} senderId - We will send this TeamId a Invite
   *
   */
  async createInvite(
    email: string,
    role: string,
    workspaces: SelectedWorkspaces[],
    teamId: string,
  ) {
    const teamFilter = new ObjectId(teamId);
    const userData = await this.userRepository.getUserByEmail(email);

    const team = await this.teamRepository.get(teamFilter.toString());
    if (!team) {
      return "Team not Found";
    }
    const now = new Date();
    const inviteId = uuidv4();
    const expiresAt = new Date(now);
    expiresAt.setDate(now.getDate() + 7);

    const sender = this.contextService.get("user");

    // need to check, if user already exist in the team
    // add your code here
    const teamMember = team.users.some((user) => {
      if (user.email === email) {
        return true;
      }
      return false;
    });
    if (teamMember) {
      throw new BadRequestException("Team Member already Exist.");
    }

    // need to check, if user already exist in the invites array
    if (team.invites) {
      const emailAlreadyInvited = team.invites.some(
        (invite) => invite.email === email,
      );

      if (emailAlreadyInvited) {
        throw new BadRequestException(
          "An invite has already been sent to this email.",
        );
      }
    }

    const userInvite = {
      inviteId,
      email: email,
      name: userData?.name || email,
      role,
      createdAt: now,
      updatedAt: now,
      createdBy: sender._id,
      updatedBy: sender._id,
      workspaces,
      expiresAt,
      isAccepted: false, // used for non registered user
    };

    // update user model with teamId
    // add your code here

    const updatedInvites = [...(team.invites || []), userInvite];
    const updatedData: Partial<TeamDto> = {
      invites: updatedInvites,
    };

    if (userData) {
      const existingTeamIds = userData.teamInvites?.teamIds || [];
      const shouldAddTeamId = !existingTeamIds.includes(teamId);
      const updatedTeamIds = shouldAddTeamId
        ? [...existingTeamIds, teamId]
        : existingTeamIds;
      const updateUserParams = {
        teamInvites: {
          email: userData.email,
          teamIds: updatedTeamIds,
        },
      };
      await this.userRepository.updateUserById(userData._id, updateUserParams);
    }
    await this.addNonUserTeam(email, teamId);
    const response = await this.teamRepository.updateTeamById(
      teamFilter,
      updatedData,
    );

    // send a mail with teamId and inviteId
    // add your code here

    if (userData) {
      // registered user
      const transporter = this.emailService.createTransporter();
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: email,
        text: "Team Invite Acceptance",
        template: "teamInviteRegisteredReciever",
        context: {
          teamName: team.name,
          userName: userData?.name || email,
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
          authUrl: this.configService.get("auth.baseURL"),
          inviteId: inviteId,
          teamId: teamId,
          email: email,
          role: role,
        },
        subject: `${sender.name} has invited you to the hub “${team.name}”`,
      };

      const promise = [this.emailService.sendEmail(transporter, mailOptions)];
      await Promise.all(promise);
    } else {
      // non registered user
      const transporter = this.emailService.createTransporter();
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: email,
        text: "Team Invite Acceptance",
        template: "teamInviteNonRegisteredReciever",
        context: {
          teamName: team.name,
          userName: userData?.name || email,
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
          marketingUrl: this.configService.get("marketing.baseURL"),
          inviteId: inviteId,
          teamId: teamId,
          email: email,
        },
        subject: `You’ve Been Invited to Join Sparrow – Power Up Your API Workflow`,
      };

      const promise = [this.emailService.sendEmail(transporter, mailOptions)];
      await Promise.all(promise);
    }

    return response;
  }

  async removeTeamInvite(teamId: string, email: string) {
    const team = await this.teamRepository.get(teamId);
    if (!team) {
      return "Team not Found";
    }
    const teamInvites = team.invites || [];
    const updatedInvites = teamInvites.filter((invite) => {
      if (invite.email === email) {
        return false;
      }
      return true;
    });
    await this.removeUserTeamInvites(teamId, email);
    await this.removeNonUserTeam(email, teamId);
    const updatedData: Partial<TeamDto> = {
      invites: updatedInvites,
    };
    await this.teamRepository.updateTeamById(team._id, updatedData);
  }

  async removeUserTeamInvites(teamId: string, email: string) {
    const userData = await this.userRepository.getUserByEmail(email);
    if (userData?.teamInvites) {
      const existingTeamIds = userData.teamInvites?.teamIds || [];
      const updatedTeamIds = existingTeamIds.filter(
        (id: string) => id !== teamId,
      );
      const updateUserParams = {
        teamInvites: {
          email: userData.email,
          teamIds: updatedTeamIds,
        },
      };
      await this.userRepository.updateUserById(userData._id, updateUserParams);
    }
  }

  async addNonUserTeam(email: string, teamId: string) {
    const nonUserData = await this.UserInvitesRepository.getByEmail(email);
    let response;
    if (nonUserData) {
      let existingTeamIds = nonUserData.teamIds || [];
      if (!existingTeamIds.includes(teamId)) {
        existingTeamIds.push(teamId);
      }
      const payload = {
        email,
        teamIds: existingTeamIds,
      };
      response = await this.UserInvitesRepository.update(payload);
    } else {
      const payload = {
        email,
        teamIds: [teamId],
      };
      response = await this.UserInvitesRepository.create(payload);
    }
    return response;
  }

  async removeNonUserTeam(email: string, teamId: string) {
    const nonUserData = await this.UserInvitesRepository.getByEmail(email);
    let response;
    if (nonUserData) {
      let existingTeamIds = nonUserData.teamIds || [];
      const updatedTeamIds = existingTeamIds.filter((id) => id !== teamId);
      const payload = {
        email,
        teamIds: updatedTeamIds,
      };
      response = await this.UserInvitesRepository.update(payload);
    }
    return response;
  }

  /**
   * send user Invites to join the Team.
   * @param {AddTeamUserDto} payload
   * @returns {Promise<void>} Result of the invite operation
   */
  async sendInvite(payload: AddTeamUserDto): Promise<any[]> {
    const teamFilter = payload.teamId;
    // check if inviter is admin or owner
    const sender = this.contextService.get("user");
    const isOwnerOrAdmin = this.isCheckOwnerOrAdmin(sender, payload.teamId);
    if (!isOwnerOrAdmin) {
      throw new UnauthorizedException(
        "Access Denied: Only an Admin or Owner can send the invitation.",
      );
    }
    for (const userEmail of payload.users) {
      await this.createInvite(
        userEmail,
        payload.role,
        payload.workspaces,
        teamFilter,
      );
    }
    return;
  }

  /**
   * user Accept to join the Team.
   * @param {string} inviteId - The Role select by the Inviter.
   * @param {string} teamId - We will send this TeamId a Invite
   * @returns Result of the invite operation
   */
  async acceptInvite(inviteId: string, teamId: string): Promise<any> {
    const teamObjectId = new ObjectId(teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamObjectId);
    if (!teamData) {
      throw new NotFoundException("Team not found");
    }
    const allInvites = teamData.invites || [];
    const matchedInvite = allInvites.find(
      (invite: any) => invite.inviteId === inviteId,
    );
    const hasExpired = this.isInviteExpired(matchedInvite.expiresAt);

    if (hasExpired) {
      await this.removeTeamInvite(teamId, matchedInvite.email);
      throw new NotFoundException("The invitation has expired.");
    }
    if (!matchedInvite) {
      throw new NotFoundException("Invite not found");
    }
    const user = await this.userRepository.getUserByEmail(
      matchedInvite.email.toLowerCase(),
    );
    if (!user) {
      // non registered user
      throw new NotFoundException("User doesn't exist");
    }
    // Check if user already in the team
    const isAlreadyMember = teamData.users.some(
      (u: any) => u.id === user._id.toString(),
    );
    if (isAlreadyMember) {
      throw new BadRequestException("User is already a member of the team");
    }
    // add user to the team
    await this.addUser({
      teamId: teamId,
      users: [matchedInvite.email],
      role: matchedInvite.role,
      workspaces: matchedInvite.workspaces,
    });
    // now remove it from invites array
    await this.removeTeamInvite(teamId, matchedInvite.email);
    // const updatedInvites = allInvites.filter(
    //   (invite: any) => invite.inviteId !== inviteId,
    // );
    // const teamUsers = [...teamData.users];
    // const teamAdmins = [...teamData.admins];
    // teamUsers.push({
    //   id: user._id.toString(),
    //   email: user.email.toLowerCase(),
    //   name: user.name,
    //   role:
    //     matchedInvite.role === TeamRole.ADMIN
    //       ? TeamRole.ADMIN
    //       : TeamRole.MEMBER,
    // });
    // if (matchedInvite.role === TeamRole.ADMIN) {
    //   teamAdmins.push(user._id.toString());
    // }
    // const updatedTeamParams: Partial<TeamDto> = {
    //   users: teamUsers,
    //   admins: teamAdmins,
    //   invites: updatedInvites,
    // };
    // await this.teamRepository.updateTeamById(teamObjectId, updatedTeamParams);
    // const userTeams = [...user.teams];
    // const userWorkspaces = [...user.workspaces];

    // userTeams.push({
    //   id: teamObjectId,
    //   name: teamData.name,
    //   role: matchedInvite.role,
    //   isNewInvite: true,
    // });

    // if (matchedInvite.role === TeamRole.ADMIN) {
    //   for (const ws of teamData.workspaces) {
    //     userWorkspaces.push({
    //       teamId: teamId,
    //       workspaceId: ws.id.toString(),
    //       name: ws.name,
    //     });
    //   }
    // }
    // const updateUserParams = {
    //   teams: userTeams,
    //   workspaces: userWorkspaces,
    // };
    // await this.userRepository.updateUserById(user._id, updateUserParams);
    // await this.producerService.produce(TOPIC.USER_ADDED_TO_TEAM_TOPIC, {
    //   value: JSON.stringify({
    //     teamWorkspaces:
    //       matchedInvite.role === TeamRole.ADMIN ? [...teamData.workspaces] : [],
    //     userId: user._id,
    //     role: matchedInvite.role,
    //   }),
    // });

    return {
      teamId: teamId,
      email: matchedInvite.email,
      role: matchedInvite.role,
      workspaces: matchedInvite.workspaces,
    };
  }

  /**
   * Admin or Owner can Change Invite role of a user in a Team.
   * @param {string} inviteId - The Role select by the Inviter.
   * @param {string} role - The Role select by the admin or owner.
   * @param {string} teamId - We will send this TeamId a Invite
   * @returns Result of the invite operation
   */
  async updateInvite(
    inviteId: string,
    teamId: string,
    role: string,
  ): Promise<any> {
    const teamObjectId = new ObjectId(teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamObjectId);
    if (!teamData) {
      throw new Error("Team not found");
    }
    const invites = teamData.invites || [];
    const inviteIndex = invites.findIndex(
      (invite: any) => invite.inviteId === inviteId,
    );
    if (inviteIndex === -1) {
      throw new Error("Invite not found");
    }
    invites[inviteIndex] = {
      ...invites[inviteIndex],
      role: role,
      updatedAt: new Date(),
    };
    const updatedData: Partial<TeamDto> = {
      invites,
    };
    const response = await this.teamRepository.updateTeamById(
      teamObjectId,
      updatedData,
    );
    return {
      success: true,
      message: "Invite updated with new role",
      data: response,
    };
  }

  public isInviteExpired(expiresAt: Date): boolean {
    const now = new Date();
    return new Date(expiresAt) < now;
  }

  public isCheckOwnerOrAdmin(sender: any, teamId: string): boolean {
    if (!sender.teams || sender.teams.length === 0) {
      return false;
    }
    const isOwnerOrAdmin = sender.teams.some(
      (team: any) =>
        (team.id === teamId && team.role === TeamRole.ADMIN) ||
        team.role === TeamRole.OWNER,
    );
    return isOwnerOrAdmin;
  }

  async removeInviteByemail(teamId: string, email?: string) {
    const teamObjectId = new ObjectId(teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamObjectId);
    if (!teamData) {
      throw new NotFoundException("Team not found");
    }
    const allInvites = teamData.invites || [];
    const matchedInvite = allInvites.find(
      (invite: Invite) => invite.email === email,
    );
    if (!matchedInvite) {
      throw new NotFoundException("Invite not found");
    }
    const data = await this.removeTeamInvite(teamId, email);
    return data;
  }

  async resendInvite(teamId: string, email: string) {
    const teamObjectId = new ObjectId(teamId);
    const teamData = await this.teamRepository.findTeamByTeamId(teamObjectId);
    if (!teamData) {
      throw new NotFoundException("Team not found");
    }
    const sender = this.contextService.get("user");
    const isOwnerOrAdmin = this.isCheckOwnerOrAdmin(sender, teamId);
    if (!isOwnerOrAdmin) {
      throw new UnauthorizedException(
        "Access Denied: Only an Admin or Owner can send the invitation.",
      );
    }
    const invites = teamData.invites || [];
    const inviteIndex = invites.findIndex(
      (invite: any) => invite.email === email,
    );
    const matchInvite = teamData.invites[inviteIndex].inviteId;
    if (inviteIndex === -1) {
      throw new NotFoundException("Invite not found");
    }
    // Store the email of the matching invite
    const inviteEmail = invites[inviteIndex].email;
    const userData = await this.userRepository.getUserByEmail(inviteEmail);
    // Apply remaining changes
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(now.getDate() + 7);
    invites[inviteIndex] = {
      ...invites[inviteIndex],
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAt,
    };
    const updatedData: Partial<TeamDto> = {
      invites,
    };
    const response = await this.teamRepository.updateTeamById(
      teamObjectId,
      updatedData,
    );
    if (userData) {
      // registered user
      const transporter = this.emailService.createTransporter();
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: inviteEmail,
        text: "Team Invite Acceptance",
        template: "teamInviteRegisteredReciever",
        context: {
          teamName: teamData.name,
          userName: userData?.name || inviteEmail,
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
          authUrl: this.configService.get("auth.baseURL"),
          inviteId: matchInvite,
          teamId: teamId,
          email: inviteEmail,
        },
        subject: `${sender.name} has invited you to the hub “${teamData.name}”`,
      };

      const promise = [this.emailService.sendEmail(transporter, mailOptions)];
      await Promise.all(promise);
    } else {
      // non registered user
      const transporter = this.emailService.createTransporter();
      const mailOptions = {
        from: this.configService.get("app.senderEmail"),
        to: inviteEmail,
        text: "Team Invite Acceptance",
        template: "teamInviteNonRegisteredReciever",
        context: {
          teamName: teamData.name,
          userName: userData?.name || inviteEmail,
          sparrowEmail: this.configService.get("support.sparrowEmail"),
          sparrowWebsite: this.configService.get("support.sparrowWebsite"),
          sparrowWebsiteName: this.configService.get(
            "support.sparrowWebsiteName",
          ),
          marketingUrl: this.configService.get("marketing.baseURL"),
          inviteId: matchInvite,
          teamId: teamId,
          email: inviteEmail,
        },
        subject: `You’ve Been Invited to Join Sparrow – Power Up Your API Workflow`,
      };

      const promise = [this.emailService.sendEmail(transporter, mailOptions)];
      await Promise.all(promise);
    }
    return response;
  }
}
