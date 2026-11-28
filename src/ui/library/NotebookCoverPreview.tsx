import React, { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { renderPaperBackgroundToCanvas } from '../../core/ink/templateRenderer';
import { InkVaultDocument } from '../../core/model/types';

interface Props {
  doc: InkVaultDocument;
  customCoverUrl?: string;
}

export const NotebookCoverPreview: React.FC<Props> = ({ doc, customCoverUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (doc.cover.enabled || doc.isEncrypted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const page = doc.pages[0];
    if (!page) return;
    const w = 210;
    const h = 280;
    canvas.width = w;
    canvas.height = h;

    renderPaperBackgroundToCanvas(ctx, w, h, {
      ...page.background,
      lineSpacing: Math.max(9, Math.round(page.background.lineSpacing * 0.34)),
    });

    // Render miniature preview of strokes & shapes on page 1
    const scaleX = w / page.width;
    const scaleY = h / page.height;
    ctx.save();
    ctx.scale(scaleX, scaleY);
    for (const stroke of page.strokes.slice(0, 140)) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = stroke.opacity;
      ctx.lineWidth = Math.max(1.6, stroke.width);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, [doc]);

  // 1. Encrypted Vault Notebook Cover
  if (doc.isEncrypted) {
    return (
      <div
        className="iv-notebook-cover-frame"
        style={{
          width: '100%',
          aspectRatio: '3 / 4',
          background: 'linear-gradient(155deg, #1a1d24 0%, #111318 100%)',
          borderRadius: '3px 9px 9px 3px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#cbd5e1',
          gap: 10,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Bound Cloth Spine */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 13,
            background: doc.cover.accentColor || '#2563EB',
            boxShadow: 'inset -2px 0 3px rgba(0,0,0,0.38), 1px 0 0 rgba(255,255,255,0.08)',
          }}
        />
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lock size={18} />
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontFamily: 'var(--iv-font-mono)',
            letterSpacing: '0.1em',
            fontWeight: 600,
            opacity: 0.78,
          }}
        >
          LOCKED VAULT
        </span>
      </div>
    );
  }

  // 2. Coverless Quick-Sheet / Live Page-1 Preview
  if (!doc.cover.enabled) {
    return (
      <div
        className="iv-notebook-cover-frame"
        style={{
          width: '100%',
          aspectRatio: '3 / 4',
          borderRadius: '3px 8px 8px 3px',
          overflow: 'hidden',
          border: '1px solid rgba(20, 22, 26, 0.12)',
          background: '#faf8f5',
          position: 'relative',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {/* Top Notepad Binding Strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'rgba(20, 22, 26, 0.14)',
          }}
        />
        {doc.pages[0]?.background.type === 'pdf' && (
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(21, 23, 27, 0.8)',
              color: '#ffffff',
            }}
          >
            PDF
          </span>
        )}
      </div>
    );
  }

  // 3. Bound Tactile Notebook Cover
  const lowerColor = doc.cover.color.toLowerCase();
  const isLightCover =
    lowerColor === '#e5dfd3' ||
    lowerColor === '#ffffff' ||
    lowerColor === '#f5f0e6' ||
    lowerColor === '#faf8f5';
  const fg = isLightCover ? '#18181b' : '#f8fafc';
  const mutedFg = isLightCover ? 'rgba(24,24,27,0.58)' : 'rgba(248,250,252,0.64)';

  return (
    <div
      className="iv-notebook-cover-frame"
      style={{
        width: '100%',
        aspectRatio: '3 / 4',
        borderRadius: '3px 9px 9px 3px',
        background: customCoverUrl
          ? `center / cover no-repeat url(${customCoverUrl})`
          : doc.cover.color,
        position: 'relative',
        overflow: 'hidden',
        border: isLightCover
          ? '1px solid rgba(20, 22, 26, 0.13)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '15px 13px 12px 22px',
        color: fg,
      }}
    >
      {/* Subtle Paper / Linen Grain Overlay */}
      {!customCoverUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: isLightCover
              ? 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 0)'
              : 'radial-gradient(rgba(255,255,255,0.035) 1px, transparent 0)',
            backgroundSize: '6px 6px',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Book Cloth Spine + Crease Groove */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 13,
          background: doc.cover.accentColor,
          boxShadow: 'inset -2px 0 3px rgba(0,0,0,0.28)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 13,
          top: 0,
          bottom: 0,
          width: 2,
          background: isLightCover ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0.34)',
          pointerEvents: 'none',
        }}
      />

      {/* Cover Style Details */}
      {doc.cover.style === 'technical-grid' && !customCoverUrl && (
        <div
          style={{
            position: 'absolute',
            left: 15,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundImage: `linear-gradient(to right, ${
              isLightCover ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.065)'
            } 1px, transparent 1px), linear-gradient(to bottom, ${
              isLightCover ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.065)'
            } 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
            pointerEvents: 'none',
          }}
        />
      )}

      {doc.cover.style === 'monograph-linen' && !customCoverUrl && (
        <div
          style={{
            position: 'absolute',
            left: 22,
            right: 13,
            top: 16,
            bottom: 34,
            border: `1px solid ${isLightCover ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.16)'}`,
            borderRadius: 3,
            pointerEvents: 'none',
          }}
        />
      )}

      {doc.cover.style === 'bold-index' && !customCoverUrl && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 20,
            width: 8,
            height: 44,
            borderRadius: '3px 0 0 3px',
            background: doc.cover.accentColor,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Embossed Cover Label Plate */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: customCoverUrl
            ? 'rgba(15, 17, 21, 0.72)'
            : doc.cover.style === 'architectural-spine'
            ? isLightCover
              ? 'rgba(255, 255, 255, 0.72)'
              : 'rgba(255, 255, 255, 0.065)'
            : 'transparent',
          backdropFilter: customCoverUrl ? 'blur(6px)' : undefined,
          padding:
            customCoverUrl || doc.cover.style === 'architectural-spine'
              ? '9px 10px'
              : '2px 0',
          borderRadius: 4,
          border:
            customCoverUrl || doc.cover.style === 'architectural-spine'
              ? `1px solid ${
                  customCoverUrl
                    ? 'rgba(255,255,255,0.14)'
                    : isLightCover
                    ? 'rgba(0,0,0,0.08)'
                    : 'rgba(255,255,255,0.1)'
                }`
              : 'none',
          color: customCoverUrl ? '#f8fafc' : fg,
        }}
      >
        <div
          style={{
            fontSize: 8.5,
            fontFamily: 'var(--iv-font-mono)',
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: customCoverUrl ? 'rgba(248,250,252,0.72)' : mutedFg,
          }}
        >
          {doc.migrationReport
            ? 'MIGRATED'
            : doc.pages[0]?.background.type === 'pdf'
            ? 'PDF EDITION'
            : `${doc.pages.length} ${doc.pages.length === 1 ? 'SHEET' : 'SHEETS'}`}
        </div>
        <div
          style={{
            marginTop: 4,
            fontWeight: 650,
            fontSize: 12.5,
            lineHeight: 1.26,
            letterSpacing: '-0.01em',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {doc.title}
        </div>
      </div>

      {/* Bottom Foil Imprint */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          borderTop: `1px solid ${
            customCoverUrl
              ? 'rgba(255,255,255,0.2)'
              : isLightCover
              ? 'rgba(0,0,0,0.1)'
              : 'rgba(255,255,255,0.13)'
          }`,
          paddingTop: 6,
          fontSize: 9,
          letterSpacing: '0.05em',
          color: customCoverUrl ? 'rgba(248,250,252,0.85)' : mutedFg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.cover.subtitle || 'INKVAULT'}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{doc.pages.length}p</span>
      </div>
    </div>
  );
};
