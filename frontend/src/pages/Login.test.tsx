import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import Login from './Login';

const mockLogin = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

describe('Login', () => {
  it('trims pasted email whitespace before browser validation and preserves the password', async () => {
    render(<BrowserRouter><ThemeProvider><Login /></ThemeProvider></BrowserRouter>);

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: '\u00a0test@example.com\u00a0' } });
    fireEvent.change(screen.getByLabelText(/^Heslo/), { target: { value: ' password123 ' } });

    expect(screen.getByLabelText(/Email/)).toHaveValue('test@example.com');
    expect(screen.getByLabelText(/Email/)).toBeValid();
    fireEvent.click(screen.getByRole('button', { name: /Přihlásit se/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('test@example.com', ' password123 '));
  });
});
