import React from "react";
import {
  Lock,
  LockOpen,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";

interface SecurityBadgeProps {
  encrypted?: boolean;
  verified?: boolean;
  keyChanged?: boolean;
  fingerprint?: string | null;
  showFingerprint?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
}

/**
 * Security badge component showing encryption status
 *
 * States:
 * - 🔓 Not encrypted (old messages)
 * - 🔒 Encrypted but not verified
 * - ✅ Encrypted and verified
 * - ⚠️ Key changed warning
 */
export const SecurityBadge: React.FC<SecurityBadgeProps> = ({
  encrypted = false,
  verified = false,
  keyChanged = false,
  fingerprint,
  showFingerprint = false,
  size = "sm",
  onClick,
}) => {
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  // Determine state and styling
  let Icon = LockOpen;
  let colorClass = "text-slate-500";
  let bgClass = "bg-slate-500/10";
  let borderClass = "border-slate-500/20";
  let label = "Không mã hóa";

  if (encrypted) {
    if (keyChanged) {
      Icon = ShieldAlert;
      colorClass = "text-yellow-500";
      bgClass = "bg-yellow-500/10";
      borderClass = "border-yellow-500/30";
      label = "Key thay đổi";
    } else if (verified) {
      Icon = ShieldCheck;
      colorClass = "text-green-500";
      bgClass = "bg-green-500/10";
      borderClass = "border-green-500/30";
      label = "Đã xác minh";
    } else {
      Icon = Lock;
      colorClass = "text-primary-400";
      bgClass = "bg-primary-500/10";
      borderClass = "border-primary-500/30";
      label = "Mã hóa E2EE";
    }
  }

  const content = (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full
        ${bgClass} border ${borderClass} ${colorClass}
        ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
      `}
      onClick={onClick}
      title={fingerprint ? `Fingerprint: ${fingerprint}` : label}
    >
      <Icon className={iconSize} />
      <span className={`${textSize} font-medium`}>{label}</span>
    </div>
  );

  if (showFingerprint && fingerprint) {
    return (
      <div className="flex flex-col items-start gap-1">
        {content}
        <span className={`${textSize} font-mono text-slate-500 pl-1`}>
          {fingerprint.split(" ").slice(0, 4).join(" ")}
        </span>
      </div>
    );
  }

  return content;
};

/**
 * Inline badge for message list (minimal version)
 */
interface MessageSecurityBadgeProps {
  encrypted?: boolean;
}

export const MessageSecurityBadge: React.FC<MessageSecurityBadgeProps> = ({
  encrypted = false,
}) => {
  if (encrypted) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-primary-400/60"
        title="Mã hóa E2EE"
      >
        <Lock className="w-2.5 h-2.5" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-0.5 text-slate-500/60"
      title="Không mã hóa"
    >
      <LockOpen className="w-2.5 h-2.5" />
    </span>
  );
};

/**
 * Fingerprint display component
 */
interface FingerprintDisplayProps {
  label: string;
  fingerprint: string;
  verified?: boolean;
  onVerify?: () => void;
}

export const FingerprintDisplay: React.FC<FingerprintDisplayProps> = ({
  label,
  fingerprint,
  verified = false,
  onVerify,
}) => {
  // Split fingerprint into 4-char groups for display
  const groups = fingerprint.split(" ");

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        {verified ? (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Đã xác minh
          </span>
        ) : onVerify ? (
          <button
            onClick={onVerify}
            className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            <ShieldQuestion className="w-3.5 h-3.5" />
            Xác minh
          </button>
        ) : null}
      </div>

      <div className="font-mono text-sm text-slate-200 grid grid-cols-4 gap-2">
        {groups.map((group, i) => (
          <span
            key={i}
            className="bg-slate-900/50 px-2 py-1 rounded text-center"
          >
            {group}
          </span>
        ))}
      </div>
    </div>
  );
};
