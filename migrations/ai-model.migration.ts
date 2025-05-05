import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { Collections } from '@src/modules/common/enum/database.collection.enum'; 
import { ChatBotStats } from '@src/modules/common/models/chatbot-stats.model';   

@Injectable()
export class ChatBotStatsAiModelMigration implements OnModuleInit {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  async onModuleInit(): Promise<void> {
    const chatbotStatsCollection = this.db.collection<ChatBotStats>(Collections.CHATBOTSTATS);

    const documents = await chatbotStatsCollection
      .find({
        tokenStats: { $exists: true },
        aiModel: { $exists: false },
      })
      .toArray();

    for (const doc of documents) {
      const tokenUsage = doc.tokenStats?.tokenUsage || 0;
      const yearMonth = doc.tokenStats?.yearMonth || null;

      const aiModel = {
        gpt: tokenUsage,
        deepseek: 0,
        yearMonth: yearMonth,
      };

      await chatbotStatsCollection.updateOne(
        { _id: new ObjectId(doc._id) },
        { $set: { aiModel } },
      );

      console.log(`Updated ChatBotStats with _id: ${doc._id}`);
    }
  }
}