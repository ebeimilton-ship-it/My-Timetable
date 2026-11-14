/* ──────────────────────────────────────────────────────────────
   exporter.js — PDF (jsPDF + autotable) and PNG (html2canvas) exporters for every mode.
   ────────────────────────────────────────────────────────────── */

function pdfLibsReady() {
  try {
    if (typeof window.jspdf === 'undefined') {
      _pdfLibsFailReason = 'window.jspdf is undefined';
      return false;
    }
    if (typeof window.jspdf.jsPDF !== 'function') {
      _pdfLibsFailReason = 'window.jspdf.jsPDF is not a function (typeof: ' + typeof window.jspdf.jsPDF + ')';
      return false;
    }
    const testDoc = new window.jspdf.jsPDF();
    if (typeof testDoc.autoTable !== 'function') {
      _pdfLibsFailReason = 'autoTable did not attach (typeof: ' + typeof testDoc.autoTable + ')';
      return false;
    }
    _pdfLibsFailReason = '';
    return true;
  } catch (e) {
    _pdfLibsFailReason = 'threw: ' + (e && e.message ? e.message : e);
    return false;
  }
}

let _pdfRetryInFlight = false;

// jsPDF-AutoTable's classic <script> build tries to auto-detect its module
// environment (CommonJS/AMD/global) to attach itself to jsPDF, and that
// detection is known to silently fail in some browser conditions — jsPDF
// loads fine but .autoTable never gets attached, with no load error at all
// (see simonbengtsson/jsPDF-AutoTable issues #860, #984, #997). Loading
// both as real ES modules and calling the plugin's own applyPlugin(jsPDF)
// sidesteps that detection entirely instead of hoping the auto-attach works.
async function _loadPdfLibsESM(jspdfUrl, autotableUrl) {
  const jspdfMod = await import(/* webpackIgnore: true */ jspdfUrl);
  const autotableMod = await import(/* webpackIgnore: true */ autotableUrl);
  const jsPDF = jspdfMod.jsPDF || jspdfMod.default;
  if (typeof jsPDF !== 'function') throw new Error('jsPDF export missing from module');
  if (typeof autotableMod.applyPlugin === 'function') {
    autotableMod.applyPlugin(jsPDF);
  } else if (typeof autotableMod.default === 'function') {
    jsPDF.API.autoTable = function (options) {
      return autotableMod.default(this, options);
    };
  } else {
    throw new Error('no usable autoTable export found');
  }
  window.jspdf = window.jspdf || {};
  window.jspdf.jsPDF = jsPDF;
}

// Two independent ESM CDN sources, tried in order.
const _PDF_LIB_SOURCES = [
  {
    jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm',
    autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.12/+esm',
  },
  {
    jspdf: 'https://esm.sh/jspdf@2.5.1',
    autotable: 'https://esm.sh/jspdf-autotable@3.5.12',
  },
];

function _tryPdfLibSource(i, retryFn) {
  if (i >= _PDF_LIB_SOURCES.length) {
    _pdfRetryInFlight = false;
    showToast('PDF tools failed: ' + _pdfLibsFailReason, 'error');
    return;
  }
  const src = _PDF_LIB_SOURCES[i];
  _loadPdfLibsESM(src.jspdf, src.autotable)
    .then(() => {
      if (pdfLibsReady()) {
        _pdfRetryInFlight = false;
        retryFn();
      } else {
        _tryPdfLibSource(i + 1, retryFn);
      }
    })
    .catch((e) => {
      _pdfLibsFailReason = 'ESM import threw: ' + (e && e.message ? e.message : e);
      _tryPdfLibSource(i + 1, retryFn);
    });
}

function retryPdfLibsThen(retryFn) {
  if (_pdfRetryInFlight) return;
  _pdfRetryInFlight = true;
  showToast('Preparing PDF tools, please wait…', 'info');
  _tryPdfLibSource(0, retryFn);
}

