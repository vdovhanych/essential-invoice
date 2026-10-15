import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { toast } from 'sonner';
import ExpenseCreate from './ExpenseCreate';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), extract: vi.fn() }));
vi.mock('../utils/api', () => ({ api: { get: mocks.get, put: mocks.put, post: mocks.post } }));
vi.mock('../context/AIContext', () => ({ useAI: () => ({ aiStatus: { available: true }, extractExpense: mocks.extract }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const singleBucket = [{ rate: 21, base: 100, tax: 20.99 }];
const mixedBuckets = [...singleBucket, { rate: 12, base: 50, tax: 6 }];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.put.mockResolvedValue({});
  mocks.post.mockResolvedValue({});
});
afterEach(cleanup);

async function setup(overrides = {}, isEdit = true) {
  mocks.get.mockImplementation(async (url: string) => url === '/clients' ? [] : url === '/dashboard' ? {} : ({
    amount: 100, vatRate: 21, vatAmount: 20.99, vatBreakdown: singleBucket,
    issueDate: '2026-08-01', dueDate: '2026-08-15', currency: 'CZK',
    fileData: 'eA==', fileMimeType: 'application/pdf', fileName: 'receipt.pdf',
    ...overrides,
  }));
  const view = render(<MemoryRouter initialEntries={[isEdit ? '/expenses/e1/edit' : '/expenses/new']}>
    <Routes>
      <Route path="/expenses/:id/edit" element={<ExpenseCreate />} />
      <Route path="/expenses/new" element={<ExpenseCreate />} />
      <Route path="/expenses" element={<div>Saved</div>} />
    </Routes>
  </MemoryRouter>);
  await screen.findByLabelText('create.amount.taxBase');
  return view;
}

async function submit(view: ReturnType<typeof render>, isEdit = true) {
  fireEvent.submit(view.container.querySelector('form')!);
  const save = isEdit ? mocks.put : mocks.post;
  await waitFor(() => expect(save).toHaveBeenCalled());
  return save.mock.calls[0][1];
}

it.each([
  [{ amount: 200, vatRate: 12 }, { rate: 12, base: 200, tax: 24 }],
  [{ amount: 200 }, { rate: 21, base: 200, tax: 42 }],
  [{ vatRate: 0 }, { rate: 0, base: 100, tax: 0 }],
])('keeps extracted amounts and the submitted breakdown consistent: %j', async (extracted, expected) => {
  const view = await setup();
  mocks.extract.mockResolvedValue(extracted);
  fireEvent.click(screen.getByRole('button', { name: 'create.attachment.aiExtract' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  const payload = await submit(view);
  expect(payload).toMatchObject({ amount: expected.base, vatRate: expected.rate, vatBreakdown: [expected] });
});

it.each([{ description: 'Extracted details' }, { amount: 100, vatRate: 21 }])('preserves supplier rounding when extraction does not change amounts: %j', async (extracted) => {
  const view = await setup();
  mocks.extract.mockResolvedValue(extracted);
  fireEvent.click(screen.getByRole('button', { name: 'create.attachment.aiExtract' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect((await submit(view)).vatBreakdown).toEqual(singleBucket);
});

it('preserves mixed-rate financial data while extracting other details and explains why', async () => {
  const view = await setup({ amount: 150, vatAmount: 26.99, vatBreakdown: mixedBuckets });
  mocks.extract.mockResolvedValue({ amount: 200, vatRate: 21, currency: 'EUR', description: 'New details' });
  fireEvent.click(screen.getByRole('button', { name: 'create.attachment.aiExtract' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('create.attachment.aiExtractMixedVatPreserved'));
  expect(await submit(view)).toMatchObject({ amount: 150, currency: 'CZK', vatBreakdown: mixedBuckets, description: 'New details' });
});

it('synchronizes the single bucket rate with the summary and saved rate', async () => {
  const view = await setup();
  fireEvent.change(screen.getByLabelText('rate 1'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('tax 1'), { target: { value: '12' } });
  expect(screen.getByLabelText('create.amount.vatRate')).toHaveValue('12');
  expect(await submit(view)).toMatchObject({ vatRate: 12, vatBreakdown: [{ rate: 12, base: 100, tax: 12 }] });
});

it('uses the recorded single bucket rate when loading a previously inconsistent expense', async () => {
  const view = await setup({ vatRate: 12 });
  expect(screen.getByLabelText('create.amount.vatRate')).toHaveValue('21');
  expect((await submit(view)).vatRate).toBe(21);
});

it('submits a consistent explicit bucket after reducing mixed rates and editing the amount', async () => {
  const view = await setup({ amount: 150, vatAmount: 26.99, vatBreakdown: mixedBuckets });
  fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);
  expect(screen.getByLabelText('create.amount.vatRate')).toHaveValue('12');
  fireEvent.change(screen.getByLabelText('create.amount.taxBase'), { target: { value: '200' } });
  expect(await submit(view)).toMatchObject({ amount: 200, vatRate: 12, vatBreakdown: [{ rate: 12, base: 200, tax: 24 }] });
});

it('creates an expense with the rate edited in its breakdown', async () => {
  const view = await setup({}, false);
  fireEvent.change(screen.getByLabelText('base 1'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('rate 1'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('tax 1'), { target: { value: '12' } });
  expect(await submit(view, false)).toMatchObject({ amount: 100, vatRate: 12, vatBreakdown: [{ rate: 12, base: 100, tax: 12 }] });
});
