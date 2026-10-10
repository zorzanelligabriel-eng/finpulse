# FinPulse

Controle financeiro pessoal com carteira de ativos e cotações em tempo real.

Você registra receitas e despesas, define um teto de gastos por categoria e cadastra o que possui de moeda estrangeira e criptomoedas. O valor da carteira em reais é recalculado na tela a cada nova cotação, sem recarregar a página.

![Visão geral do FinPulse](docs/visao-geral.png)

> As capturas deste README foram feitas no modo de cotações simuladas (`MARKET_MODE=mock`), com a conta de demonstração.

## Funcionalidades

- **Conta e login** com senha criptografada (bcrypt) e sessão por JWT.
- **Lançamentos** de receitas e despesas com busca, filtros por tipo, categoria e período, e paginação feita no banco.
- **Categorias** personalizáveis, com cor. Uma categoria com lançamentos não pode ser apagada.
- **Orçamentos mensais** por categoria, com três situações: dentro do limite, perto do limite (80% ou mais) e estourado.
- **Visão geral** com resultado do mês, gastos por categoria e comparação dos últimos 6 meses.
- **Carteira de ativos**: quantidade e custo de cada moeda ou cripto, com valor atual, variação em 24h e lucro sobre o investido.
- **Mercado ao vivo**: as 10 maiores criptomoedas e as moedas configuradas (dólar, euro e libra por padrão), enviadas ao navegador por WebSocket.

| Carteira | Mercado |
| --- | --- |
| ![Carteira](docs/carteira.png) | ![Mercado](docs/mercado.png) |

## Tecnologias

