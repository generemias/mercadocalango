# Calango Digital

MVP para validar se consumidores usam um app de lista de compras + descoberta
de promoções de bairro, e se mercados locais mantêm promoções atualizadas em
troca de visibilidade — antes de investir em qualquer camada de IA avançada.

## Stack

- Frontend: React + Vite (web app responsivo, prioridade mobile).
- Backend/Auth/Banco: Supabase (Postgres + Auth + Storage).

## Como rodar

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## Fora de escopo (confirmado)

ERP, controle financeiro, estoque, caixa, PDV, emissão fiscal, compras, gestão
de funcionários, fornecedores, contabilidade, integrações complexas, IA
generativa/assistente de linguagem natural, mapa de calor, relatórios
avançados.

## Piloto

- Uma cidade/bairro específico (a definir).
- 5 a 10 mercados parceiros recrutados manualmente, atualizando promoções à
  mão (ex: 10-20 produtos/semana via formulário simples ou planilha/painel).
- 30 a 50 consumidores reais testando por 4-6 semanas.

## App do consumidor (telas mínimas)

- **Login** — email, Google, Apple.
- **Cadastro** — nome, cidade, bairro, aceite de localização e de política de
  privacidade.
- **Home** — lista de compras ativa, mercados próximos, promoções em destaque.
- **Lista de compras** — adicionar, editar, remover, marcar como comprado (sem
  IA de sugestão automática no MVP).
- **Explorar mercados** — lista/mapa simples, filtro por distância e
  promoções.
- **Mercado (detalhe)** — nome, distância, promoções, produtos, horário,
  botão de rota.
- **Perfil** — dados pessoais, histórico, mercados favoritos.

Recomendação de "melhor mercado" no MVP = regra simples (distância + nº de
itens da lista em promoção), não IA preditiva.

## Painel do mercado (mínimo)

- Login simples.
- Cadastro de produtos/promoções (nome, categoria, preço, imagem, validade da
  promoção).
- Dashboard com 3-4 métricas: nº de visualizações, produtos mais buscados
  pelos clientes do app, cliques em "rota até o mercado".

Sem chat de IA, sem relatórios avançados, sem mapa de calor nesta fase.

## Monetização a testar (não definitiva)

Taxa fixa baixa por "destaque" no app para os mercados parceiros, ou gratuito
nos primeiros 3 meses para validar uso antes de cobrar — decisão final
depende do resultado do piloto.

## Métricas de validação (funil)

Instalação do app → lista de compras criada → clique em "rota" para um
mercado recomendado → (ideal) confirmação de visita/compra.

Para o mercado: manteve promoções atualizadas semanalmente? Olhou o
dashboard?

Se esse funil não acontecer no piloto, nenhuma tela ou funcionalidade extra
deve ser construída antes de entender por quê.

## Depois da validação (não é parte deste MVP)

Assistente de compras por linguagem natural, insights preditivos para o
lojista, mapa de calor de consumidores, relatórios avançados, recomendações
cruzadas mais sofisticadas.

## Design

Interface moderna e minimalista, inspirada em Material Design 3, Google Maps,
Notion e Apple. Cards, ícones simples, responsivo.

## Equipe de agentes

Este projeto usa agentes especializados em `.claude/agents/` (gerente-geral,
pesquisador, desenvolvedor, web-designer, copywriter, gestor-de-trafego,
vendedor, contador, analista, testador, dev-seguranca, atendente). Comece
pedindo ao **gerente-geral**.
