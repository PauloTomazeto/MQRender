<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MQPROMP - Gerador de Prompts de Arquitetura

O **MQPROMP** é uma ferramenta avançada projetada para arquitetos e designers de interiores, focada na geração de prompts de alta fidelidade para renderização e visualização arquitetural. Utilizando o poder do Gemini AI, o sistema analisa imagens de referência e gera descrições detalhadas, garantindo precisão técnica e estética.

## ✨ Principais Funcionalidades

- **Análise Inteligente de Imagens**: Identificação precisa de elementos arquitetônicos, móveis e iluminação.
- **Diferenciação de Materiais**: Algoritmo especializado para distinguir entre MDF/Laca e espelhos, evitando erros comuns de reflexo.
- **Geração de Prompts Técnicos**: Prompts otimizados para ferramentas de renderização (Midjourney, Stable Diffusion, etc.).
- **Modo "Move"**: Análise focada em animação e movimento para apresentações dinâmicas.
- **Integração Vertex AI**: Configuração simplificada utilizando chaves de API do sistema.

## 🚀 Como Executar Localmente

**Pré-requisitos:** Node.js (v18+)

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/PauloTomazeto/mqpromp.git
   cd mqpromp
   ```

2. **Instalar dependências:**
   ```bash
   npm install
   ```

3. **Configurar Variáveis de Ambiente:**
   Crie um arquivo `.env.local` na raiz do projeto e adicione sua chave:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   ```

4. **Executar o app:**
   ```bash
   npm run dev
   ```

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React + TypeScript + Tailwind CSS
- **Animações**: Motion
- **IA**: Google Gemini API (@google/genai)
- **Build Tool**: Vite

## 📄 Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

---
Desenvolvido para elevar o nível da visualização arquitetural.
