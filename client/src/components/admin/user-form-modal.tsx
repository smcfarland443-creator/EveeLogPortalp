import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserFormModal({ isOpen, onClose }: UserFormModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Benutzer hinzufügen</DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <p className="text-sm text-gray-600 text-center">
            Neue Benutzer können sich über das Login-System registrieren. 
            Sie erhalten dann automatisch eine Anfrage zur Genehmigung.
          </p>
        </div>

        <div className="flex justify-end">
          <Button 
            variant="outline"
            onClick={onClose}
            data-testid="button-close"
          >
            Schließen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
