import { Injectable, Scope } from "@nestjs/common";

@Injectable({ scope: Scope.REQUEST })
export class ContextService {
  private contextData: Record<string, any> = {};

  set(key: string, value: any) {
    this.contextData[key] = value;
  }

  get(key: string) {
    return this.contextData[key];
  }
}