function examDownloadPDF(useCustomColors = true) {
  if (!pdfLibsReady()) {
    retryPdfLibsThen(() => examDownloadPDF(useCustomColors));
    return;
  }
  window._pdfUseCustomColors = useCustomColors;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const name = document.getElementById('examStudentName').value.trim();
  const year = document.getElementById('examStudentYear').value;
  const dept = document.getElementById('examStudentDept').value.trim();
  let semester = document.getElementById('examStudentSemester').value;
  const acadYear = '2026/2027';
  const dateStr = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  const margin = 8;

  function buildHeader(logoDataUrl) {
    const headerH = 58;

    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, pageW, 3.5, 'F');

    doc.setFillColor(251, 191, 36);
    doc.rect(0, 3.5, pageW, 1, 'F');

    const logoH = 22,
      logoTopY = 7;
    if (logoDataUrl) {
      const tmpImg = new Image();
      tmpImg.src = logoDataUrl;
      const logoW = tmpImg.width > 0 ? (tmpImg.width / tmpImg.height) * logoH : logoH;
      doc.addImage(logoDataUrl, 'PNG', (pageW - logoW) / 2, logoTopY, logoW, logoH);
    }

    let y = logoTopY + logoH + 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(23, 23, 23);
    doc.text('MASENO UNIVERSITY', pageW / 2, y, { align: 'center' });
    y += 5.5;
    if (dept) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(125, 133, 144);
      doc.text(dept.toUpperCase(), pageW / 2, y, { align: 'center' });
      y += 5;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(249, 115, 22);
    doc.text('EXAMINATION TIMETABLE', pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 95, 6);
    doc.text(`${acadYear} ACADEMIC YEAR  —  SEMESTER ${semester}`, pageW / 2, y, { align: 'center' });
    if (name || year) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(125, 133, 144);
      let sub = [name, year ? `Year ${year}` : ''].filter(Boolean).join(' · ');
      doc.text(sub, pageW - margin, headerH - 4, { align: 'right' });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(125, 133, 144);
    doc.text(`Generated: ${dateStr}`, margin, headerH - 4);

    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.4);
    doc.line(0, headerH, pageW, headerH);

    return headerH + 6;
  }

  function finishPDF(y) {
    const sorted = [...examUnits].sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      return dateDiff !== 0 ? dateDiff : a.start - b.start;
    });

    const PALETTE = [
      { bg: [219, 234, 254], text: [29, 78, 216], accent: [59, 130, 246] },
      { bg: [220, 252, 231], text: [21, 128, 61], accent: [34, 197, 94] },
      { bg: [254, 243, 199], text: [146, 64, 14], accent: [245, 158, 11] },
      { bg: [252, 231, 243], text: [157, 23, 77], accent: [236, 72, 153] },
      { bg: [237, 233, 254], text: [109, 40, 217], accent: [139, 92, 246] },
      { bg: [204, 251, 241], text: [15, 118, 110], accent: [20, 184, 166] },
      { bg: [255, 237, 213], text: [154, 52, 18], accent: [249, 115, 22] },
      { bg: [240, 253, 244], text: [22, 101, 52], accent: [16, 185, 129] },
      { bg: [239, 246, 255], text: [30, 64, 175], accent: [99, 102, 241] },
      { bg: [254, 226, 226], text: [153, 27, 27], accent: [239, 68, 68] },
      { bg: [236, 253, 245], text: [6, 95, 70], accent: [52, 211, 153] },
      { bg: [255, 251, 235], text: [120, 53, 15], accent: [251, 191, 36] },
    ];

    const unitColorMap = buildUnitColorMap(sorted, PALETTE, window._pdfUseCustomColors);

    const rowColorMap = {};
    const rowZebraMap = {};
    const body = [];
    let lastDate = null;
    let examNum = 0;
    let zebraIdx = 0;

    sorted.forEach((u) => {
      if (u.date !== lastDate) {
        body.push([
          {
            content: formatDate(u.date),
            colSpan: 5,
            styles: {
              fillColor: [22, 27, 34],
              textColor: [249, 115, 22],
              fontStyle: 'bold',
              fontSize: 8.5,
              halign: 'left',
              cellPadding: { top: 4, bottom: 4, left: 6, right: 3 },
            },
          },
        ]);
        lastDate = u.date;
      }
      examNum++;
      const palette = unitColorMap[u.code];
      rowColorMap[body.length] = palette;
      rowZebraMap[body.length] = zebraIdx % 2;
      zebraIdx++;
      body.push([examNum, u.code, u.name, u.timeStr, u.venue]);
    });

    const head = [['#', 'Code', 'Unit Name', 'Time', 'Venue']];

    doc.autoTable({
      head,
      body,
      startY: y,
      margin: { left: 10, right: 10 },
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
        valign: 'middle',
        lineColor: [48, 54, 61],
        lineWidth: 0.3,
      },
      headStyles: { fillColor: [13, 17, 23], textColor: [251, 191, 36], fontStyle: 'bold', fontSize: 8, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 28, fontStyle: 'bold', cellPadding: { top: 4, bottom: 4, left: 7, right: 3 } },
        2: { cellWidth: 'auto', halign: 'left' },
        3: { cellWidth: 32, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' },
      },
      theme: 'grid',
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const palette = rowColorMap[data.row.index];
        if (!palette) return;
        const zebra = rowZebraMap[data.row.index];
        data.cell.styles.fillColor = zebra ? [246, 248, 251] : [255, 255, 255];
        data.cell.styles.textColor = [45, 52, 64];
        if (data.column.index === 1) {
          data.cell.styles.textColor = palette.label;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const palette = rowColorMap[data.row.index];
        if (!palette) return;
        if (data.column.index === 1) {
          doc.setFillColor(...palette.accent);
          doc.setDrawColor(...palette.label);
          doc.setLineWidth(0.15);
          doc.circle(data.cell.x + 3, data.cell.y + data.cell.height / 2, 1.1, 'FD');
        }
      },
    });

    const finalY = doc.lastAutoTable.finalY + 6;
    let afterTableY = finalY;
    const pageH = doc.internal.pageSize.getHeight();

    const collisionData = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[i].date !== sorted[j].date) continue;
        const endI = sorted[i].start + sorted[i].dur;
        if (sorted[j].start < endI) {
          collisionData.push({
            unitA: sorted[i],
            unitB: sorted[j],
            date: sorted[i].date,
            timeA: sorted[i].timeStr || '',
            timeB: sorted[j].timeStr || '',
          });
        }
      }
    }

    if (collisionData.length > 0) {
      const collHead = [['Unit A', 'Unit B', 'Date', 'Time A', 'Time B']];
      const collBody = collisionData.map((c) => [
        { content: c.unitA.code, styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' } },
        { content: c.unitB.code, styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' } },
        formatDate(c.date),
        c.timeA,
        c.timeB,
      ]);

      if (afterTableY + 40 > pageH) {
        doc.addPage();
        afterTableY = 15;
      }

      doc.setFillColor(220, 38, 38);
      doc.rect(10, afterTableY, 2.5, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(153, 27, 27);
      doc.text('Date/Time Collisions', 15, afterTableY + 5.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 53, 53);
      doc.text(
        `${collisionData.length} collision${collisionData.length > 1 ? 's' : ''} detected — highlighted in red above`,
        15,
        afterTableY + 10,
      );
      afterTableY += 14;

      doc.autoTable({
        head: collHead,
        body: collBody,
        startY: afterTableY,
        margin: { left: 10, right: 10 },
        styles: {
          fontSize: 8,
          cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
          valign: 'middle',
          lineColor: [252, 165, 165],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 28, halign: 'center' },
          2: { cellWidth: 'auto', halign: 'left' },
          3: { cellWidth: 35, halign: 'center' },
          4: { cellWidth: 35, halign: 'center' },
        },
        theme: 'grid',
        didParseCell: (data) => {
          if (data.section === 'body' && (data.column.index === 2 || data.column.index === 3 || data.column.index === 4)) {
            data.cell.styles.fillColor = [255, 245, 245];
            data.cell.styles.textColor = [100, 30, 30];
          }
        },
      });
      afterTableY = doc.lastAutoTable.finalY + 6;
    }

    pdfStampAllPages(doc, pageW, pageH);

    const filename = name ? `${name.replace(/\s+/g, '-')}-exam-timetable.pdf` : 'maseno-exam-timetable.pdf';
    doc.save(filename);
  }

  const img = new Image();
  img.onload = function () {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    finishPDF(buildHeader(canvas.toDataURL('image/png')));
  };
  img.onerror = function () {
    finishPDF(buildHeader(null));
  };
  loadLogoInto(img);
}

