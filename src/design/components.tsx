import React from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  maxWidth?: number;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  subtitle,
  maxWidth = 760,
  onClose,
  footer,
  children,
}) => {
  if (!open) return null;
  return (
    <div
      className="iv-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="iv-modal-sheet" style={{ maxWidth }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--iv-border)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--iv-text-md)' }}>{title}</div>
            {subtitle && (
              <div
                style={{
                  fontSize: 'var(--iv-text-xs)',
                  color: 'var(--iv-text-secondary)',
                  marginTop: 2,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            className="iv-icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={17} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>{children}</div>

        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 18px',
              borderTop: '1px solid var(--iv-border)',
              background: 'var(--iv-bg-subtle)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  id?: string;
}

export const SwitchRow: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  id,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 0',
      }}
    >
      <div>
        {label && (
          <label
            htmlFor={id}
            style={{ fontWeight: 500, fontSize: 'var(--iv-text-base)', cursor: 'pointer' }}
          >
            {label}
          </label>
        )}
        {description && (
          <div style={{ fontSize: 'var(--iv-text-xs)', color: 'var(--iv-text-secondary)' }}>
            {description}
          </div>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 38,
          height: 22,
          borderRadius: 12,
          padding: 2,
          border: '1px solid',
          borderColor: checked ? 'var(--iv-accent)' : 'var(--iv-border-strong)',
          background: checked ? 'var(--iv-accent)' : 'var(--iv-bg-subtle)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          transition: 'background 0.14s ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
};

export function formatRelativeDate(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
