export class CreateRunDto {
  input?: {
    messages?: { role: string; content: string }[];
  };
  assistant_id?: string;
  multitask_strategy?: string;
}
