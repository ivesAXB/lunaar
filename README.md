# LUNAAR · Gestão de Animais & Hospedagem

Sistema interno da Associação LUNAAR (Cuiabá – MT) com dois módulos:

- **Abrigo**: animais da ONG, prontuário (saúde, vacinas, tratamentos, histórico), situação e adoção.
- **Hotelzinho**: clientes, pets dos clientes, hospedagens, check-in e check-out.

Também inclui painel, agenda (dia, semana e mês), relatórios e configurações (equipe, canis, acomodações).

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # checagem de tipos + build de produção
```

Acesso de demonstração: `mariana@lunaar.org` / `lunaar2026`.

## Stack

React 18, TypeScript, Vite e React Router. Estilos em CSS próprio, com tokens em `src/styles/tokens.css`, sem framework de UI. Ícones com `lucide-react` e datas com `date-fns` (pt-BR).

## Estrutura

```
src/
  data/        types.ts (modelo), store.tsx (camada de dados), selectors.ts (alertas, ocupação), seed.ts, session.tsx
  components/  AppShell (navegação), ui.tsx (botões, campos, diálogos, status), GlobalSearch, BarChart, PhotoInput
  pages/       Painel, animals/, boarding/, clients/, Agenda, Relatórios, Configurações, auth/
  styles/      tokens.css, base.css, components.css
db/schema.sql  esquema PostgreSQL correspondente ao modelo
```

## Produção

- Site: https://lunaar-xi-ochre.vercel.app (Vercel, projeto `lunaar`)
- Banco: Supabase, projeto `lunaar` (ref `kmatddsglrtsvkvypzlg`, região São Paulo)
- Chaves ficam em `.env.local` (não versionado) e nas variáveis de ambiente da Vercel.

| O que | Onde |
|---|---|
| Esquema, RLS, bucket de fotos | `supabase/migrations/` → `npx supabase db push` |
| Configuração de login (URL do site, cadastro público desligado) | `supabase/config.toml` → `npx supabase config push` |
| Criar acesso para a equipe | função `api/create-user.ts` (usa a chave de serviço; só coordenação) |
| Publicar | `npx vercel deploy --prod` |

**Primeiro acesso:** crie o primeiro usuário no painel do Supabase (Authentication → Users → Add user). O primeiro perfil do sistema vira coordenação automaticamente; os demais são criados em Configurações → Equipe.

## Dados

Com as variáveis do Supabase, as ações de `src/data/store.tsx` alteram o estado em memória e `src/data/remote.ts` grava só a diferença nas tabelas (fotos vão para o Storage). Sem as variáveis, o app roda em **modo demonstração**, com dados de exemplo no navegador. É útil para desenvolver: `npm run dev` sem `.env.local`.

## Design

- Direção visual: "ficha de abrigo". Fundo de papel quente, tinta quase preta, e o amarelo LUNAAR usado como marca-texto e na ação principal.
- A estrutura vem de linhas e tipografia (Archivo larga + Figtree), não de cartões. Sombras só em camadas flutuantes.
- Status sempre com ícone + texto + cor.
- Contraste AA, foco visível e navegação por teclado.
- No celular: barra de navegação inferior, filtros e diálogos em painel inferior, e tabelas que viram linhas empilhadas.