// Tries each logo location in turn, then calls img.onload / img.onerror.
function loadLogoInto(img) {
  let i = 0;
  const failHandler = img.onerror;
  img.onerror = () => {
    i++;
    if (i < LOGO_SOURCES.length) img.src = LOGO_SOURCES[i];
    else if (failHandler) failHandler();
  };
  img.crossOrigin = 'anonymous';
  img.src = LOGO_SOURCES[0];
}

async function exportGridAsImage(gridId, subtitle, filenameBase, btnEl) {
  const grid = document.getElementById(gridId);
  const table = grid ? grid.querySelector('.tt-week') || grid.querySelector('table') : null;
  if (!table) {
    showToast('Build your timetable first, then export it as an image.', 'error');
    return;
  }
  if (typeof html2canvas === 'undefined') {
    showToast('Image export is still loading — please try again in a second.', 'error');
    return;
  }

  const originalBtnHtml = btnEl ? btnEl.innerHTML : null;
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = 'Preparing image…';
  }

  const tableHtml = table.outerHTML
    .replaceAll('background:#0f1e3a;color:#60a5fa;', 'background:#c2620a;color:#ffffff;')
    .replaceAll('color:#60a5fa;', 'color:#1d4ed8;')
    .replaceAll('color:#22c55e;', 'color:#15803d;')
    .replaceAll('color:#f87171;', 'color:#dc2626;')
    .replaceAll('background:#3b0000;', 'background:#fee2e2;');

  const wrap = document.createElement('div');
  wrap.className = 'image-export-wrap';
  wrap.setAttribute('data-theme', 'light');
  wrap.innerHTML = `
<div class="ie-header">
<img src="${LOGO_SOURCES[0]}" alt="Maseno University" crossorigin="anonymous" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${LOGO_SOURCES[1]}'}else{this.style.display='none'}" />
<div>
<h2>Maseno University</h2>
<p>${subtitle}</p>
</div>
</div>
${tableHtml}
<div class="ie-footer">
<span>Generated with <span class="ie-brand">Maseno Timetable Generator</span></span>
<span>${new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
</div>
`;
  document.body.appendChild(wrap);

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await html2canvas(wrap, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const link = document.createElement('a');
    link.download = `${filenameBase}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error(err);
    showToast('Something went wrong exporting the image. Please try again.', 'error');
  } finally {
    wrap.remove();
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = originalBtnHtml;
    }
  }
}

function exportClassImage(btnEl) {
  const title = document.getElementById('outputTitle')?.textContent || 'Class Timetable';
  exportGridAsImage('timetableGrid', title, 'maseno-class-timetable', btnEl);
}

function examExportImage(btnEl) {
  const title = document.getElementById('examOutputTitle')?.textContent || 'Examination Timetable';
  exportGridAsImage('examGrid', title, 'maseno-exam-timetable', btnEl);
}

function groupExportImage(btnEl) {
  const label = grpWeekLabel ? grpWeekLabel() : '';
  exportGridAsImage('grpGrid', `Group Discussion Timetable${label ? ' · ' + label : ''}`, 'maseno-group-timetable', btnEl);
}

function personalExportImage(btnEl) {
  const label = psWeekLabel ? psWeekLabel() : '';
  exportGridAsImage('psGrid', `Personal Study Timetable${label ? ' · ' + label : ''}`, 'maseno-study-timetable', btnEl);
}

// ---- PDF visual-polish helpers (shared across PDF exports) ----

// Rounds one page corner by erasing the square notch to white, then redrawing
// a circle centered exactly on the page corner — the PDF page boundary clips
// it to a perfect quarter-circle, so the bleed color underneath reads as rounded.
function pdfCornerRound(doc, pageW, pageH, corner, r, color) {
  const atLeft = corner === 'tl' || corner === 'bl';
  const atTop = corner === 'tl' || corner === 'tr';
  const cx = atLeft ? 0 : pageW;
  const cy = atTop ? 0 : pageH;
  doc.setFillColor(255, 255, 255);
  doc.rect(atLeft ? 0 : pageW - r, atTop ? 0 : pageH - r, r, r, 'F');
  doc.setFillColor(...color);
  doc.circle(cx, cy, r, 'F');
}

// Thin rounded-corner outline traced just inside the page edge.
function pdfPageFrame(doc, pageW, pageH, r) {
  doc.setDrawColor(210, 214, 222);
  doc.setLineWidth(0.5);
  doc.roundedRect(1, 1, pageW - 2, pageH - 2, r, r, 'S');
}

// Subtle top-down gradient wash for the header band (simulated with stepped bands).
function pdfHeaderGradient(doc, pageW, fromY, toY, topColor, bottomColor) {
  const steps = 24;
  const h = (toY - fromY) / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(topColor[0] + (bottomColor[0] - topColor[0]) * t);
    const g = Math.round(topColor[1] + (bottomColor[1] - topColor[1]) * t);
    const b = Math.round(topColor[2] + (bottomColor[2] - topColor[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(0, fromY + i * h, pageW, h + 0.5, 'F');
  }
}

// Soft drop-shadow strip under the header so it visually "floats" above the content.
function pdfHeaderShadow(doc, pageW, y) {
  const bands = [
    { h: 0.5, gray: 200, opacity: 0.16 },
    { h: 0.5, gray: 210, opacity: 0.1 },
    { h: 0.6, gray: 220, opacity: 0.06 },
    { h: 0.7, gray: 230, opacity: 0.03 },
  ];
  let cy = y;
  bands.forEach((b) => {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: b.opacity }));
    doc.setFillColor(b.gray, b.gray, b.gray);
    doc.rect(0, cy, pageW, b.h, 'F');
    doc.restoreGraphicsState();
    cy += b.h;
  });
}

// Very faint diagonal watermark overlay.
function pdfWatermark(doc, pageW, centerY, text) {
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.045 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(44);
  doc.setTextColor(120, 128, 140);
  doc.text(text, pageW / 2, centerY, { align: 'center', angle: 35 });
  doc.restoreGraphicsState();
}

// "At a glance" summary chip box. Returns the Y position just below the box.
function pdfSummaryBox(doc, x, y, w, stats) {
  const h = 13;
  doc.setFillColor(247, 248, 250);
  doc.setDrawColor(230, 233, 238);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  const colW = w / stats.length;
  stats.forEach((s, i) => {
    const cx = x + colW * i + colW / 2;
    if (i > 0) {
      doc.setDrawColor(224, 227, 233);
      doc.setLineWidth(0.25);
      doc.line(x + colW * i, y + 2.5, x + colW * i, y + h - 2.5);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(140, 148, 160);
    doc.text(s.label.toUpperCase(), cx, y + 5, { align: 'center', charSpace: 0.15 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 33, 38);
    doc.text(String(s.value), cx, y + 10, { align: 'center' });
  });
  return y + h;
}

// Small vector clock icon (no external font dependency).
function pdfClockIcon(doc, cx, cy, r, color) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.28);
  doc.circle(cx, cy, r, 'S');
  doc.line(cx, cy, cx, cy - r * 0.6);
  doc.line(cx, cy, cx + r * 0.45, cy);
}

// Small vector map-pin icon.
function pdfPinIcon(doc, cx, cy, r, color) {
  doc.setFillColor(...color);
  doc.circle(cx, cy - r * 0.15, r * 0.62, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy - r * 0.15, r * 0.24, 'F');
  doc.setFillColor(...color);
  doc.triangle(cx - r * 0.42, cy + r * 0.1, cx + r * 0.42, cy + r * 0.1, cx, cy + r * 0.85, 'F');
}

// Stamps the branded footer (and page number, if the PDF has more than one page)
// on every page of the document — not just whichever page happened to be
// active when the content finished. Call this last, right before doc.save().
function pdfStampAllPages(doc, pageW, pageH) {
  const totalPages = doc.internal.getNumberOfPages();
  const footerH = 10;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(13, 17, 23);
    doc.rect(0, pageH - footerH, pageW, footerH, 'F');
    doc.setFillColor(249, 115, 22);
    doc.rect(0, pageH - footerH, pageW, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(125, 133, 144);
    doc.text('Milton Tech Solutions — Free for Maseno University Students', pageW / 2, pageH - 4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(249, 115, 22);
    doc.text('miltontech.co.ke', pageW - 8, pageH - 4, { align: 'right' });
    if (totalPages > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(125, 133, 144);
      doc.text(`Page ${i} of ${totalPages}`, 8, pageH - 4, { align: 'left' });
    }
    pdfCornerRound(doc, pageW, pageH, 'bl', 3, [13, 17, 23]);
    pdfCornerRound(doc, pageW, pageH, 'br', 3, [13, 17, 23]);
    pdfPageFrame(doc, pageW, pageH, 3);
  }
}

function downloadPDF(useCustomColors = true) {
  if (!pdfLibsReady()) {
    retryPdfLibsThen(() => downloadPDF(useCustomColors));
    return;
  }
  window._pdfUseCustomColors = useCustomColors;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const name = document.getElementById('studentName').value.trim();
  const year = document.getElementById('studentYear').value;
  const dept = document.getElementById('studentDept').value.trim();
  let semester = document.getElementById('studentSemester').value;
  const acadYear = '2026/2027';

  const margin = 8;

  const headerH = 58;

  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, pageW, 3.5, 'F');

  doc.setFillColor(251, 191, 36);
  doc.rect(0, 3.5, pageW, 1, 'F');

  const PDF_CORNER_R = 3;
  pdfCornerRound(doc, pageW, pageH, 'tl', PDF_CORNER_R, [249, 115, 22]);
  pdfCornerRound(doc, pageW, pageH, 'tr', PDF_CORNER_R, [249, 115, 22]);

  pdfHeaderGradient(doc, pageW, 4.5, headerH, [255, 247, 237], [255, 255, 255]);

  let logoPlaced = false;
  const logoImg = document.querySelector('.tt-header img');
  const logoH = 22,
    logoTopY = 7;
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = logoImg.naturalWidth;
      canvas.height = logoImg.naturalHeight;
      canvas.getContext('2d').drawImage(logoImg, 0, 0);
      const imgData = canvas.toDataURL('image/png');
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      doc.addImage(imgData, 'PNG', (pageW - logoW) / 2, logoTopY, logoW, logoH);
      logoPlaced = true;
    } catch (e) {}
  }

  const textX = pageW / 2;
  let hY = logoTopY + logoH + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 23, 23);
  doc.text('MASENO UNIVERSITY', textX, hY, { align: 'center', charSpace: 0.35 });
  hY += 6;

  if (dept) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(125, 133, 144);
    doc.text(dept.toUpperCase(), textX, hY, { align: 'center', charSpace: 0.12 });
    hY += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(249, 115, 22);
  doc.text('CLASS TIMETABLE', textX, hY, { align: 'center', charSpace: 0.1 });
  hY += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 95, 6);
  doc.text(`${acadYear} ACADEMIC YEAR  ·  SEMESTER ${semester}`, textX, hY, { align: 'center' });

  if (name || year) {
    const pill = [name, year ? 'Year ' + year : ''].filter(Boolean).join('  ·  ');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(125, 133, 144);
    doc.text(pill, pageW - margin, headerH - 4, { align: 'right' });
  }

  const dateStr = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(125, 133, 144);
  doc.text(`Generated: ${dateStr}`, margin, headerH - 4);

  doc.setDrawColor(225, 225, 225);
  doc.setLineWidth(0.4);
  doc.line(0, headerH, pageW, headerH);
  pdfHeaderShadow(doc, pageW, headerH);

  const DAY_ORDER = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5 };

  const sorted = [...selectedUnits].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 9) - (DAY_ORDER[b.day] ?? 9);
    return dayDiff !== 0 ? dayDiff : a.startHour - b.startHour;
  });

  const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const FREE_DAY_CANDIDATES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayCounts = {};
  sorted.forEach((u) => {
    dayCounts[u.day] = (dayCounts[u.day] || 0) + 1;
  });
  const busiestDay = Object.keys(dayCounts).sort((a, b) => dayCounts[b] - dayCounts[a])[0] || '—';
  const usedDaySet = new Set(sorted.map((u) => u.day));
  const freeDays = FREE_DAY_CANDIDATES.filter((d) => !usedDaySet.has(d));
  const freeDaysStr = freeDays.length ? freeDays.map((d) => d.slice(0, 3)).join(', ') : 'None';

  let startY =
    pdfSummaryBox(doc, margin, headerH + 5, pageW - margin * 2, [
      { label: 'Total Units', value: sorted.length },
      { label: 'Busiest Day', value: busiestDay },
      { label: 'Free Days', value: freeDaysStr },
    ]) + 5;

  const PALETTE = [
    { bg: [219, 234, 254], text: [29, 78, 216], accent: [59, 130, 246] },
    { bg: [220, 252, 231], text: [21, 128, 61], accent: [34, 197, 94] },
    { bg: [254, 243, 199], text: [146, 64, 14], accent: [245, 158, 11] },
    { bg: [252, 231, 243], text: [157, 23, 77], accent: [236, 72, 153] },
    { bg: [237, 233, 254], text: [109, 40, 217], accent: [139, 92, 246] },
    { bg: [204, 251, 241], text: [15, 118, 110], accent: [20, 184, 166] },
    { bg: [255, 237, 213], text: [154, 52, 18], accent: [249, 115, 22] },
    { bg: [240, 253, 244], text: [22, 101, 52], accent: [16, 185, 129] },
    { bg: [239, 246, 255], text: [30, 64, 175], accent: [99, 102, 241] },
    { bg: [254, 226, 226], text: [153, 27, 27], accent: [239, 68, 68] },
    { bg: [236, 253, 245], text: [6, 95, 70], accent: [52, 211, 153] },
    { bg: [255, 251, 235], text: [120, 53, 15], accent: [251, 191, 36] },
  ];
  const unitColorMap = buildUnitColorMap(sorted, PALETTE, window._pdfUseCustomColors);

  const rowColorMap = {};
  const rowZebraMap = {};
  const body = [];
  let lastDay = null;
  let classNum = 0;
  let zebraIdx = 0;

  sorted.forEach((u) => {
    if (u.day !== lastDay) {
      body.push([
        {
          content: u.day.toUpperCase(),
          colSpan: 5,
          styles: {
            fillColor: [22, 27, 34],
            textColor: [249, 115, 22],
            fontStyle: 'bold',
            fontSize: 9.5,
            halign: 'left',
            cellPadding: { top: 4, bottom: 4, left: 6, right: 3 },
          },
        },
      ]);
      lastDay = u.day;
    }
    classNum++;
    const palette = unitColorMap[u.code];
    rowColorMap[body.length] = palette;
    rowZebraMap[body.length] = zebraIdx % 2;
    zebraIdx++;
    body.push([classNum, u.code, u.name, u.time, u.venue + (u.lecturer ? '\n' + u.lecturer : '')]);
  });

  const head = [['#', 'CODE', 'UNIT NAME', 'TIME', 'VENUE / LECTURER']];

  doc.autoTable({
    head,
    body,
    startY,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      valign: 'middle',
      lineColor: [200, 210, 230],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [13, 17, 23],
      textColor: [251, 191, 36],
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'bold', cellPadding: { top: 4, bottom: 4, left: 7, right: 3 } },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 38, halign: 'left', cellPadding: { top: 4, bottom: 4, left: 8, right: 3 } },
      4: { cellWidth: 38, halign: 'left', cellPadding: { top: 4, bottom: 4, left: 8, right: 3 } },
    },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const palette = rowColorMap[data.row.index];
      if (!palette) return;
      const zebra = rowZebraMap[data.row.index];
      data.cell.styles.fillColor = zebra ? [246, 248, 251] : [255, 255, 255];
      data.cell.styles.textColor = [45, 52, 64];
      if (data.column.index === 1) {
        data.cell.styles.textColor = palette.label;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const palette = rowColorMap[data.row.index];
      if (!palette) return;
      if (data.column.index === 1) {
        doc.setFillColor(...palette.accent);
        doc.setDrawColor(...palette.label);
        doc.setLineWidth(0.15);
        doc.circle(data.cell.x + 3, data.cell.y + data.cell.height / 2, 1.1, 'FD');
      } else if (data.column.index === 3) {
        pdfClockIcon(doc, data.cell.x + 3.5, data.cell.y + data.cell.height / 2, 1.4, [150, 158, 170]);
      } else if (data.column.index === 4) {
        pdfPinIcon(doc, data.cell.x + 3.5, data.cell.y + (data.row.height > 12 ? 6.5 : data.cell.height / 2), 1.5, [150, 158, 170]);
      }
    },
  });

  doc.setDrawColor(214, 219, 228);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin - 0.6, startY - 0.6, pageW - margin * 2 + 1.2, doc.lastAutoTable.finalY - startY + 1.2, 2.5, 2.5, 'S');

  let afterTableY = doc.lastAutoTable.finalY + 6;

  if (_collisionData.length > 0) {
    const collHead = [['UNIT A', 'UNIT B', 'DAY', 'TIME A', 'TIME B']];
    const collBody = _collisionData.map((c) => [
      { content: c.unitA.code, styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' } },
      { content: c.unitB.code, styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' } },
      c.day,
      c.timeA,
      c.timeB,
    ]);

    if (afterTableY + 40 > pageH) {
      doc.addPage();
      afterTableY = 15;
    }

    doc.setFillColor(220, 38, 38);
    doc.rect(margin, afterTableY, 2.5, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(153, 27, 27);
    doc.text('Unit Collisions', margin + 5, afterTableY + 5.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 53, 53);
    doc.text(
      `${_collisionData.length} collision${_collisionData.length > 1 ? 's' : ''} detected — highlighted in red below`,
      margin + 5,
      afterTableY + 10,
    );
    afterTableY += 14;

    doc.autoTable({
      head: collHead,
      body: collBody,
      startY: afterTableY,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
        valign: 'middle',
        lineColor: [252, 165, 165],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [220, 38, 38],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 28, halign: 'center' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 'auto', halign: 'left' },
        3: { cellWidth: 35, halign: 'center' },
        4: { cellWidth: 35, halign: 'center' },
      },
      theme: 'grid',
      didParseCell: (data) => {
        if (data.section === 'body' && (data.column.index === 2 || data.column.index === 3 || data.column.index === 4)) {
          data.cell.styles.fillColor = [255, 245, 245];
          data.cell.styles.textColor = [100, 30, 30];
        }
      },
    });
    afterTableY = doc.lastAutoTable.finalY + 6;
  }

  pdfWatermark(doc, pageW, (headerH + afterTableY) / 2, 'MASENO');

  pdfStampAllPages(doc, pageW, pageH);

  const filename = name ? `${name.replace(/\s+/g, '-')}-timetable.pdf` : 'maseno-class-timetable.pdf';
  doc.save(filename);
}

function downloadGroupPDF() {
  const sessions = grpGetSessions();
  if (!sessions.length) {
    showToast('Nothing to export yet. Add at least one discussion session first.', 'error');
    return;
  }
  if (!pdfLibsReady()) {
    retryPdfLibsThen(() => downloadGroupPDF());
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  const headerH = 58;
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, pageW, 3.5, 'F');
  doc.setFillColor(251, 191, 36);
  doc.rect(0, 3.5, pageW, 1, 'F');

  const logoImg = document.getElementById('psLogoImg');
  const logoH = 22,
    logoTopY = 7;
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0 && !logoImg.dataset.failed) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = logoImg.naturalWidth;
      canvas.height = logoImg.naturalHeight;
      canvas.getContext('2d').drawImage(logoImg, 0, 0);
      const imgData = canvas.toDataURL('image/png');
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      doc.addImage(imgData, 'PNG', (pageW - logoW) / 2, logoTopY, logoW, logoH);
    } catch (e) {}
  }

  const textX = pageW / 2;
  let hY = logoTopY + logoH + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 23, 23);
  doc.text('MASENO UNIVERSITY', textX, hY, { align: 'center' });
  hY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(249, 115, 22);
  doc.text('GROUP DISCUSSION TIMETABLE', textX, hY, { align: 'center' });
  hY += 5;

  const weekLabel = grpWeekLabel();
  if (weekLabel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 95, 6);
    doc.text(weekLabel, textX, hY, { align: 'center' });
    hY += 5;
  }

  const memberNames = grpMembers.map((m) => m.name).join(', ');
  if (memberNames) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    const wrappedMembers = doc.splitTextToSize(`Members: ${memberNames}`, pageW - margin * 4);
    doc.text(wrappedMembers, textX, hY, { align: 'center' });
    hY += wrappedMembers.length * 3.6;
  }

  const dateStr = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(125, 133, 144);
  doc.text(`Generated: ${dateStr}`, margin, headerH - 4);

  doc.setDrawColor(225, 225, 225);
  doc.setLineWidth(0.4);
  doc.line(0, headerH, pageW, headerH);

  let startY = headerH + 6;

  const body = [];
  let lastDay = null;
  sessions.forEach((s) => {
    const { code, venue, notes } = grpParseLabel(s.label);
    const unit = grpUnits.find((u) => u.code === code);
    const name = unit ? unit.name : '';

    if (s.day !== lastDay) {
      const dateStr = grpDateForDay(s.day).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
      body.push([
        {
          content: `${s.day.toUpperCase()}   ·   ${dateStr}`,
          colSpan: 4,
          styles: {
            fillColor: [22, 27, 34],
            textColor: [249, 115, 22],
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'left',
            cellPadding: { top: 4, bottom: 4, left: 6, right: 3 },
          },
        },
      ]);
      lastDay = s.day;
    }
    const topic = `${code}${name ? ' – ' + name : ''}`;
    body.push([`${fmtHour(s.start)} – ${fmtHour(s.end)}`, venue, topic, notes || '—']);
  });

  const head = [['Time', 'Venue', 'Units Details', 'Notes']];

  doc.autoTable({
    head,
    body,
    startY,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      valign: 'middle',
      lineColor: [200, 210, 230],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [13, 17, 23],
      textColor: [251, 191, 36],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 50, halign: 'left' },
      3: { cellWidth: 'auto', halign: 'left', fontStyle: 'italic' },
    },
    theme: 'grid',
  });

  pdfStampAllPages(doc, pageW, pageH);

  const grpWeekStartVal = document.getElementById('grpWeekStart').value;
  doc.save(`group-discussion-timetable-week-of-${grpWeekStartVal || 'unknown'}.pdf`);
}

let psUnits = [];
let psStudyBlocks = {};
let psCATs = [];
let psTimetableBuilt = false;
let psPendingSlot = null;
let psChecklist = [];

function downloadPersonalPDF() {
  const blocksAndClasses = psMergedStudyBlocks().map((b) => ({ day: b.day, start: b.start, end: b.end, label: b.label }));

  const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const catItems = psCATs.map((c) => {
    const [y, mo, d] = c.date.split('-').map(Number);
    const dow = new Date(y, mo - 1, d).getDay();
    const [hh, mm] = c.time.split(':').map(Number);
    const start = hh + mm / 60;
    return {
      day: DOW_NAMES[dow],
      start,
      end: start + c.duration,
      isCAT: true,
      code: c.code,
      venue: c.venue,
      dateObj: new Date(y, mo - 1, d),
    };
  });
  const allItems = [...blocksAndClasses, ...catItems];

  if (!allItems.length) {
    showToast('Nothing to export yet. Add at least one study session or CAT first.', 'error');
    return;
  }
  if (!pdfLibsReady()) {
    retryPdfLibsThen(() => downloadPersonalPDF());
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;

  const headerH = 64;
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, pageW, 3.5, 'F');
  doc.setFillColor(251, 191, 36);
  doc.rect(0, 3.5, pageW, 1, 'F');

  const logoImg = document.getElementById('psLogoImg');
  const logoH = 22,
    logoTopY = 7;
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0 && !logoImg.dataset.failed) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = logoImg.naturalWidth;
      canvas.height = logoImg.naturalHeight;
      canvas.getContext('2d').drawImage(logoImg, 0, 0);
      const imgData = canvas.toDataURL('image/png');
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      doc.addImage(imgData, 'PNG', (pageW - logoW) / 2, logoTopY, logoW, logoH);
    } catch (e) {}
  }

  const textX = pageW / 2;
  let hY = logoTopY + logoH + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 23, 23);
  doc.text('MASENO UNIVERSITY', textX, hY, { align: 'center' });
  hY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(249, 115, 22);
  doc.text('PERSONAL STUDY TIMETABLE', textX, hY, { align: 'center' });
  hY += 5;

  const weekStartVal = document.getElementById('psWeekStart').value;
  const weekLabel = psWeekLabel();
  if (weekLabel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 95, 6);
    doc.text(weekLabel, textX, hY, { align: 'center' });
    hY += 5.5;
  }

  const studentName = document.getElementById('psStudentName').value.trim().slice(0, 60);
  const studentReg = document.getElementById('psStudentReg').value.trim().slice(0, 30);
  const studentYear = document.getElementById('psStudentYear').value.trim().slice(0, 60);
  const studentDept = document.getElementById('psStudentDept').value.trim().slice(0, 80);
  const studentSemester = document.getElementById('psStudentSemester').value.trim();
  const studentAcadYear = document.getElementById('psStudentAcadYear').value.trim().slice(0, 12);
  const studentLine = [studentName, studentReg, studentYear].filter(Boolean).join('  |  ');
  const studentLine2 = [studentDept, studentSemester, studentAcadYear].filter(Boolean).join('  |  ');
  if (studentLine) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(studentLine, textX, hY, { align: 'center' });
    hY += 5;
  }
  if (studentLine2) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text(studentLine2, textX, hY, { align: 'center' });
    hY += 5;
  }

  const motto = document.getElementById('psWeekMotto').value.trim().slice(0, 60);
  if (motto) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`"${motto}"`, textX, hY, { align: 'center' });
  }

  const dateStr = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(125, 133, 144);
  doc.text(`Generated: ${dateStr}`, margin, headerH - 4);

  doc.setDrawColor(225, 225, 225);
  doc.setLineWidth(0.4);
  doc.line(0, headerH, pageW, headerH);

  const TYPE_COLORS = {
    Class: { bg: [255, 237, 213], text: [154, 52, 18] },
    Study: { bg: [220, 252, 231], text: [21, 128, 61] },
    CAT: { bg: [254, 226, 226], text: [185, 28, 28] },
  };

  const legendY = headerH + 5;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  let lx = pageW - margin;
  const legendItem = (label, rgb) => {
    doc.setTextColor(90, 90, 90);
    doc.text(label, lx, legendY, { align: 'right' });
    lx -= doc.getTextWidth(label) + 4;
    doc.setFillColor(...rgb);
    doc.circle(lx, legendY - 1, 1.1, 'F');
    lx -= 5;
  };
  if (catItems.length) legendItem('CAT', TYPE_COLORS.CAT.text);
  legendItem('Study', TYPE_COLORS.Study.text);

  let startY = legendY + 6;

  const DAY_ORDER = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
  const sorted = [...allItems].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 9) - (DAY_ORDER[b.day] ?? 9);
    return dayDiff !== 0 ? dayDiff : a.start - b.start;
  });

  const rowColorMap = {};
  const body = [];
  let lastDay = null;

  sorted.forEach((item) => {
    if (item.day !== lastDay) {
      const headerDate = item.dateObj || psDateForDay(item.day);
      const dateStr = headerDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
      body.push([
        {
          content: `${item.day.toUpperCase()}   ·   ${dateStr}`,
          colSpan: 3,
          styles: {
            fillColor: [22, 27, 34],
            textColor: [249, 115, 22],
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'left',
            cellPadding: { top: 4, bottom: 4, left: 6, right: 3 },
          },
        },
      ]);
      lastDay = item.day;
    }

    if (item.isCAT) {
      const unit = psUnits.find((u) => u.code === item.code);
      const unitDetails = unit ? `CAT - ${item.code}: ${unit.name}` : `CAT - ${item.code}`;
      rowColorMap[body.length] = TYPE_COLORS.CAT;
      body.push([`${fmtHour(item.start)} – ${fmtHour(item.end)}`, unitDetails, `Venue: ${item.venue}`]);
      return;
    }

    const rest = item.label.replace(/^📖\s*/, '');
    const sepIdx = rest.indexOf(' — ');
    const code = sepIdx !== -1 ? rest.slice(0, sepIdx) : rest;
    const notes = sepIdx !== -1 ? rest.slice(sepIdx + 3) : '';
    const unit = psUnits.find((u) => u.code === code);
    const unitDetails = unit ? `${code} – ${unit.name}` : code;

    rowColorMap[body.length] = TYPE_COLORS.Study;

    body.push([`${fmtHour(item.start)} – ${fmtHour(item.end)}`, unitDetails, notes || '—']);
  });

  const head = [['Time', 'Unit Details', 'Notes']];

  doc.autoTable({
    head,
    body,
    startY,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
      valign: 'middle',
      lineColor: [212, 220, 235],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [13, 17, 23],
      textColor: [251, 191, 36],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 34, halign: 'left', fontStyle: 'bold', cellPadding: { top: 4.5, bottom: 4.5, left: 9, right: 2 } },
      1: { cellWidth: 56, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 'auto', halign: 'left', fontStyle: 'italic' },
    },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const palette = rowColorMap[data.row.index];
      if (!palette) return;
      data.cell.styles.fillColor = palette.bg;
      if (data.column.index !== 0) data.cell.styles.textColor = palette.text;
      else data.cell.styles.textColor = [45, 45, 45];
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      const palette = rowColorMap[data.row.index];
      if (!palette) return;
      const r = 1.1;
      const cx = data.cell.x + 4.5;
      const cy = data.cell.y + data.cell.height / 2;
      doc.setFillColor(...palette.text);
      doc.circle(cx, cy, r, 'F');
    },
  });

  let afterTableY = doc.lastAutoTable.finalY + 6;
  const checklistItems = psChecklist;

  if (checklistItems.length) {
    const fullW = pageW - margin * 2;
    const colGap = 8;
    const colW = (fullW - colGap) / 2;
    const rowH = 8;
    const numRows = Math.ceil(checklistItems.length / 2);
    const blockH = 14 + numRows * rowH;

    if (afterTableY + blockH > pageH - 12) {
      doc.addPage();
      afterTableY = 15;
    }
    const sectionTopY = afterTableY;

    doc.setFillColor(34, 197, 94);
    doc.rect(margin, sectionTopY, 2.5, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(23, 23, 23);
    doc.text('WEEKLY CHECKLIST', margin + 5, sectionTopY + 5.2);

    const listTopY = sectionTopY + 9;
    doc.setFillColor(248, 250, 249);
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, listTopY, fullW, numRows * rowH + 4, 2, 2, 'FD');

    checklistItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const itemX = margin + 4 + col * (colW + colGap);
      const itemY = listTopY + 6.5 + row * rowH;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(34, 140, 80);
      const numLabel = `${i + 1}.`;
      doc.text(numLabel, itemX, itemY);
      const numW = doc.getTextWidth(numLabel) + 2.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text(item.text, itemX + numW, itemY, { maxWidth: colW - numW });
    });
  }

  pdfStampAllPages(doc, pageW, pageH);

  doc.save(`personal-study-timetable-week-of-${weekStartVal || 'unknown'}.pdf`);
}
