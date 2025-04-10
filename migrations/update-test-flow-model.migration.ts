import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { Collection } from "@src/modules/common/models/collection.model";
import { Testflow } from "@src/modules/common/models/testflow.model";
import { Db } from "mongodb";

@Injectable()
export class UpdateTestFlowModelMigration implements OnModuleInit {
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    try {
      console.log("Update test flow model migration start.");
      const testFlowCollection = this.db.collection<Testflow>(
        Collections.TESTFLOW,
      );
      const collectionCollection = this.db.collection<Collection>(
        Collections.COLLECTION,
      );

      const testflows = await testFlowCollection.find().toArray();
      const collections = await collectionCollection.find().toArray();

      for (const flow of testflows) {
        const updatedNodes = await this.updateNodes(
          flow.nodes || [],
          collections,
          flow.workspaceId,
        );
        flow.nodes = updatedNodes;
        await testFlowCollection.updateOne(
          { _id: flow._id },
          { $set: { nodes: updatedNodes } },
        );
      }
      console.log("Update test flow model migration end.");
    } catch (error) {
      console.error("Error during update testflow model migration:", error);
    }
  }

  private async updateNodes(
    nodes: any[],
    collections: any[],
    workspaceId: string,
  ) {
    return nodes.map((node) => {
      if (node?.id === "1") {
        return {
          ...node,
          data: {
            blockName: "startBlock",
            collectionId: "",
            folderId: "",
            requestId: "",
            workspaceId,
            isDeleted: false,
            requestData: null,
          },
        };
      } else {
        let { collectionId, requestId, folderId, name } = node?.data || {};

        if (!name) {
          name = node?.data?.requestData?.name;
        }

        let requestData = this.findRequestData(
          collections,
          collectionId,
          folderId,
          requestId,
        );

        if (requestData) {
          requestData = {
            ...requestData,
            name: name,
          };
        }

        return {
          ...node,
          data: {
            blockName: `block ${node.id - 1}`,
            collectionId,
            folderId,
            requestId,
            workspaceId,
            isDeleted: false,
            requestData,
          },
        };
      }
    });
  }

  private findRequestData(
    collections: any[],
    collectionId: string,
    folderId: string,
    requestId: string,
  ) {
    const collection = collections.find(
      (col) => col._id?.toString() === collectionId,
    );
    if (!collection?.items) return null;

    for (const folder of collection.items) {
      if (folderId && folder.id === folderId) {
        return (
          folder.items?.find((item: any) => item.id === requestId)?.request ||
          null
        );
      }
      if (!folderId && folder.id === requestId) {
        return folder?.request || null;
      }
    }
    return null;
  }
}
