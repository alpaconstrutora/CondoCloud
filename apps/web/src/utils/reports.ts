// ── Utilitário de relatórios para impressão via window.print() ────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _html2pdf: any = null;
async function getHtml2Pdf() {
  if (!_html2pdf) _html2pdf = ((await import('html2pdf.js')) as any).default ?? (await import('html2pdf.js'));
  return _html2pdf;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

const BASE_STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; padding: 32px; }
  h1 { font-size: 18px; margin-bottom: 2px; }
  h2 { font-size: 14px; font-weight: 600; margin: 20px 0 8px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  .mono { font-family: 'Courier New', monospace; }
  .muted { color: #666; }
  .total-row td { font-weight: 700; border-top: 2px solid #bbb; border-bottom: none; background: #f9fafb; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #111; }
  .header-info { font-size: 11px; color: #555; margin-top: 4px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .summary-card { border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; }
  .summary-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: 0.05em; }
  .summary-value { font-size: 16px; font-weight: 700; margin-top: 2px; font-family: 'Courier New', monospace; }
  .red { color: #c0334d; }
  .green { color: #16a34a; }
  .signature-area { margin-top: 48px; display: flex; gap: 64px; }
  .signature-line { border-top: 1px solid #333; padding-top: 6px; width: 220px; font-size: 11px; color: #555; }
  .page-break { page-break-after: always; }
  .doc-box { border: 1px solid #999; border-radius: 8px; padding: 24px; max-width: 600px; margin: 0 auto; }
  .doc-title { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
  .doc-subtitle { text-align: center; color: #555; font-size: 11px; margin-bottom: 20px; }
  .doc-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
  .doc-label { color: #666; }
  .doc-value { font-weight: 600; }
  .doc-value.big { font-size: 18px; color: #111; }
  .stamp { border: 2px solid #16a34a; color: #16a34a; border-radius: 6px; padding: 8px 16px; text-align: center; font-weight: 700; font-size: 14px; margin-top: 20px; }
  .pix-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 12px; margin-top: 16px; }
  @media print {
    body { padding: 16px; }
    .no-print { display: none !important; }
  }
`;

function printWindow(html: string, filename = 'relatorio') {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Permita pop-ups para gerar relatórios.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>${html}
    <div class="no-print" style="position:fixed;top:16px;right:16px;display:flex;gap:8px">
      <button id="__btn_print" style="padding:8px 16px;background:#1a472a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨️ Imprimir</button>
      <button id="__btn_download" style="padding:8px 16px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">⬇️ Baixar PDF</button>
      <button id="__btn_close" style="padding:8px 16px;background:#f3f4f6;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:13px">Fechar</button>
    </div>
    <script>
      document.getElementById('__btn_print').addEventListener('click', function() { window.print(); });
      document.getElementById('__btn_close').addEventListener('click', function() { window.close(); });
      document.getElementById('__btn_download').addEventListener('click', function() { window.__downloadPdf && window.__downloadPdf(); });
    </\script>
  </body></html>`);
  w.document.close();

  // Injeta a função de download no popup usando html2pdf do bundle principal
  getHtml2Pdf().then((h2p: any) => {
    (w as any).__downloadPdf = () => {
      const btn = w.document.getElementById('__btn_download');
      if (btn) { btn.textContent = '⏳ Gerando…'; (btn as HTMLButtonElement).disabled = true; }
      const noPrint = Array.from(w.document.querySelectorAll('.no-print')) as HTMLElement[];
      noPrint.forEach(el => { el.style.display = 'none'; });
      h2p().set({
        margin: [10, 10, 10, 10],
        filename: `${filename}.pdf`,
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(w.document.body).save().then(() => {
        noPrint.forEach(el => { el.style.display = ''; });
        if (btn) { btn.textContent = '⬇️ Baixar PDF'; (btn as HTMLButtonElement).disabled = false; }
      });
    };
  });
}

// ── 1. Demonstrativo do Rateio ────────────────────────────────────

export interface RateioReportData {
  condoName: string;
  competencia: string; // "YYYY-MM"
  summary: { saldo_anterior: number; total_income: number; total_expense: number; balance: number };
  expensesByCategory: [string, number][];
  rateioLines: { unit: { number: string; blocks?: { name: string }; unit_profiles?: { profiles?: { name?: string } }[] }; amount: number; participacao?: number }[];
  rateioMethod: string;
}

const RATEIO_METHOD_LABEL: Record<string, string> = {
  igualitario: 'Igualitário',
  fracaoIdeal: 'Fração Ideal',
  consumoIndividual: 'Consumo Individual',
  misto: 'Misto',
};

export function printRateioReport(data: RateioReportData) {
  const { condoName, competencia, summary, expensesByCategory, rateioLines, rateioMethod } = data;
  const today = new Date().toLocaleDateString('pt-BR');

  const expensesRows = expensesByCategory.map(([cat, amt]) => `
    <tr>
      <td>${cat}</td>
      <td class="right mono red">${fmt(amt)}</td>
      <td class="right muted">${summary.total_expense > 0 ? ((amt / summary.total_expense) * 100).toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');

  const rateioRows = rateioLines.map(({ unit, amount, participacao }) => {
    const moradores = (unit.unit_profiles ?? []).map(up => up.profiles?.name).filter(Boolean).join(', ') || '—';
    const unidade = `${unit.blocks?.name ? unit.blocks.name + ' · ' : ''}${unit.number}`;
    return `<tr>
      <td>${unidade}</td>
      <td class="muted">${moradores}</td>
      ${participacao != null ? `<td class="right muted">${participacao.toFixed(2)}%</td>` : ''}
      <td class="right mono" style="font-weight:700">${fmt(amount)}</td>
    </tr>`;
  }).join('');

  const totalRateio = rateioLines.reduce((s, l) => s + l.amount, 0);
  const hasParticipacao = rateioLines.some(l => l.participacao != null);

  const html = `
    <div class="header">
      <div>
        <h1>${condoName}</h1>
        <div class="header-info">Demonstrativo do Rateio Condominial</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700">${monthLabel(competencia)}</div>
        <div class="header-info">Gerado em ${today}</div>
        <div class="header-info">Método: ${RATEIO_METHOD_LABEL[rateioMethod] ?? rateioMethod}</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Saldo Anterior</div>
        <div class="summary-value">${fmt(summary.saldo_anterior)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Receitas</div>
        <div class="summary-value green">${fmt(summary.total_income)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Despesas</div>
        <div class="summary-value red">${fmt(summary.total_expense)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Saldo Final</div>
        <div class="summary-value ${summary.balance >= 0 ? 'green' : 'red'}">${fmt(summary.balance)}</div>
      </div>
    </div>

    <h2>Despesas por Categoria</h2>
    <table>
      <thead><tr><th>Categoria</th><th class="right">Valor</th><th class="right">%</th></tr></thead>
      <tbody>${expensesRows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td>Total de Despesas</td>
          <td class="right mono red">${fmt(summary.total_expense)}</td>
          <td class="right">100%</td>
        </tr>
      </tfoot>
    </table>

    <h2>Distribuição do Rateio — ${rateioLines.length} unidades</h2>
    <table>
      <thead>
        <tr>
          <th>Unidade</th>
          <th>Morador</th>
          ${hasParticipacao ? '<th class="right">Part. %</th>' : ''}
          <th class="right">Valor</th>
        </tr>
      </thead>
      <tbody>${rateioRows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="${hasParticipacao ? 3 : 2}">Total Rateado</td>
          <td class="right mono">${fmt(totalRateio)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="signature-area">
      <div>
        <div class="signature-line">Síndico(a) / Responsável</div>
      </div>
      <div>
        <div class="signature-line">Data: _____ / _____ / _______</div>
      </div>
    </div>
  `;

  printWindow(html, `rateio-${competencia}`);
}

// ── 2. Carnê de Cobrança (pendente/em atraso) ─────────────────────

export interface ChargeDoc {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  competencia?: string;
  status: string;
  paid_at?: string;
  payment_method?: string;
  unitLabel: string;
  residentName: string;
}

export function printCarnet(charges: ChargeDoc[], condoName: string, pixKey?: string) {
  const pages = charges.map((c, i) => {
    const isLast = i === charges.length - 1;
    return `
      <div class="${isLast ? '' : 'page-break'}" style="padding: 16px 0">
        <div class="doc-box">
          <div class="doc-title">${condoName}</div>
          <div class="doc-subtitle">Cobrança Condominial${c.competencia ? ' — ' + monthLabel(c.competencia.slice(0,7)) : ''}</div>

          <div class="doc-row"><span class="doc-label">Unidade</span><span class="doc-value">${c.unitLabel}</span></div>
          <div class="doc-row"><span class="doc-label">Morador</span><span class="doc-value">${c.residentName}</span></div>
          <div class="doc-row"><span class="doc-label">Descrição</span><span class="doc-value">${c.description}</span></div>
          <div class="doc-row"><span class="doc-label">Vencimento</span><span class="doc-value ${new Date(c.due_date) < new Date() ? 'red' : ''}">${fmtDate(c.due_date)}</span></div>
          <div class="doc-row" style="margin-top:8px;border-bottom:2px solid #111;padding-bottom:10px">
            <span class="doc-label" style="font-size:14px;font-weight:600">Valor</span>
            <span class="doc-value big">${fmt(c.amount)}</span>
          </div>

          ${pixKey ? `
          <div class="pix-box">
            <div style="font-weight:700;margin-bottom:6px">🔑 Pagamento via PIX</div>
            <div class="doc-row" style="border:none;padding:2px 0"><span class="doc-label">Chave PIX</span><span class="doc-value mono">${pixKey}</span></div>
            <div style="font-size:10px;color:#555;margin-top:4px">Após o pagamento, envie o comprovante ao síndico.</div>
          </div>` : `
          <div style="margin-top:16px;font-size:11px;color:#666;text-align:center">
            Entre em contato com o síndico para informações de pagamento.
          </div>`}
        </div>
      </div>`;
  }).join('');

  printWindow(pages, 'carne-cobrancas');
}

// ── 3. Relatório Financeiro — Lançamentos ────────────────────────

export interface FinancialReportRecord {
  description: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
  due_date?: string;
  competencia?: string;
  receipt_url?: string;
}

export interface FinancialReportData {
  condoName: string;
  competencia: string;
  records: FinancialReportRecord[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export function printFinancialReport(data: FinancialReportData) {
  const { condoName, competencia, records, totalIncome, totalExpense, balance } = data;
  const today = new Date().toLocaleDateString('pt-BR');

  const rows = records.map(r => `
    <tr>
      <td style="font-weight:600">${r.description || '—'}</td>
      <td class="muted">${r.category || '—'}</td>
      <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:${r.type === 'income' ? '#dcfce7' : '#fee2e2'};color:${r.type === 'income' ? '#15803d' : '#c0334d'}">${r.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
      <td class="right mono" style="color:${r.type === 'income' ? '#16a34a' : '#c0334d'}">${r.type === 'expense' ? '− ' : '+ '}${fmt(r.amount)}</td>
      <td class="right muted">${r.due_date ? fmtDate(r.due_date) : '—'}</td>
    </tr>`).join('');

  const html = `
    <div class="header">
      <div>
        <h1>${condoName}</h1>
        <div class="header-info">Relatório Financeiro — Lançamentos</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700">${monthLabel(competencia)}</div>
        <div class="header-info">Gerado em ${today}</div>
      </div>
    </div>

    <div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="summary-card">
        <div class="summary-label">Receitas</div>
        <div class="summary-value green">${fmt(totalIncome)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Despesas</div>
        <div class="summary-value red">${fmt(totalExpense)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Saldo</div>
        <div class="summary-value ${balance >= 0 ? 'green' : 'red'}">${fmt(balance)}</div>
      </div>
    </div>

    <h2>Lançamentos (${records.length})</h2>
    <table>
      <thead><tr><th>Descrição</th><th>Categoria</th><th>Tipo</th><th class="right">Valor</th><th class="right">Vencimento</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3">Total Receitas / Despesas</td>
          <td class="right mono" colspan="2">${fmt(totalIncome)} / ${fmt(totalExpense)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  printWindow(html, `financeiro-${competencia}`);
}

// ── 4. Relatório de Cobranças ─────────────────────────────────────

export interface ChargeReportRecord {
  description: string;
  unitLabel: string;
  residentName: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at?: string;
  competencia?: string;
}

const STATUS_LABEL_PT: Record<string, string> = {
  pending: 'Pendente', paid: 'Pago', overdue: 'Em atraso', cancelled: 'Cancelada',
};
const STATUS_COLOR_MAP: Record<string, string> = {
  pending: '#92400e', paid: '#15803d', overdue: '#c0334d', cancelled: '#6b7280',
};
const STATUS_BG_MAP: Record<string, string> = {
  pending: '#fef3c7', paid: '#dcfce7', overdue: '#fee2e2', cancelled: '#f3f4f6',
};

export interface ChargeReportData {
  condoName: string;
  competencia: string;
  charges: ChargeReportRecord[];
}

export function printChargesReport(data: ChargeReportData) {
  const { condoName, competencia, charges } = data;
  const today = new Date().toLocaleDateString('pt-BR');

  const totalPaid    = charges.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPending = charges.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  const totalOverdue = charges.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);

  const rows = charges.map(c => `
    <tr>
      <td style="font-weight:600">${c.unitLabel}</td>
      <td class="muted">${c.residentName}</td>
      <td>${c.description}</td>
      <td class="right mono">${fmt(c.amount)}</td>
      <td class="right muted">${fmtDate(c.due_date)}</td>
      <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:${STATUS_BG_MAP[c.status]};color:${STATUS_COLOR_MAP[c.status]}">${STATUS_LABEL_PT[c.status] ?? c.status}</span></td>
    </tr>`).join('');

  const html = `
    <div class="header">
      <div>
        <h1>${condoName}</h1>
        <div class="header-info">Relatório de Cobranças</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700">${monthLabel(competencia)}</div>
        <div class="header-info">Gerado em ${today}</div>
      </div>
    </div>

    <div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="summary-card">
        <div class="summary-label">Pagas</div>
        <div class="summary-value green">${fmt(totalPaid)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Pendentes</div>
        <div class="summary-value" style="color:#92400e">${fmt(totalPending)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Em Atraso</div>
        <div class="summary-value red">${fmt(totalOverdue)}</div>
      </div>
    </div>

    <h2>Cobranças (${charges.length})</h2>
    <table>
      <thead><tr><th>Unidade</th><th>Morador</th><th>Descrição</th><th class="right">Valor</th><th class="right">Vencimento</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td class="right mono">${fmt(charges.reduce((s, c) => s + c.amount, 0))}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
  `;

  printWindow(html, `cobrancas-${competencia}`);
}

// ── 5. Relatório de Anexos Financeiros ───────────────────────────

export interface AttachmentReportRecord {
  description: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
  due_date?: string;
  receipt_url: string;
  fileData?: { base64: string; mimeType: string } | null;
}

export interface AttachmentReportData {
  condoName: string;
  competencia: string;
  records: AttachmentReportRecord[];
}

export function printAttachmentsReport(data: AttachmentReportData) {
  const { condoName, competencia, records } = data;
  const today = new Date().toLocaleDateString('pt-BR');

  const rows = records.map((r, i) => `
    <tr>
      <td style="font-weight:600">${r.description || '—'}</td>
      <td class="muted">${r.category || '—'}</td>
      <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:${r.type === 'income' ? '#dcfce7' : '#fee2e2'};color:${r.type === 'income' ? '#15803d' : '#c0334d'}">${r.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
      <td class="right mono" style="color:${r.type === 'income' ? '#16a34a' : '#c0334d'}">${fmt(r.amount)}</td>
      <td class="right muted">${r.due_date ? fmtDate(r.due_date) : '—'}</td>
      <td><a href="${r.receipt_url}" target="_blank" style="color:#1d4ed8;font-size:11px">📎 ${r.receipt_url.split('/').pop()?.replace(/^\d+_/, '') ?? `Anexo ${i + 1}`}</a></td>
    </tr>`).join('');

  const fileBlocks = records
    .filter(r => r.fileData)
    .map((r, i) => {
      const label = r.receipt_url.split('/').pop()?.replace(/^\d+_/, '') ?? `Anexo ${i + 1}`;
      const { base64, mimeType } = r.fileData!;
      const src = `data:${mimeType};base64,${base64}`;
      const embed = mimeType.startsWith('image/')
        ? `<img src="${src}" style="max-width:100%;max-height:700px;border:1px solid #ddd;border-radius:4px">`
        : `<embed src="${src}" type="application/pdf" style="width:100%;height:1000px;border:1px solid #ddd;border-radius:4px">`;
      return `
        <div class="page-break"></div>
        <h3 style="margin-bottom:4px">📎 ${label}</h3>
        <div class="muted" style="font-size:11px;margin-bottom:12px">${r.description || ''} — ${r.category || ''} — ${fmt(r.amount)}${r.due_date ? ' — ' + fmtDate(r.due_date) : ''}</div>
        ${embed}`;
    }).join('');

  const html = `
    <div class="header">
      <div>
        <h1>${condoName}</h1>
        <div class="header-info">Relatório de Anexos — Comprovantes e Boletos</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700">${monthLabel(competencia)}</div>
        <div class="header-info">Gerado em ${today}</div>
      </div>
    </div>

    <p style="font-size:11px;color:#666;margin-bottom:16px">
      ${records.length} lançamento(s) com comprovante anexado nesta competência.
    </p>

    <table>
      <thead><tr><th>Descrição</th><th>Categoria</th><th>Tipo</th><th class="right">Valor</th><th class="right">Vencimento</th><th>Comprovante</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${fileBlocks}
  `;

  printWindow(html, `anexos-${competencia}`);
}

// ── 6. Relatório Completo (Consolidado) ──────────────────────────

export interface FullReportData {
  financial: FinancialReportData;
  charges: ChargeReportData;
  attachments: AttachmentReportData;
}

export function printFullReport(data: FullReportData) {
  const { financial, charges, attachments } = data;
  const { condoName, competencia } = financial;
  const today = new Date().toLocaleDateString('pt-BR');

  // ── Seção 1: Lançamentos ──
  const finRows = financial.records.map(r => `
    <tr>
      <td style="font-weight:600">${r.description || '—'}</td>
      <td class="muted">${r.category || '—'}</td>
      <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:${r.type === 'income' ? '#dcfce7' : '#fee2e2'};color:${r.type === 'income' ? '#15803d' : '#c0334d'}">${r.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
      <td class="right mono" style="color:${r.type === 'income' ? '#16a34a' : '#c0334d'}">${r.type === 'expense' ? '− ' : '+ '}${fmt(r.amount)}</td>
      <td class="right muted">${r.due_date ? fmtDate(r.due_date) : '—'}</td>
    </tr>`).join('');

  // ── Seção 2: Cobranças ──
  const chgRows = charges.charges.map(c => `
    <tr>
      <td style="font-weight:600">${c.unitLabel}</td>
      <td class="muted">${c.residentName}</td>
      <td>${c.description}</td>
      <td class="right mono">${fmt(c.amount)}</td>
      <td class="right muted">${fmtDate(c.due_date)}</td>
      <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:${STATUS_BG_MAP[c.status]};color:${STATUS_COLOR_MAP[c.status]}">${STATUS_LABEL_PT[c.status] ?? c.status}</span></td>
    </tr>`).join('');

  // ── Seção 3: Anexos ──
  const attRows = attachments.records.map((r, i) => `
    <tr>
      <td style="font-weight:600">${r.description || '—'}</td>
      <td class="muted">${r.category || '—'}</td>
      <td class="right mono">${fmt(r.amount)}</td>
      <td class="right muted">${r.due_date ? fmtDate(r.due_date) : '—'}</td>
      <td><a href="${r.receipt_url}" target="_blank" style="color:#1d4ed8;font-size:11px">📎 ${r.receipt_url.split('/').pop()?.replace(/^\d+_/, '') ?? `Anexo ${i + 1}`}</a></td>
    </tr>`).join('');

  const attFileBlocks = attachments.records
    .filter(r => r.fileData)
    .map((r, i) => {
      const label = r.receipt_url.split('/').pop()?.replace(/^\d+_/, '') ?? `Anexo ${i + 1}`;
      const { base64, mimeType } = r.fileData!;
      const src = `data:${mimeType};base64,${base64}`;
      const embed = mimeType.startsWith('image/')
        ? `<img src="${src}" style="max-width:100%;max-height:700px;border:1px solid #ddd;border-radius:4px">`
        : `<embed src="${src}" type="application/pdf" style="width:100%;height:1000px;border:1px solid #ddd;border-radius:4px">`;
      return `
        <div class="page-break"></div>
        <h3 style="margin-bottom:4px">📎 ${label}</h3>
        <div class="muted" style="font-size:11px;margin-bottom:12px">${r.description || ''} — ${r.category || ''} — ${fmt(r.amount)}${r.due_date ? ' — ' + fmtDate(r.due_date) : ''}</div>
        ${embed}`;
    }).join('');

  const totalPaid    = charges.charges.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const totalPending = charges.charges.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0);
  const totalOverdue = charges.charges.filter(c => c.status === 'overdue').reduce((s, c) => s + c.amount, 0);

  const html = `
    <div class="header">
      <div>
        <h1>${condoName}</h1>
        <div class="header-info">Relatório Consolidado</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700">${monthLabel(competencia)}</div>
        <div class="header-info">Gerado em ${today}</div>
      </div>
    </div>

    <!-- Resumo geral -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Receitas</div>
        <div class="summary-value green">${fmt(financial.totalIncome)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Despesas</div>
        <div class="summary-value red">${fmt(financial.totalExpense)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Saldo</div>
        <div class="summary-value ${financial.balance >= 0 ? 'green' : 'red'}">${fmt(financial.balance)}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Cobranças Pagas</div>
        <div class="summary-value green">${fmt(totalPaid)}</div>
      </div>
    </div>

    <!-- Seção 1 -->
    <h2>1. Lançamentos Financeiros (${financial.records.length})</h2>
    ${financial.records.length === 0 ? '<p class="muted" style="margin-bottom:12px">Nenhum lançamento nesta competência.</p>' : `
    <table>
      <thead><tr><th>Descrição</th><th>Categoria</th><th>Tipo</th><th class="right">Valor</th><th class="right">Vencimento</th></tr></thead>
      <tbody>${finRows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3">Total Receitas / Despesas</td>
          <td class="right mono" colspan="2">${fmt(financial.totalIncome)} / ${fmt(financial.totalExpense)}</td>
        </tr>
      </tfoot>
    </table>`}

    <!-- Seção 2 -->
    <h2>2. Cobranças (${charges.charges.length})</h2>
    ${charges.charges.length === 0 ? '<p class="muted" style="margin-bottom:12px">Nenhuma cobrança nesta competência.</p>' : `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div class="summary-card"><div class="summary-label">Pagas</div><div class="summary-value green" style="font-size:13px">${fmt(totalPaid)}</div></div>
      <div class="summary-card"><div class="summary-label">Pendentes</div><div class="summary-value" style="font-size:13px;color:#92400e">${fmt(totalPending)}</div></div>
      <div class="summary-card"><div class="summary-label">Em Atraso</div><div class="summary-value red" style="font-size:13px">${fmt(totalOverdue)}</div></div>
    </div>
    <table>
      <thead><tr><th>Unidade</th><th>Morador</th><th>Descrição</th><th class="right">Valor</th><th class="right">Vencimento</th><th>Status</th></tr></thead>
      <tbody>${chgRows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3">Total</td>
          <td class="right mono">${fmt(charges.charges.reduce((s, c) => s + c.amount, 0))}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>`}

    <!-- Seção 3 -->
    <h2>3. Anexos — Comprovantes e Boletos (${attachments.records.length})</h2>
    ${attachments.records.length === 0 ? '<p class="muted" style="margin-bottom:12px">Nenhum comprovante anexado nesta competência.</p>' : `
    <table>
      <thead><tr><th>Descrição</th><th>Categoria</th><th class="right">Valor</th><th class="right">Vencimento</th><th>Comprovante</th></tr></thead>
      <tbody>${attRows}</tbody>
    </table>
    ${attFileBlocks}`}

    <div class="signature-area">
      <div><div class="signature-line">Síndico(a) / Responsável</div></div>
      <div><div class="signature-line">Data: _____ / _____ / _______</div></div>
    </div>
  `;

  printWindow(html, `consolidado-${competencia}`);
}

// ── 7. Recibo de Pagamento ────────────────────────────────────────

export function printReceipt(charges: ChargeDoc[], condoName: string) {
  const pages = charges.map((c, i) => {
    const isLast = i === charges.length - 1;
    return `
      <div class="${isLast ? '' : 'page-break'}" style="padding: 16px 0">
        <div class="doc-box">
          <div class="doc-title">${condoName}</div>
          <div class="doc-subtitle">Recibo de Pagamento</div>

          <div class="doc-row"><span class="doc-label">Unidade</span><span class="doc-value">${c.unitLabel}</span></div>
          <div class="doc-row"><span class="doc-label">Morador</span><span class="doc-value">${c.residentName}</span></div>
          <div class="doc-row"><span class="doc-label">Descrição</span><span class="doc-value">${c.description}</span></div>
          ${c.competencia ? `<div class="doc-row"><span class="doc-label">Competência</span><span class="doc-value">${monthLabel(c.competencia.slice(0,7))}</span></div>` : ''}
          <div class="doc-row"><span class="doc-label">Vencimento</span><span class="doc-value">${fmtDate(c.due_date)}</span></div>
          <div class="doc-row"><span class="doc-label">Data do Pagamento</span><span class="doc-value">${c.paid_at ? fmtDate(c.paid_at) : '—'}</span></div>
          ${c.payment_method ? `<div class="doc-row"><span class="doc-label">Forma de Pagamento</span><span class="doc-value">${c.payment_method}</span></div>` : ''}
          <div class="doc-row" style="margin-top:8px;border-bottom:2px solid #111;padding-bottom:10px">
            <span class="doc-label" style="font-size:14px;font-weight:600">Valor Pago</span>
            <span class="doc-value big">${fmt(c.amount)}</span>
          </div>

          <div class="stamp">✓ PAGAMENTO CONFIRMADO</div>

          <div class="signature-area" style="margin-top:32px">
            <div><div class="signature-line">Síndico(a) / Administração</div></div>
            <div><div class="signature-line">Data: _____ / _____ / _______</div></div>
          </div>
        </div>
      </div>`;
  }).join('');

  printWindow(pages, 'recibo');
}
