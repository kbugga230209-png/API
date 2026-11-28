import React, { useEffect, useState } from 'react';
import {
  HardDrive,
  Laptop,
  Palette,
  PenTool,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { PAPER_COLORS, PAPER_SIZES, PAPER_TEMPLATES } from '../../core/model/templates';
import {
  AppSettings,
  PaperColorId,
  PaperSizeId,
  TemplateId,
} from '../../core/model/types';
import {
  detectPlatformCapabilities,
  requestDurableLocalStorage,
} from '../../core/platform/platformAdapter';
import { InkVaultStorageEngine } from '../../core/storage/storageEngine';
import { formatBytes, Modal, SwitchRow } from '../../design/components';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  storage: InkVaultStorageEngine;
  onUpdateSettings: (next: AppSettings) => void;
  onOpenBackupModal: () => void;
  onOpenMigrationModal: () => void;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'pen' | 'storage' | 'sync' | 'privacy';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  storage,
  onUpdateSettings,
  onOpenBackupModal,
  onOpenMigrationModal,
  onClose,
}) => {
  const [tab, setTab] = useState<SettingsTab>('appearance');
  const [durableGranted, setDurableGranted] = useState<boolean | null>(null);
  const [stats, setStats] = useState<{
    documentCount: number;
    trashedCount: number;
    assetCount: number;
    totalAssetBytes: number;
    versionSnapshotCount: number;
  } | null>(null);

  const caps = detectPlatformCapabilities();

  useEffect(() => {
    if (open) {
      storage.getStorageStats().then(setStats);
    }
  }, [open, storage]);

  return (
    <Modal
      open={open}
      title="INKVAULT Preferences & System Settings"
      subtitle={`Platform: ${caps.platform} · Coalesced Stylus Input: ${
        caps.supportsCoalescedEvents ? 'Active' : 'Standard'
      } · Offline-Ready Local Vault`}
      maxWidth={700}
      onClose={onClose}
      footer={
        <button type="button" className="iv-btn iv-btn-primary" onClick={onClose}>
          Save &amp; Close
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="iv-segmented" style={{ flexWrap: 'wrap' }}>
          {(
            [
              { id: 'appearance', label: 'Appearance', icon: Palette },
              { id: 'pen', label: 'Pen & Stylus', icon: PenTool },
              { id: 'storage', label: 'Storage & Backup', icon: HardDrive },
              { id: 'sync', label: 'Sync & Import', icon: RefreshCw },
              { id: 'privacy', label: 'Privacy & Account', icon: ShieldCheck },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="iv-segmented-item"
                data-active={tab === item.id}
                onClick={() => setTab(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'appearance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Interface Theme</div>
                <div style={{ fontSize: 11.5, color: 'var(--iv-text-secondary)' }}>
                  Paper pages preserve their chosen ink/paper contrast in both Light and Dark themes
                </div>
              </div>
              <div className="iv-segmented">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="iv-segmented-item"
                    data-active={settings.theme === t}
                    onClick={() => onUpdateSettings({ ...settings, theme: t })}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Default Paper Size</label>
                <select
                  className="iv-select"
                  style={{ width: '100%', marginTop: 4 }}
                  value={settings.defaultPaperSize}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      defaultPaperSize: e.target.value as PaperSizeId,
                    })
                  }
                >
                  {Object.values(PAPER_SIZES).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Default Template</label>
                <select
                  className="iv-select"
                  style={{ width: '100%', marginTop: 4 }}
                  value={settings.defaultTemplate}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      defaultTemplate: e.target.value as TemplateId,
                    })
                  }
                >
                  {PAPER_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Default Paper Color</label>
                <select
                  className="iv-select"
                  style={{ width: '100%', marginTop: 4 }}
                  value={settings.defaultPaperColor}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      defaultPaperColor: e.target.value as PaperColorId,
                    })
                  }
                >
                  {Object.values(PAPER_COLORS).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {tab === 'pen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SwitchRow
              checked={settings.palmRejection}
              onChange={(v) => onUpdateSettings({ ...settings, palmRejection: v })}
              label="Hardware Palm Rejection"
              description="Reject accidental wide-contact palm touches while writing with Apple Pencil or active stylus"
            />
            <SwitchRow
              checked={settings.stylusOnlyDrawing}
              onChange={(v) => onUpdateSettings({ ...settings, stylusOnlyDrawing: v })}
              label="Apple Pencil / Stylus-Only Drawing Mode"
              description="Single-finger touch pans/scrolls the page while only hardware stylus draws ink"
            />
            <SwitchRow
              checked={settings.pencilHoverPreview !== false}
              onChange={(v) => onUpdateSettings({ ...settings, pencilHoverPreview: v })}
              label="Apple Pencil Hover Nib Preview"
              description="Display live nib radius & ink colour ring when hovering Apple Pencil (iPad Pro M2/M4 & iPad Air)"
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid var(--iv-border)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Apple Pencil Double-Tap</div>
                <div style={{ fontSize: 11.5, color: 'var(--iv-text-secondary)' }}>
                  Action triggered by double-tapping Apple Pencil (2nd Gen / Pro)
                </div>
              </div>
              <select
                className="iv-select"
                value={settings.pencilDoubleTapAction ?? 'switch-eraser'}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    pencilDoubleTapAction: e.target.value as
                      | 'switch-eraser'
                      | 'switch-previous'
                      | 'toggle-ruler'
                      | 'ignore',
                  })
                }
              >
                <option value="switch-eraser">Switch Current &amp; Eraser</option>
                <option value="switch-previous">Switch Previous Tool</option>
                <option value="toggle-ruler">Toggle Snap Ruler</option>
                <option value="ignore">Ignore</option>
              </select>
            </div>
            <SwitchRow
              checked={settings.drawAndHoldShapes}
              onChange={(v) => onUpdateSettings({ ...settings, drawAndHoldShapes: v })}
              label="Draw-and-Hold Geometric Shape Recognition"
              description="Pause briefly at the end of a stroke to snap into crisp lines, rectangles, ellipses, or triangles"
            />
            <SwitchRow
              checked={settings.straightHighlighter}
              onChange={(v) => onUpdateSettings({ ...settings, straightHighlighter: v })}
              label="Auto-Level Straight Highlighter"
              description="Snap nearly horizontal highlighter strokes into clean typographic underlines"
            />
            <SwitchRow
              checked={settings.eraserAutoDeselect}
              onChange={(v) => onUpdateSettings({ ...settings, eraserAutoDeselect: v })}
              label="Auto-Return to Previous Pen After Erasing"
              description="Automatically switch back to your active writing pen after lifting the Eraser"
            />
            <SwitchRow
              checked={settings.keepStrokeWidthOnResize}
              onChange={(v) => onUpdateSettings({ ...settings, keepStrokeWidthOnResize: v })}
              label="Preserve Stroke Thickness When Resizing Lasso Selection"
              description="Prevents scaled handwriting from becoming artificially thick or thin"
            />

            {settings.penPresets.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>
                  Saved Pen Presets ({settings.penPresets.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {settings.penPresets.map((p) => (
                    <span
                      key={p.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--iv-border)',
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: p.color,
                        }}
                      />
                      {p.name}
                      <button
                        type="button"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--iv-danger)',
                          padding: 0,
                          display: 'inline-flex',
                        }}
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            penPresets: settings.penPresets.filter((x) => x.id !== p.id),
                          })
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'storage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats && (
              <div style={{ fontSize: 13 }}>
                Local IndexedDB Vault holds <strong>{stats.documentCount}</strong> active notebooks,{' '}
                <strong>{stats.trashedCount}</strong> trashed items,{' '}
                <strong>{stats.versionSnapshotCount}</strong> version snapshots, and{' '}
                <strong>{formatBytes(stats.totalAssetBytes)}</strong> across{' '}
                <strong>{stats.assetCount}</strong> deduplicated binary assets.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                onClick={() => {
                  onClose();
                  onOpenBackupModal();
                }}
              >
                <HardDrive size={14} />
                Open Full Backup &amp; Restore Studio
              </button>

              <button
                type="button"
                className="iv-btn"
                onClick={async () => {
                  const ok = await requestDurableLocalStorage();
                  setDurableGranted(ok);
                }}
              >
                <Laptop size={14} />
                Request Persistent Device Storage
              </button>
            </div>

            {durableGranted !== null && (
              <div style={{ fontSize: 12, color: 'var(--iv-text-secondary)' }}>
                {durableGranted
                  ? '✓ Browser granted persistent non-evictable storage for INKVAULT.'
                  : 'Storage persistence managed automatically by browser.'}
              </div>
            )}
          </div>
        )}

        {tab === 'sync' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SwitchRow
              checked={settings.syncEnabled}
              onChange={(v) => onUpdateSettings({ ...settings, syncEnabled: v })}
              label="Enable Optional Self-Hosted / WebDAV JSON Sync"
              description="INKVAULT works 100% offline first; enable only if syncing across your own endpoint"
            />
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Sync Endpoint URL</label>
              <input
                className="iv-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="https://your-sync-endpoint.example/inkvault"
                value={settings.syncEndpointUrl}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, syncEndpointUrl: e.target.value })
                }
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="iv-btn iv-btn-primary"
                onClick={() => {
                  onClose();
                  onOpenMigrationModal();
                }}
              >
                Launch Goodnotes Migration &amp; Batch Import
              </button>
            </div>
          </div>
        )}

        {tab === 'privacy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'var(--iv-bg-subtle)',
                border: '1px solid var(--iv-border)',
                fontSize: 12.5,
              }}
            >
              <strong>Zero-Subscription User Ownership Guarantee:</strong> All notebooks, vector strokes, PDFs, and audio notes live locally on your device in open schemas. Sensitive notebooks can be locked individually with PBKDF2-SHA256 (120,000 iterations) + AES-256-GCM encryption.
            </div>

            <SwitchRow
              checked={settings.backgroundOcrEnabled}
              onChange={(v) =>
                onUpdateSettings({ ...settings, backgroundOcrEnabled: v })
              }
              label="Local Asynchronous Handwriting & Image OCR"
              description="Indexes handwriting locally in a background worker without sending pages to external cloud servers"
            />

            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Local Author Name (used only on shared/exported document metadata)
              </label>
              <input
                className="iv-input"
                style={{ width: '100%', marginTop: 4 }}
                value={settings.accountDisplayName}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, accountDisplayName: e.target.value })
                }
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
