import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LimitArea } from "@src/modules/common/models/plan.model";
import { Db } from "mongodb";

@Injectable()
export class UpdatePlanMigration implements OnModuleInit {
  private hasRun = false;
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    if (this.hasRun) {
      return;
    }
    try {
      console.log(
        "\x1b[32m[Nest]\x1b[0m \x1b[32mExecuting Plan Update Migration...\x1b[0m",
      );
      const planCollection = this.db.collection(Collections.PLAN);
      const plans = await planCollection.find().toArray();
      let updatedCount = 0;
      for (const plan of plans) {
        if (!plan.limits?.aiTokensPerMonth) {
          plan.limits.aiTokensPerMonth = {
            area: LimitArea.AI,
            value: 50,
          };
          await planCollection.updateOne(
            { _id: plan._id },
            {
              $set: { "limits.aiTokensPerMonth": plan.limits.aiTokensPerMonth },
            },
          );
          updatedCount++;
        }
      }
      console.log(
        `\x1b[32m[Nest] \x1b[33m${updatedCount}\x1b[0m \x1b[32mplans updated with aiTokensPerMonth. Migration completed.\x1b[0m`,
      );
      this.hasRun = true;
    } catch (error) {
      console.error("Error during update plan migration:", error);
    }
  }
}
