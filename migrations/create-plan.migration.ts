/* eslint-disable prettier/prettier */
import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";

import { Db } from "mongodb";

@Injectable()
export class CreatePlanMigration implements OnModuleInit {
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db, // Inject the MongoDB connection
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const planCollection = this.db.collection(Collections.PLAN);      
     // Insert Community Plan
     const existingPlan = await planCollection.findOne({ name: "Community" });

     if (!existingPlan) {
       const communityPlan = {
         name: "Community",
         description: "Free tier with limited access",
         active: true,
         limits: [
           {
             area: "user",
             key: "no_of_hubs",
             value: "1",
             type: "number",
           },
           {
             area: "storage",
             key: "max_upload_size_mb",
             value: "10",
             type: "number",
           },
           {
             area: "user",
             key: "max_users",
             value: "5",
             type: "number",
           },
         ],
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

    } catch (error) {
      console.error("Error during migration:", error);
    }
  }
}
