import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, formatPercent } from './format';

// Shared stylistic constants
const MARGIN_X = 56;   // ~0.78in
const MARGIN_Y = 56;
const TEXT_PRIMARY = [24, 24, 27];
const TEXT_SECONDARY = [82, 82, 91];
const TEXT_MUTED = [113, 113, 122];
const HAIRLINE = [234, 232, 227];
const ACCENT = [37, 99, 235];

function setText(doc, rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }
function setDraw(doc, rgb) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }
function setFill(doc, rgb) { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }

function hairline(doc, y) {
  setDraw(doc, HAIRLINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, doc.internal.pageSize.getWidth() - MARGIN_X, y);
}

function wrap(doc, text, maxWidth) {
  if (!text) return [];
  return doc.splitTextToSize(text, maxWidth);
}

// Draw a section header like "1. Household overview"
function sectionHeader(doc, y, number, title) {
  setText(doc, TEXT_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${number}. ${title}`, MARGIN_X, y);
  return y + 16;
}

function ensureSpace(doc, cursor, needed) {
  const pageH = doc.internal.pageSize.getHeight();
  if (cursor + needed > pageH - MARGIN_Y - 24) {
    doc.addPage();
    drawPageFooter(doc);
    return MARGIN_Y + 36;
  }
  return cursor;
}

function drawPageFooter(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  setDraw(doc, HAIRLINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, pageH - MARGIN_Y, pageW - MARGIN_X, pageH - MARGIN_Y);

  setText(doc, TEXT_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Prepared by CommonGround · Generated ${formatDate(new Date())}`, MARGIN_X, pageH - MARGIN_Y + 14);
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageW - MARGIN_X, pageH - MARGIN_Y + 14, { align: 'right' });

  doc.setFontSize(7.5);
  setText(doc, TEXT_MUTED);
  const legal = 'This memo is informational. Final leasing decisions rest with the authorized agent of record.';
  doc.text(legal, MARGIN_X, pageH - MARGIN_Y + 26);
}

// ── Letterhead ──────────────────────────────────────────────────