| Camada | Ferramentas |
| --- | --- |
| Back-end | Node.js, Express, PostgreSQL (`pg`), WebSocket (`ws`), JWT, bcrypt, Zod |
| Front-end | React, React Router, Vite, CSS puro, gráficos em SVG feitos à mão |
| Testes | `node:test` (nativo do Node) contra um PostgreSQL real |
| Dados de mercado | [CoinGecko](https://docs.coingecko.com/) (criptomoedas) e [AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas) (moedas) |

## Como o tempo real funciona

```mermaid
flowchart LR
    CG[CoinGecko] --> MS
    AW[AwesomeAPI] --> MS
    subgraph API[Back-end Node]
        MS[MarketService<br/>consulta a cada 60 s<br/>e guarda em cache]
        WS[Servidor WebSocket]
        REST[Rotas REST]
        MS -- evento update --> WS
        MS -- última cotação --> REST
    end
    REST <--> DB[(PostgreSQL)]
    WS -- cotações --> FE[React]
    FE -- lançamentos, carteira --> REST
```

1. O `MarketService` consulta as duas APIs em intervalos fixos e guarda a última resposta em memória.
2. A cada atualização ele emite um evento, e o servidor WebSocket repassa as cotações para todos os navegadores conectados.
3. O front guarda a quantidade de cada ativo e multiplica pelo preço que acabou de chegar. O patrimônio muda na tela sem nenhuma chamada extra à API.

O navegador nunca fala direto com CoinGecko ou AwesomeAPI. Com isso, cem usuários conectados geram a mesma quantidade de consultas externas que um só, as chaves de API ficam no servidor e, se uma fonte cair, o app continua mostrando o último preço conhecido com um aviso.

## Como rodar

Você precisa de [Node.js 20 ou mais novo](https://nodejs.org/) e de um PostgreSQL. O jeito mais simples de ter o banco é com [Docker](https://www.docker.com/products/docker-desktop/).

### 1. Banco de dados

**Com Docker** (cria os bancos `finpulse` e `finpulse_test`):

```bash
docker compose up -d
```

**Sem Docker**, com um PostgreSQL já instalado, crie o usuário e os bancos pelo `psql`:

```sql
CREATE USER finpulse WITH PASSWORD 'finpulse';
CREATE DATABASE finpulse OWNER finpulse;
CREATE DATABASE finpulse_test OWNER finpulse;
```

### 2. Back-end

```bash
cd backend
npm install
cp .env.example .env      # no Windows (cmd): copy .env.example .env
npm run seed              # opcional: cria a conta de demonstração
npm run dev
```

A API sobe em `http://localhost:3333` e cria as tabelas sozinha na primeira execução.

### 3. Front-end

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Abra `http://localhost:5173`. Se rodou o seed, entre com `demo@finpulse.dev` e a senha `demo1234`.

### Sem internet ou sem querer depender das APIs

No `backend/.env`, troque `MARKET_MODE=live` por `MARKET_MODE=mock`. O servidor passa a gerar preços simulados a cada 3 segundos, o que também é útil para ver o tempo real funcionando sem esperar 1 minuto entre as cotações.

## Variáveis de ambiente

Todas ficam em `backend/.env` (modelo em `backend/.env.example`).

| Variável | Para que serve | Padrão |
| --- | --- | --- |
| `PORT` | Porta da API | `3333` |
| `DATABASE_URL` | Conexão com o banco principal | `postgres://finpulse:finpulse@localhost:5432/finpulse` |
| `TEST_DATABASE_URL` | Banco usado só pelos testes (é apagado a cada execução) | `.../finpulse_test` |
| `JWT_SECRET` | Segredo que assina os tokens. Obrigatório em produção | valor de desenvolvimento |
| `JWT_EXPIRES_IN` | Validade do login | `7d` |
| `CORS_ORIGIN` | Endereço do front liberado | `http://localhost:5173` |
| `MARKET_MODE` | `live` (APIs reais) ou `mock` (simulado) | `live` |
| `MARKET_REFRESH_MS` | Intervalo entre consultas de cotação | `60000` |
| `MARKET_CURRENCIES` | Moedas acompanhadas, cotadas em reais | `USD,EUR,GBP` |
| `COINGECKO_API_KEY` | Chave demo gratuita do CoinGecko (opcional) | vazio |
| `AWESOMEAPI_TOKEN` | Chave gratuita da AwesomeAPI (opcional) | vazio |

O front-end tem uma única variável, em `frontend/.env` (modelo em `frontend/.env.example`): `VITE_API_URL`, o endereço do back-end quando ele fica em outro domínio. Vazia em desenvolvimento, porque o Vite repassa `/api` e `/ws` para a porta 3333.

As duas APIs funcionam sem chave, com limites menores. Sem chave, a AwesomeAPI mantém cada resposta em cache por 1 minuto, por isso o intervalo padrão é de 60 segundos.

## Testes

```bash
cd backend
npm test
```

São 24 testes em três arquivos:

- `tests/api.test.js` sobe a API numa porta livre e faz requisições HTTP de verdade contra o banco de testes: cadastro, login, validações, paginação, filtros, orçamentos, dashboard, carteira, isolamento entre usuários e o canal WebSocket.
- `tests/market.test.js` testa o serviço de cotações com respostas falsas das APIs, incluindo o comportamento quando uma ou as duas fontes caem.
- `tests/portfolio.test.js` testa o cálculo do patrimônio.

Os testes apagam os dados do banco apontado por `TEST_DATABASE_URL` e se recusam a rodar se o nome do banco não contiver `test`.

## API

Todas as rotas, exceto cadastro e login, exigem o cabeçalho `Authorization: Bearer <token>`.

| Método | Rota | O que faz |
| --- | --- | --- |
| POST | `/api/auth/register` | Cria a conta e devolve o token |
| POST | `/api/auth/login` | Faz login e devolve o token |
| GET | `/api/auth/me` | Dados do usuário logado |
| GET | `/api/categories` | Lista categorias com a contagem de lançamentos |
| POST, PUT, DELETE | `/api/categories[/:id]` | Cria, edita e exclui categoria |
| GET | `/api/transactions` | Lista paginada. Filtros: `page`, `limit`, `type`, `categoryId`, `from`, `to`, `q` |
| POST, PUT, DELETE | `/api/transactions[/:id]` | Cria, edita e exclui lançamento |
| GET | `/api/budgets?month=AAAA-MM` | Orçamentos do mês com gasto, saldo e situação |
| PUT | `/api/budgets` | Cria ou atualiza o limite de uma categoria no mês |
| DELETE | `/api/budgets/:id` | Remove o orçamento |
| GET | `/api/dashboard?month=AAAA-MM` | Resumo do mês, gastos por categoria, histórico e alertas |
| GET | `/api/assets` | Carteira com valores calculados pela cotação atual |
| POST, PUT, DELETE | `/api/assets[/:id]` | Adiciona, edita e remove ativo |
| GET | `/api/market` | Última cotação em cache |
| WebSocket | `/ws?token=<token>` | Envia `{ "type": "market", "data": ... }` a cada atualização |

## Estrutura

```
backend/
  src/
    app.js              monta o Express e registra as rotas
    server.js           sobe HTTP, WebSocket e o serviço de cotações
    config.js           lê as variáveis de ambiente
    db/                 conexão, schema.sql, migrate e seed
    middleware/         autenticação, validação e tratamento de erros
    routes/             uma rota por recurso (auth, transactions, budgets...)
    services/           cotações (marketService) e cálculo da carteira (portfolio)
    realtime/           servidor WebSocket
  tests/
frontend/
  src/
    api/                cliente HTTP com token
    context/            sessão (AuthContext) e cotações ao vivo (MarketContext)
    components/         layout, faixa de cotações, modal e gráficos em SVG
    pages/              uma tela por arquivo
    utils/              formatação e cálculo da carteira
```

## Decisões de projeto

- **SQL escrito à mão, sem ORM.** As consultas usam recursos do PostgreSQL como `FILTER`, `ON CONFLICT` e agregações, e ficam visíveis nas rotas. Todas usam parâmetros (`$1`, `$2`...), nunca concatenação de texto vindo do usuário.
- **Dinheiro em `NUMERIC`, não em `float`.** Os valores são guardados com precisão exata no banco e só viram número de ponto flutuante na hora de enviar ao front.
- **O tipo do lançamento vem da categoria.** O front não envia "receita" ou "despesa"; a API copia o tipo da categoria escolhida, o que impede um lançamento de despesa numa categoria de receita.
- **Cada usuário só enxerga o que é seu.** Toda consulta filtra por `user_id` tirado do token, e há testes que tentam acessar dados de outra conta.
- **WebSocket autenticado no handshake.** O token é conferido antes de aceitar a conexão, e um heartbeat derruba conexões mortas.
- **Gráficos em SVG puro.** Rosca, barras e minigráficos são componentes pequenos, sem biblioteca de gráficos.
- **`createApp({ market })` recebe o serviço de cotações por parâmetro.** Isso permite que os testes usem preços fixos e chequem os cálculos com números exatos.

## Limitações e próximos passos

- A carteira aceita apenas os ativos acompanhados: as moedas de `MARKET_CURRENCIES` e as 10 maiores criptomoedas. Se uma cripto da carteira sair do top 10, ela aparece como "sem cotação" até voltar.
- O token fica no `localStorage`. Em produção, um cookie `httpOnly` com refresh token seria mais seguro.
- O histórico dos minigráficos existe só enquanto a aba está aberta. Guardar cotações no banco permitiria gráficos de dias ou meses.
- Ideias: importar extrato em CSV, lançamentos recorrentes, metas de economia, modo escuro e deploy.

## Licença

[MIT](LICENSE)
