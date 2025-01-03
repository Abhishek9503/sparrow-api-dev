import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { TeamRole, WorkspaceRole } from "@src/modules/common/enum/roles.enum";
import {
  DefaultEnvironment,
  EnvironmentType,
} from "@src/modules/common/models/environment.model";
import { CreateEnvironmentDto } from "@src/modules/workspace/payloads/environment.payload";
import { createHmac } from "crypto";
import { Db } from "mongodb";

const DEFAULT_EMAIL = "dev@sparrow.com";
const DEFAULT_PASSWORD = "12345678@";

const DEFAULT_USER = {
  email: DEFAULT_EMAIL,
  name: "dev",
  password: createHmac("sha256", DEFAULT_PASSWORD).digest("hex"),
  isEmailVerified: true,
};

const DEFAULT_TEAM = {
  name: "Test Dev Team",
  description: "test dev team",
};

const DEFAULT_WORKSPACE = {
  name: "Test Workspace",
};

@Injectable()
export class CreateUserMigration implements OnModuleInit {
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const usersCollection = this.db.collection(Collections.USER);
      const teamsCollection = this.db.collection(Collections.TEAM);
      const workspaceCollection = this.db.collection(Collections.WORKSPACE);
      const environmentCollection = this.db.collection(Collections.ENVIRONMENT);

      // Check if the user already exists
      const existingUser = await usersCollection.findOne({
        email: DEFAULT_USER.email,
      });
      if (existingUser) {
        console.log("User already exists. Skipping migration.");
        return;
      }

      // Insert the new user
      const { insertedId: userId } =
        await usersCollection.insertOne(DEFAULT_USER);

      // Insert the new team
      const teamData = {
        ...DEFAULT_TEAM,
        users: [
          {
            id: userId.toString(),
            email: DEFAULT_USER.email,
            name: DEFAULT_USER.name,
            role: TeamRole.OWNER,
            owner: userId.toString(),
          },
        ],
      };
      const { insertedId: teamId } = await teamsCollection.insertOne(teamData);

      // Update user with the new team
      await usersCollection.updateOne(
        { _id: userId },
        {
          $set: {
            teams: [
              {
                id: teamId,
                name: DEFAULT_TEAM.name,
                role: TeamRole.OWNER,
                isNewInvite: false,
              },
            ],
          },
        },
      );

      // Create new global environment
      const environmentPayload: CreateEnvironmentDto = {
        name: DefaultEnvironment.GLOBAL,
        variable: [
          {
            key: "",
            value: "",
            checked: true,
          },
        ],
      };

      const newEnvironment = {
        ...environmentPayload,
        type: EnvironmentType.GLOBAL,
        createdBy: DEFAULT_USER.name,
        updatedBy: DEFAULT_USER.name,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { insertedId: environmentId } =
        await environmentCollection.insertOne(newEnvironment);

      // Prepare workspace users and admins
      const adminInfo = [];
      const usersInfo = [];

      for (const user of teamData.users) {
        if (user.role !== TeamRole.MEMBER) {
          adminInfo.push({
            id: user.id.toString(),
            name: user.name,
          });
          usersInfo.push({
            role: WorkspaceRole.ADMIN,
            id: user.id.toString(),
            name: user.name,
            email: user.email,
          });
        }
      }

      // Create new workspace
      const workspaceData = {
        ...DEFAULT_WORKSPACE,
        team: {
          id: teamId.toString(),
          name: DEFAULT_TEAM.name,
        },
        users: usersInfo,
        admins: adminInfo,
        environments: [
          {
            id: environmentId.toString(),
            name: environmentPayload.name,
            type: EnvironmentType.GLOBAL,
          },
        ],
        createdAt: new Date(),
        createdBy: userId.toString(),
        updatedAt: new Date(),
        updatedBy: userId.toString(),
      };

      const { insertedId: workspaceId } =
        await workspaceCollection.insertOne(workspaceData);

      // Update workspace in team collection
      const teamWorkspaces = [
        { id: workspaceId.toString(), name: "Test Workspace" },
      ];

      const updateTeamParams = {
        workspaces: teamWorkspaces,
      };

      await teamsCollection.updateOne(
        { _id: teamId },
        { $set: updateTeamParams },
      );

      // Update workspace in user collection
      const updateUserParams = {
        workspaces: [
          {
            workspaceId: workspaceId.toString(),
            name: "Test Workspace",
            teamId: teamId.toString(),
            isNewInvite: false,
          },
        ],
      };

      await usersCollection.updateOne(
        { _id: userId },
        { $set: updateUserParams },
      );

      console.log(
        `\x1b[32m[Nest] Test User created successfully with email - \x1b[33m${DEFAULT_EMAIL}\x1b[0m \x1b[32mand password -\x1b[33m \x1b[33m${DEFAULT_PASSWORD}\x1b[0m`,
      );
      return;
    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
}