function drawLetterhead(doc, { title, deal, applicantNames, preparer, recommendation }) {
  const pageW = doc.internal.pageSize.getWidth();

  // Eyebrow
  setText(doc, TEXT_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('SCRANTON PROPERTY GROUP · INTERNAL USE ONLY', MARGIN_X, MARGIN_Y);

  // Title
  setText(doc, TEXT_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(title, MARGIN_X, MARGIN_Y + 28);

  // Hairline
  hairline(doc, MARGIN_Y + 44);

  // Meta grid: two columns
  const rowY = MARGIN_Y + 62;
  const labelW = 88;
  const col1X = MARGIN_X;
  const col2X = pageW / 2 + 10;

  const metaLeft = [
    ['Unit', `${deal.name}${deal.referenceCode ? ' · ' + deal.referenceCode : ''}`],
    ['Address', deal.locationStr || '—'],
    ['Configuration', `${deal.bedBath || '—'} · ${formatCurrency(deal.estimatedMonthlyCost, { cents: false })}/mo`],
  ];
  const metaRight = [
    ['Applicants', applicantNames],
    ['Prepared by', preparer],
    ['Date', formatDate(new Date())],
  ];

  function drawMetaCol(entries, x, startY) {
    let y = startY;
    for (const [label, value] of entries) {
      setText(doc, TEXT_MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(label.toUpperCase(), x, y);

      setText(doc, TEXT_PRIMARY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lines = wrap(doc, String(value || '—'), pageW / 2 - 30 - labelW);
      doc.text(lines, x, y + 12);
      y += 12 + (lines.length * 12) + 6;
    }
    return y;
  }

  const leftEnd = drawMetaCol(metaLeft, col1X, rowY);
  const rightEnd = drawMetaCol(metaRight, col2X, rowY);
  let y = Math.max(leftEnd, rightEnd) + 8;

  // Recommendation box
  hairline(doc, y);
  y += 14;
  setText(doc, TEXT_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('RECOMMENDATION', MARGIN_X, y);
  y += 14;

  setText(doc, TEXT_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const recLines = wrap(doc, recommendation, pageW - 2 * MARGIN_X);
  doc.text(recLines, MARGIN_X, y);
  y += recLines.length * 14 + 10;

  hairline(doc, y);
  return y + 18;
}

// ── Narrative paragraph helper ───────────────────────────────────

function drawParagraph(doc, cursor, body, { maxWidth, lineHeight = 13 } = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  setText(doc, TEXT_SECONDARY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = wrap(doc, body || '—', maxWidth || pageW - 2 * MARGIN_X);
  let y = cursor;
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight + 4);
    doc.text(line, MARGIN_X, y);
    y += lineHeight;
  }
  return y + 6;
}

// ── Key-value row ────────────────────────────────────────────────

function drawKV(doc, cursor, label, value) {
  setText(doc, TEXT_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(label, MARGIN_X, cursor);

  setText(doc, TEXT_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(value, MARGIN_X + 220, cursor);
  return cursor + 14;
}

// ── Deal memo main entry point ───────────────────────────────────

export function generateDealMemo({
  project,
  members,
  narratives,
  allocationRows,
  allocationModelLabel,
  metrics,
  safetyFlags,
  recommendation,
  preparer = 'K. Arellano, Underwriter',
  sections = { household: true, underwriting: true, allocation: true, safety: true, recommendation: true },
  mode = 'memo', // 'memo' | 'addendum'
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - 2 * MARGIN_X;

  const title = mode === 'addendum' ? 'LEASE ALLOCATION ADDENDUM' : 'DEAL MEMO';

  const loc = project?.location;
  const locationStr = loc?.city && loc?.state ? `${loc.city}, ${loc.state}` : '';
  const deal = {
    name: project?.name,
    referenceCode: project?.referenceCode,
    locationStr,
    bedBath: project?.bedBath,
    estimatedMonthlyCost: project?.estimatedMonthlyCost,
  };

  const applicantNames = members.map((m) => `${m.firstName} ${m.lastInitial}.`).join(', ');

  let y = drawLetterhead(doc, {
    title,
    deal,
    applicantNames,
    preparer,
    recommendation,
  });

  // § Household overview
  if (mode === 'memo' && sections.household && narratives?.household) {
    y = ensureSpace(doc, y, 80);
    y = sectionHeader(doc, y, '1', 'Household overview');
    y = drawParagraph(doc, y, narratives.household, { maxWidth: contentW });
    y += 6;
  }

  // § Underwriting
  if (mode === 'memo' && sections.underwriting && metrics) {
    y = ensureSpace(doc, y, 110);
    y = sectionHeader(doc, y, '2', 'Underwriting');

    y = drawKV(doc, y, 'Aggregate gross monthly income', formatCurrency(metrics.combinedIncome, { cents: true }));
    y = drawKV(doc, y, 'Recurring debt service', formatCurrency(metrics.combinedObligations, { cents: true }));
    y = drawKV(doc, y, 'Housing cost', formatCurrency(metrics.monthlyCost, { cents: true }));
    y = drawKV(doc, y, 'Front-end ratio', formatPercent(metrics.groupDTI));
    y = drawKV(doc, y, 'Residual income', formatCurrency(metrics.residual, { cents: true }));
    y = drawKV(doc, y, 'Income source concentration', String(metrics.concentration ?? '—'));
    y += 4;

    if (narratives?.underwriting) {
      y = drawParagraph(doc, y, narratives.underwriting, { maxWidth: contentW });
    }
    y += 4;
  }

  // § Allocation
  if (sections.allocation && allocationRows && allocationRows.length) {
    y = ensureSpace(doc, y, 140);
    const sectionNumber = mode === 'addendum' ? '1' : '3';
    const heading = mode === 'addendum'
      ? `Allocation · ${allocationModelLabel}`
      : `Allocation (${allocationModelLabel})`;
    y = sectionHeader(doc, y, sectionNumber, heading);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
        lineColor: HAIRLINE,
        lineWidth: 0.5,
        textColor: TEXT_PRIMARY,
      },
      headStyles: {
        fillColor: [245, 243, 238],
        textColor: TEXT_MUTED,
        fontStyle: 'normal',
        fontSize: 8,
        cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
      },
      theme: 'plain',
      tableLineColor: HAIRLINE,
      tableLineWidth: 0.5,
      head: [['Applicant', 'Gross income', 'Allocation', '% of income', 'Residual']],
      body: allocationRows.map((r) => [
        r.name,
        formatCurrency(r.income, { cents: true }),
        formatCurrency(r.amount, { cents: true }),
        formatPercent(r.pct),
        formatCurrency(r.residual, { cents: true }),
      ]),
      foot: [[
        'Total',
        formatCurrency(allocationRows.reduce((s, r) => s + (r.income || 0), 0), { cents: true }),
        formatCurrency(allocationRows.reduce((s, r) => s + (r.amount || 0), 0), { cents: true }),
        '',
        formatCurrency(allocationRows.reduce((s, r) => s + (r.residual || 0), 0), { cents: true }),
      ]],
      footStyles: {
        fillColor: [250, 249, 247],
        textColor: TEXT_PRIMARY,
        fontStyle: 'bold',
      },
      didDrawPage: () => drawPageFooter(doc),
    });

    y = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 14 : y + 120;
  }

  // § Safety
  if (mode === 'memo' && sections.safety) {
    y = ensureSpace(doc, y, 80);
    y = sectionHeader(doc, y, '4', 'Safety review');
    if (!safetyFlags || safetyFlags.length === 0) {
      y = drawParagraph(doc, y, 'No adverse records. All co-applicants cleared criminal, eviction, and identity verification.');
    } else {
      for (const f of safetyFlags) {
        setText(doc, TEXT_PRIMARY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${f.applicant}`, MARGIN_X, y);
        y += 13;
        y = drawParagraph(doc, y, f.summary);
        if (f.chips && f.chips.length) {
          setText(doc, TEXT_MUTED);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(f.chips.join('   ·   '), MARGIN_X, y);
          y += 14;
        }
      }
    }
    y += 4;
  }

  // § Recommendation
  if (mode === 'memo' && sections.recommendation && narratives?.recommendation) {
    y = ensureSpace(doc, y, 80);
    y = sectionHeader(doc, y, '5', 'Recommendation');
    y = drawParagraph(doc, y, narratives.recommendation);
  }

  // Signature line for addendum mode
  if (mode === 'addendum') {
    y = ensureSpace(doc, y, 180);
    y += 12;
    hairline(doc, y);
    y += 18;

    setText(doc, TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('ACKNOWLEDGEMENT', MARGIN_X, y);
    y += 14;

    setText(doc, TEXT_PRIMARY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const ack = `Each co-applicant acknowledges the allocation amounts listed above and agrees that the allocation is internal to the household; all tenants remain jointly and severally liable for the full monthly rent of ${formatCurrency(project?.estimatedMonthlyCost, { cents: true })} under the lease.`;
    y = drawParagraph(doc, y, ack);

    y += 20;
    // Signature rows
    for (const m of members) {
      y = ensureSpace(doc, y, 40);
      setDraw(doc, HAIRLINE);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_X, y, MARGIN_X + 220, y);
      doc.line(MARGIN_X + 260, y, pageW - MARGIN_X, y);
      y += 10;
      setText(doc, TEXT_MUTED);
      doc.setFontSize(8);
      doc.text(`${m.firstName} ${m.lastInitial}.`, MARGIN_X, y);
      doc.text('Date', MARGIN_X + 260, y);
      y += 22;
    }
  }

  // Footer on last page
  drawPageFooter(doc);

  const filename = mode === 'addendum'
    ? `allocation-addendum-${(project?.referenceCode || project?._id || 'deal')}.pdf`
    : `deal-memo-${(project?.referenceCode || project?._id || 'deal')}.pdf`;

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { url, filename, blob };
}
