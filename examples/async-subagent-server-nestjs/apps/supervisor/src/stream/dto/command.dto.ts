export class CommandDto {
  method: string;
  id: string;
  params?: {
    input?: {
      messages?: { role: string; content: string }[];
    };
    multitaskStrategy?: string;
    forkFrom?: { checkpoint_id: string };
  };
}
