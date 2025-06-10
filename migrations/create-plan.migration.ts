import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LimitArea } from "@src/modules/common/models/plan.model";

import { Db } from "mongodb";

@Injectable()
export class CreatePlanMigration implements OnModuleInit {
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const defaultHubPlan =
        this.configService.get<string>("app.defaultHubPlan");
      const planCollection = this.db.collection(Collections.PLAN);

      // Check and create Community Plan
      const existingCommunityPlan = await planCollection.findOne({
        name: defaultHubPlan,
      });

      if (!existingCommunityPlan) {
        const communityPlan = {
          name: defaultHubPlan,
          description: "Free tier with limited access",
          active: true,
          limits: {
            workspacesPerHub: {
              area: LimitArea.WORKSPACE,
              value: 3,
            },
            testflowPerWorkspace: {
              area: LimitArea.TESTFLOW,
              value: 3,
            },
            blocksPerTestflow: {
              area: LimitArea.BLOCK,
              value: 5,
            },
            usersPerHub: {
              area: LimitArea.BLOCK,
              value: 3,
            },
            selectiveTestflowRun: {
              area: LimitArea.TESTFLOW,
              active: false,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "system",
          updatedBy: "system",
        };

        await planCollection.insertOne(communityPlan);
        console.log("\x1b[36mCommunity Plan created successfully.\x1b[0m");
      } else {
        console.log("\x1b[33mCommunity Plan already exists. Skipping.\x1b[0m");
      }

      // Check and create Standard Plan
      const existingStandardPlan = await planCollection.findOne({
        name: "Standard",
      });

      if (!existingStandardPlan) {
        const standardPlan = {
          name: "Standard",
          description: "Standard tier with same access as Community",
          active: true,
          limits: {
            workspacesPerHub: {
              area: LimitArea.WORKSPACE,
              value: 3,
            },
            testflowPerWorkspace: {
              area: LimitArea.TESTFLOW,
              value: 3,
            },
            blocksPerTestflow: {
              area: LimitArea.BLOCK,
              value: 5,
            },
            usersPerHub: {
              area: LimitArea.BLOCK,
              value: 3,
            },
            selectiveTestflowRun: {
              area: LimitArea.TESTFLOW,
              active: false,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "system",
          updatedBy: "system",
        };

        await planCollection.insertOne(standardPlan);
        console.log("\x1b[36mStandard Plan created successfully.\x1b[0m");
      } else {
        console.log("\x1b[33mStandard Plan already exists. Skipping.\x1b[0m");
      }

      // Check and create Professional Plan
      const existingProfessionalPlan = await planCollection.findOne({
        name: "Professional",
      });

      if (!existingProfessionalPlan) {
        const professionalPlan = {
          name: "Professional",
          description: "Professional tier with same access as Community",
          active: true,
          limits: {
            workspacesPerHub: {
              area: LimitArea.WORKSPACE,
              value: 3,
            },
            testflowPerWorkspace: {
              area: LimitArea.TESTFLOW,
              value: 3,
            },
            blocksPerTestflow: {
              area: LimitArea.BLOCK,
              value: 5,
            },
            usersPerHub: {
              area: LimitArea.BLOCK,
              value: 3,
            },
            selectiveTestflowRun: {
              area: LimitArea.TESTFLOW,
              active: false,
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "system",
          updatedBy: "system",
        };

        await planCollection.insertOne(professionalPlan);
        console.log("\x1b[36mProfessional Plan created successfully.\x1b[0m");
      } else {
        console.log(
          "\x1b[33mProfessional Plan already exists. Skipping.\x1b[0m",
        );
      }
    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
}
