import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthGate } from '../components/AuthGate';

// Mock Supabase auth
vi.mock('../lib/useAuth', () => ({
  signInWithEmail: vi.fn(),
}));

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import { signInWithEmail } from '../lib/useAuth';

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    render(<AuthGate onSuccess={() => {}} />);
    expect(screen.getByRole('img', { name: /MQPROMP/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('submit button is disabled when fields are empty', () => {
    render(<AuthGate onSuccess={() => {}} />);
    expect(screen.getByRole('button', { name: /Acessar Studio/i })).toBeDisabled();
  });

  it('submit button is disabled with invalid email', async () => {
    const user = userEvent.setup();
    render(<AuthGate onSuccess={() => {}} />);
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'notanemail');
    await user.type(screen.getByPlaceholderText('••••••••'), 'senha123');
    expect(screen.getByRole('button', { name: /Acessar Studio/i })).toBeDisabled();
  });

  it('calls onSuccess on valid credentials', async () => {
    vi.mocked(signInWithEmail).mockResolvedValueOnce({} as any);
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<AuthGate onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText('seu@email.com'), 'paulo@teste.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'senha123');
    await user.click(screen.getByRole('button', { name: /Acessar Studio/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('shows error on wrong credentials', async () => {
    vi.mocked(signInWithEmail).mockRejectedValueOnce(new Error('Invalid login'));
    const user = userEvent.setup();
    render(<AuthGate onSuccess={() => {}} />);

    await user.type(screen.getByPlaceholderText('seu@email.com'), 'paulo@teste.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'senhaerrada');
    await user.click(screen.getByRole('button', { name: /Acessar Studio/i }));

    await waitFor(() =>
      expect(screen.getByText(/E-mail ou senha incorretos/i)).toBeInTheDocument()
    );
  });

  it('shows loading state while authenticating', async () => {
    vi.mocked(signInWithEmail).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 500))
    );
    const user = userEvent.setup();
    render(<AuthGate onSuccess={() => {}} />);

    await user.type(screen.getByPlaceholderText('seu@email.com'), 'paulo@teste.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'senha123');
    await user.click(screen.getByRole('button', { name: /Acessar Studio/i }));

    expect(screen.getByRole('button', { name: /Entrando/i })).toBeDisabled();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<AuthGate onSuccess={() => {}} />);

    const input = screen.getByPlaceholderText('••••••••');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: '' })); // eye icon button
    expect(input).toHaveAttribute('type', 'text');
  });
});
