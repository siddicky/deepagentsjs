export class SubscribeDto {
  channels: string[] = ["messages", "values", "lifecycle"];
  namespaces?: string[][];
  since?: number;
}
