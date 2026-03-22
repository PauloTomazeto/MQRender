import { describe, it, expect } from 'vitest';

// Teste de sanidade — valida que o ambiente de testes está funcionando
describe('Setup de testes', () => {
  it('ambiente Vitest funciona corretamente', () => {
    expect(1 + 1).toBe(2);
  });

  it('TypeScript types funcionam', () => {
    const value: string = 'mqpromp';
    expect(typeof value).toBe('string');
  });
});
