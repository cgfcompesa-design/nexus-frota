
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface EmailRecipientsEditorProps {
  recipients: string[];
  onRecipientsChange: (emails: string[]) => void;
  selectedGerencias: string[];
}

export const EmailRecipientsEditor = ({ recipients, onRecipientsChange, selectedGerencias }: EmailRecipientsEditorProps) => {
  return (
    <Button variant="outline" size="sm" className="gap-2">
      <Mail className="h-4 w-4" />
      <span>{recipients.length} Destinatário(s)</span>
    </Button>
  );
};
