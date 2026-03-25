# Relatório de Análise Completa — MQv3 (Render IA na Prática)

## 1. Visão Geral do Projeto

O MQv3 é uma aplicação web de geração de prompts para fotografia arquitetural, desenvolvida com React + TypeScript + Tailwind CSS. Utiliza Google Gemini AI para análise de imagens e geração de prompts técnicos para renderização.

### Stack Tecnológico

- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Animações**: Motion (react-motion)
- **IA**: Google Gemini API (@google/genai)
- **Backend/DB**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Build Tool**: Vite 6
- **Testing**: Vitest

---

## 2. Erros e Problemas Identificados

### 2.1 Erros Críticos

#### ERRO-001: Acesso Incorreto às Variáveis de Ambiente

**Localização**: 
- [`src/services/geminiService.ts:14`](src/services/geminiService.ts:14)
- [`src/services/moveService.ts:7`](src/services/moveService.ts:7)
- [`src/services/geminiService.ts:675`](src/services/geminiService.ts:675)

**Descrição**: O código utiliza `process.env` em vez de `import.meta.env` (padrão Vite). Embora o `vite.config.ts` faça um polyfill definindo `process.env`, essa não é a prática recomendada e pode causar problemas de compatibilidade.

```typescript
// Problema:
const key = process.env.API_KEY || process.env.GEMINI_API_KEY;

// Correto deveria ser:
const key = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
```

**Recomendação**: Migrar todas as referências para `import.meta.env.VITE_*` e remover o polyfill do vite.config.ts.

---

#### ERRO-002: Login com Google Desabilitado

**Localização**: [`src/components/AuthGate.tsx:36`](src/components/AuthGate.tsx:36)

**Descrição**: O botão de login com Google está implementado, mas redireciona para o formulário de email com uma mensagem "em breve":

```typescript
const handleGoogle = () => {
  setError('Login com Google em breve. Use e-mail e senha por enquanto.');
  setShowEmailForm(true);
};
```

**Recomendação**: Implementar a funcionalidade completa de OAuth com Google ou remover o botão se não houver planos de suporte.

---

#### ERRO-003: Variáveis de Ambiente Ausentes no Runtime

**Localização**: [`src/lib/supabase.ts:6-10`](src/lib/supabase.ts:6-10)

**Descrição**: O código lança erro se as variáveis `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` não estiverem definidas, mas não há mensagem clara sobre como configurar.

---

### 2.2 Erros Médios

#### ERRO-004: Tipo Desconhecido em database.types.ts

**Localização**: [`src/lib/database.types.ts`](src/lib/database.types.ts)

**Descrição**: Existem referências a tipos que podem não estar sendo utilizados corretamente em todas as partes do código.

---

#### ERRO-005: Duplicação de Tipos

**Localização**: 
- [`src/types.ts`](src/types.ts)
- [`src/lib/database.types.ts`](src/lib/database.types.ts)
- [`src/schemas/index.ts`](src/schemas/index.ts)

**Descrição**: Há redundância entre os tipos definidos em `types.ts` e `database.types.ts`. Os schemas Zod em `schemas/index.ts` também duplicam essas definições, mas com validações. Isso pode causar inconsistências.

**Recomendação**: Consolidar em um único arquivo de tipos com validação Zod integrada.

---

### 2.3 Erros Menores / Warnings

#### WARN-001: Imagens Estáticas com Paths Errados

**Localização**: 
- `asests/Group 1.png` — nome de arquivo com espaço
- `asests/Rectangle 1.png` — nome de arquivo com espaço

**Descrição**: Os nomes de arquivos contêm espaços, o que pode causar problemas em alguns sistemas de build.

---

#### WARN-002: Nome do Projeto Inconsistente

**Localização**: [`package.json:2`](package.json:2)

**Descrição**: O nome do package é `render-ia-na-pratica` mas o repositório é referenciado como `mqpromp` no README.

---

#### WARN-003: Comentário de Versão no AuthGate

**Localização**: [`src/components/AuthGate.tsx:186`](src/components/AuthGate.tsx:186)

**Descrição**: Há um texto "TOOL-SEC v1.0 Validated" que parece ser um placeholder.

---

## 3. Implementações Existentes

### 3.1 Sistema de Autenticação

| Componente | Arquivo | Status |
|------------|---------|--------|
| Login Email/Senha | [`src/lib/useAuth.ts`](src/lib/useAuth.ts) | ✅ Implementado |
| Login Google OAuth | [`src/lib/useAuth.ts:79-91`](src/lib/useAuth.ts:79-91) | ⚠️ Código existe mas desabilitado no frontend |
| Recuperação de Senha | [`src/components/ResetPassword.tsx`](src/components/ResetPassword.tsx) | ✅ Implementado |
| Proteção de Rotas (AuthGate) | [`src/components/AuthGate.tsx`](src/components/AuthGate.tsx) | ✅ Implementado |
| Logout | [`src/lib/useAuth.ts:67-70`](src/lib/useAuth.ts:67-70) | ✅ Implementado |

---

