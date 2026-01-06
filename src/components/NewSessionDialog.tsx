import React from "react";
import { AlertTriangle } from "lucide-react";

interface NewSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const NewSessionDialog: React.FC<NewSessionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-500/10 rounded-full">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <h3 className="text-lg font-medium text-white">
            Create New Session?
          </h3>
        </div>
        <p className="text-slate-400 mb-2">Creating a new session will:</p>
        <ul className="text-sm text-slate-400 mb-4 space-y-1 ml-4">
          <li>• Disconnect all current chats</li>
          <li>• Generate a new ID</li>
          <li>• Start with an empty chat list</li>
        </ul>
        <p className="text-sm text-slate-500 mb-6">
          You can switch back to this session anytime.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors"
          >
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
};
