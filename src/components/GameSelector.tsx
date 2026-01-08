import React from "react";
import { X, Gamepad2 } from "lucide-react";
import { gameRegistry } from "../games";

interface GameSelectorProps {
  onSelect: (gameId: string) => void;
  onClose: () => void;
}

export const GameSelector: React.FC<GameSelectorProps> = ({
  onSelect,
  onClose,
}) => {
  const games = gameRegistry.getAllDefinitions();

  return (
    <div className="absolute bottom-full mb-2 left-0 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/50">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-primary-400" />
          Play a Game
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 max-h-64 overflow-y-auto">
        {games.length === 0 ? (
          <div className="text-center p-4 text-slate-500 text-xs">
            No games available yet.
          </div>
        ) : (
          <div className="grid gap-1">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => onSelect(game.id)}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors text-left group"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  {game.icon}
                </div>
                <div>
                  <div className="font-medium text-slate-200 text-sm">
                    {game.name}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-1">
                    {game.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