### 3.2 Sistema de Análise de Imagens (Gemini AI)

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `analyzeImage()` | [`src/services/geminiService.ts`](src/services/geminiService.ts) | Análise completa de imagens arquiteturais |
| `generatePrompt()` | [`src/services/geminiService.ts`](src/services/geminiService.ts) | Geração de prompts para renderização |
| `analyzePostProduction()` | [`src/services/geminiService.ts`](src/services/geminiService.ts) | Estratégia de pós-produção |
| `analyzeDetailCloses()` | [`src/services/geminiService.ts`](src/services/geminiService.ts) | Análise de detalhes |
| `generateNanoBananaImage()` | [`src/services/geminiService.ts`](src/services/geminiService.ts) | Geração de imagem (KIE.ai) |
| `analyzeMoveImage()` | [`src/services/moveService.ts`](src/services/moveService.ts) | Análise para modo movimento |
| `generateMovePrompts()` | [`src/services/moveService.ts`](src/services/moveService.ts) | Prompts para animação |

---

### 3.3 Sistema de Créditos

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `getUserCreditStatus()` | [`src/services/creditService.ts:16`](src/services/creditService.ts:16) | Consulta saldo de créditos |
| `checkCredits()` | [`src/services/creditService.ts:43`](src/services/creditService.ts:43) | Verifica se há créditos suficientes |
| `consumeCredits()` | [`src/services/creditService.ts:61`](src/services/creditService.ts:61) | Consome créditos |
| `addAddonCredits()` | [`src/services/creditService.ts:80`](src/services/creditService.ts:80) | Adiciona pacote de créditos |
| `getCreditCost()` | [`src/services/creditService.ts:93`](src/services/creditService.ts:93) | Consulta custo de geração |

---

### 3.4 Banco de Dados (Supabase)

O banco de dados possui 11 migrações com as seguintes tabelas principais:

| Tabela | Descrição | Migração |
|--------|-----------|----------|
| `profiles` | Perfis de usuários | 001 |
| `subscription_plans` | Planos de assinatura | 001 |
| `subscriptions` | Assinaturas ativas | 001 |
| `projects` | Projetos do usuário | 001 |
| `generation_sessions` | Sessões de geração | 001 |
| `image_generations` | Imagens geradas | 001 |
| `credit_config` | Configuração de custos | 007 |
| `credit_transactions` | Histórico de transações | 007 |

**Funções RPC**:
- `check_credits()` — Verifica saldo
- `consume_credits()` — Consome créditos
- `add_addon_credits()` — Adiciona créditos
- `admin_adjust_credits()` — Ajuste administrativo
- `invite_user()` — Convite de usuários
- `delete_user()` — Exclusão de usuários

---

### 3.5 Componentes Principais

| Componente | Arquivo | Tamanho | Descrição |
|------------|---------|---------|-----------|
| Studio | [`src/components/Studio.tsx`](src/components/Studio.tsx) | ~163KB | Componente principal de geração |
| AdminDashboard | [`src/components/AdminDashboard.tsx`](src/components/AdminDashboard.tsx) | ~98KB | Painel administrativo |
| AuthGate | [`src/components/AuthGate.tsx`](src/components/AuthGate.tsx) | ~8KB | Página de login |
| ResetPassword | [`src/components/ResetPassword.tsx`](src/components/ResetPassword.tsx) | ~6KB | Recuperação de senha |
| Header | [`src/components/Header.tsx`](src/components/Header.tsx) | ~3KB | Cabeçalho com navegação |
| AcessoRelay | [`src/components/AcessoRelay.tsx`](src/components/AcessoRelay.tsx) | ~3KB | Link de acesso alternativo |

---

### 3.6 Modos de Operação

O aplicativo possui dois modos principais:

1. **Modo Prompt** (`promp`): Análise de imagens para geração de prompts fotorrealistas
2. **Modo Move** (`move`): Análise para geração de animações e movimentos

---

### 3.7 Fluxo de Uso

```
1. Usuário acessa → AuthGate (login)
2. Após login → Studio (tela inicial)
3. Seleciona modo → prompt ou move
4. Upload de imagem → Análise AI
5. Configura parâmetros → Geração de prompt
6. (Opcional) Geração de imagem via KIE.ai
```

---

## 4. Recomendações de Correção

### Prioridade Alta

1. **Corrigir acesso a variáveis de ambiente** — Usar `import.meta.env.VITE_*`
2. **Implementar ou remover Google OAuth** — Decidir e implementar completamente
3. **Consolidar tipos** — Unificar `types.ts`, `database.types.ts` e schemas

### Prioridade Média

1. **Renomear arquivos em `asests/`** — Remover espaços dos nomes
2. **Corrigir nome do projeto** — Padronizar em `package.json` e README
3. **Adicionar testes unitários** — coverage atual parece baixo

### Prioridade Baixa

1. **Limpar placeholders** — Remover textos como "TOOL-SEC v1.0"
2. **Documentar APIs** — Adicionar JSDoc nas funções principais

---

## 5. Métricas do Projeto

- **Total de arquivos TSX/TS**: ~35 arquivos
- **Total de migrações SQL**: 11 arquivos
- **Linhas de código (estimado)**: ~5.000+ linhas
- **Dependências npm**: ~40 pacotes
- **Schema Zod**: 7 schemas de validação

---

*Relatório gerado automaticamente em 25/03/2026*
