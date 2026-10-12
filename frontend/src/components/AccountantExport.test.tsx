import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AccountantExport from './AccountantExport';
import { api } from '../utils/api';
import { toast } from 'sonner';

vi.mock('../utils/api', () => ({ api: { download: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 9, 12));
});
afterEach(() => vi.useRealTimers());
const renderExport = () => render(<MemoryRouter><AccountantExport /></MemoryRouter>);

it('opens the dedicated VAT filing workspace from the Settings export entry', () => {
  render(<MemoryRouter initialEntries={['/settings/exports']}><Routes>
    <Route path="/settings/exports" element={<AccountantExport />} />
    <Route path="/vat-filings" element={<h1>Filing workspace</h1>} />
  </Routes></MemoryRouter>);
  const link = screen.getByRole('link', { name: 'Otevřít podání DPH' });
  expect(link).toHaveAttribute('href', '/vat-filings');
  fireEvent.click(link);
  expect(screen.getByRole('heading', { name: 'Filing workspace' })).toBeVisible();
  expect(api.download).not.toHaveBeenCalled();
});

it('downloads the chosen accounting period and basis through the authenticated API', async () => {
  vi.mocked(api.download).mockResolvedValue(undefined);
  renderExport();
  fireEvent.click(screen.getByText('Co balíček obsahuje a jaká má omezení'));
  expect(screen.getByRole('heading', { name: 'Součástí jsou podklady pro DPH' })).toBeVisible();
  expect(screen.getByText(/nikoli potvrzený nárok na odpočet/)).toBeVisible();
  expect(screen.getByLabelText('Vybrat doklady podle')).toHaveAccessibleDescription(/Datum vystavení nemusí odpovídat období DPH/);
  fireEvent.input(screen.getByLabelText('Od'), { target: { value: '2026-08-01' } });
  fireEvent.input(screen.getByLabelText('Do'), { target: { value: '2026-08-31' } });
  fireEvent.change(screen.getByLabelText('Vybrat doklady podle'), { target: { value: 'tax' } });
  expect(screen.getByLabelText('Vybrat doklady podle')).toHaveAccessibleDescription(/Období uplatnění odpočtu DPH/);
  fireEvent.click(screen.getByRole('button', { name: 'Stáhnout ZIP' }));
  await waitFor(() => expect(api.download).toHaveBeenCalledWith('/exports/accountant?from=2026-08-01&to=2026-08-31&basis=tax', 'accountant-2026-08-01-2026-08-31.zip'));
  expect(toast.success).toHaveBeenCalled();
});

it('prefills last month and supports completed-quarter and year-to-date presets', () => {
  renderExport();
  expect(screen.getByLabelText('Od')).toHaveValue('2026-08-01');
  expect(screen.getByLabelText('Do')).toHaveValue('2026-08-31');
  expect(screen.getByRole('button', { name: 'Minulý měsíc' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Minulé čtvrtletí' }));
  expect(screen.getByLabelText('Od')).toHaveValue('2026-04-01');
  expect(screen.getByLabelText('Do')).toHaveValue('2026-06-30');
  fireEvent.click(screen.getByRole('button', { name: 'Letošní rok' }));
  expect(screen.getByLabelText('Od')).toHaveValue('2026-01-01');
  expect(screen.getByLabelText('Do')).toHaveValue('2026-09-09');
});

it('handles period presets across a year boundary', () => {
  vi.setSystemTime(new Date(2026, 0, 12, 12));
  renderExport();
  expect(screen.getByLabelText('Od')).toHaveValue('2025-12-01');
  expect(screen.getByLabelText('Do')).toHaveValue('2025-12-31');
  fireEvent.click(screen.getByRole('button', { name: 'Minulé čtvrtletí' }));
  expect(screen.getByLabelText('Od')).toHaveValue('2025-10-01');
  expect(screen.getByLabelText('Do')).toHaveValue('2025-12-31');
});

it('explains invalid or missing dates and prevents a request until corrected', () => {
  renderExport();
  fireEvent.input(screen.getByLabelText('Od'), { target: { value: '2026-09-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Vyplňte obě data');
  expect(screen.getByLabelText('Od')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: 'Stáhnout ZIP' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('form', { name: 'Export pro účetní' }));
  expect(api.download).not.toHaveBeenCalled();
  fireEvent.input(screen.getByLabelText('Od'), { target: { value: '' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Export pro účetní' }));
  expect(api.download).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Minulý měsíc' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Stáhnout ZIP' })).toBeEnabled();
});

it('keeps the period stable and prevents duplicate requests during preparation', async () => {
  let finish!: () => void;
  vi.mocked(api.download).mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  renderExport();
  fireEvent.click(screen.getByRole('button', { name: 'Stáhnout ZIP' }));
  expect(screen.getByRole('status')).toHaveTextContent('Připravujeme faktury a přílohy');
  expect(screen.getByLabelText('Od')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Minulé čtvrtletí' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('form', { name: 'Export pro účetní' }));
  expect(api.download).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stáhnout ZIP' })).toBeEnabled());
});

it('shows export failures inline and retries with the same period', async () => {
  vi.mocked(api.download).mockRejectedValueOnce(new Error('EUR exchange rate is missing')).mockResolvedValueOnce(undefined);
  renderExport();
  fireEvent.click(screen.getByRole('button', { name: 'Stáhnout ZIP' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('EUR exchange rate is missing');
  fireEvent.click(screen.getByRole('button', { name: 'Zkusit stáhnout znovu' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(api.download).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api.download).mock.calls[1]).toEqual(vi.mocked(api.download).mock.calls[0]);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
