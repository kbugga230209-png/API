import { PAPER_COLORS } from '../model/templates';
import { PageBackground } from '../model/types';

/**
 * Renders resolution-independent paper templates directly onto any CanvasRenderingContext2D.
 * Used across the live writing workspace, zoom window, miniature page thumbnails, and PDF export.
 */
export function renderPaperBackgroundToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: PageBackground,
  customImage?: HTMLImageElement | null
): void {
  const palette = PAPER_COLORS[background.paperColor] ?? PAPER_COLORS.white;
  ctx.save();

  // Base sheet fill
  ctx.fillStyle = palette.backgroundHex;
  ctx.fillRect(0, 0, width, height);

  if (customImage && (background.type === 'custom-image' || background.customTemplateId)) {
    ctx.drawImage(customImage, 0, 0, width, height);
    ctx.restore();
    return;
  }

  if (background.type === 'pdf') {
    // PDF raster/vector background is drawn by PDF renderer right after base fill
    ctx.restore();
    return;
  }

  const spacing = Math.max(12, background.lineSpacing || 28);
  const { templateId } = background;

  ctx.strokeStyle = palette.lineHex;
  ctx.fillStyle = palette.lineHex;
  ctx.lineWidth = 1;

  switch (templateId) {
    case 'blank':
      break;

    case 'ruled-narrow':
    case 'ruled-wide': {
      const step = templateId === 'ruled-narrow' ? Math.min(spacing, 26) : Math.max(spacing, 34);
      const topHeader = 68;
      ctx.beginPath();
      for (let y = topHeader; y < height - 28; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();

      // Left vertical margin rule
      ctx.strokeStyle = palette.marginHex;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(74.5, 0);
      ctx.lineTo(74.5, height);
      ctx.stroke();
      break;
    }

    case 'grid': {
      const step = spacing || 24;
      ctx.beginPath();
      for (let x = step; x < width; x += step) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = step; y < height; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();
      break;
    }

    case 'dotted': {
      const step = spacing || 24;
      const dotRadius = 1.25;
      for (let y = step; y < height - 12; y += step) {
        for (let x = step; x < width - 12; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'cornell': {
      const headerY = 76;
      const summaryY = height - 148;
      const cueX = Math.round(width * 0.29);
      const step = spacing || 28;

      // Interior horizontal lines in main notes column
      ctx.beginPath();
      for (let y = headerY + step; y < summaryY; y += step) {
        ctx.moveTo(cueX, y + 0.5);
        ctx.lineTo(width - 28, y + 0.5);
      }
      ctx.stroke();

      // Structural Cornell dividers
      ctx.strokeStyle = palette.marginHex;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(28, headerY);
      ctx.lineTo(width - 28, headerY);
      ctx.moveTo(cueX, headerY);
      ctx.lineTo(cueX, summaryY);
      ctx.moveTo(28, summaryY);
      ctx.lineTo(width - 28, summaryY);
      ctx.stroke();

      // Subtle section labels
      ctx.fillStyle = palette.isDark ? '#6E7685' : '#8A909E';
      ctx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('TOPIC / DATE', 32, headerY - 12);
      ctx.fillText('CUES & QUESTIONS', 32, headerY + 18);
      ctx.fillText('NOTES', cueX + 12, headerY + 18);
      ctx.fillText('SUMMARY', 32, summaryY + 18);
      break;
    }

    case 'planner-daily': {
      const headerY = 72;
      const splitX = Math.round(width * 0.48);
      const step = 38;
      ctx.strokeStyle = palette.lineHex;
      ctx.lineWidth = 1;

      // Hourly schedule lines on left, task checkboxes on right
      ctx.fillStyle = palette.isDark ? '#6E7685' : '#8A909E';
      ctx.font = '500 10px ui-monospace, SFMono-Regular, monospace';
      let hour = 6;
      for (let y = headerY + 28; y < height - 36 && hour <= 22; y += step, hour++) {
        ctx.beginPath();
        ctx.moveTo(28, y + 0.5);
        ctx.lineTo(splitX - 16, y + 0.5);
        ctx.stroke();
        const label = `${String(hour).padStart(2, '0')}:00`;
        ctx.fillText(label, 30, y - 6);
      }

      // Priorities & tasks on right
      for (let y = headerY + 28; y < height - 36; y += 30) {
        ctx.strokeRect(splitX + 14, y - 12, 11, 11);
        ctx.beginPath();
        ctx.moveTo(splitX + 32, y - 1);
        ctx.lineTo(width - 28, y - 1);
        ctx.stroke();
      }

      ctx.strokeStyle = palette.marginHex;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(28, headerY);
      ctx.lineTo(width - 28, headerY);
      ctx.moveTo(splitX, headerY);
      ctx.lineTo(splitX, height - 28);
      ctx.stroke();

      ctx.font = '600 10px -apple-system, sans-serif';
      ctx.fillText('DAILY SCHEDULE', 28, headerY - 10);
      ctx.fillText('PRIORITIES & ACTION ITEMS', splitX + 14, headerY - 10);
      break;
    }

    case 'planner-weekly': {
      const headerY = 64;
      const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
      const colW = (width - 56) / 2;
      const rowH = (height - headerY - 36) / 4;
      ctx.strokeStyle = palette.lineHex;
      ctx.lineWidth = 1.1;
      ctx.fillStyle = palette.isDark ? '#6E7685' : '#8A909E';
      ctx.font = '600 10px -apple-system, sans-serif';

      for (let i = 0; i < 8; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 28 + col * colW;
        const y = headerY + row * rowH;
        ctx.strokeRect(x + 2, y + 2, colW - 4, rowH - 4);
        ctx.fillText(days[i] ?? 'WEEKLY FOCUS', x + 10, y + 18);
      }
      break;
    }

    case 'isometric': {
      const step = spacing || 28;
      const dx = step * Math.cos(Math.PI / 6);
      ctx.beginPath();
      for (let x = -height; x < width + height; x += dx * 2) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + height * Math.tan(Math.PI / 3), height);
        ctx.moveTo(x, height);
        ctx.lineTo(x + height * Math.tan(Math.PI / 3), 0);
      }
      for (let x = 0; x < width; x += dx) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();
      break;
    }

    case 'music-staff': {
      const lineGap = 8;
      const staffHeight = lineGap * 4;
      const systemGap = 52;
      ctx.beginPath();
      for (let top = 72; top + staffHeight < height - 48; top += staffHeight + systemGap) {
        for (let i = 0; i < 5; i++) {
          const y = top + i * lineGap + 0.5;
          ctx.moveTo(42, y);
          ctx.lineTo(width - 42, y);
        }
      }
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}
