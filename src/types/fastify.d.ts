import { ObjectId } from "mongodb";

export type DecodedUserObject = {
  _id: ObjectId;
  email: string;
  name: string;
  role: string;
};

export interface ExtendedFastifyRequest extends FastifyRequest {
  user: DecodedUserObject;
}
