# Online RPG - Survival 3D

Jogo multiplayer 3D de sobrevivência com sistema de bosses, level up e leaderboard.

## 🎮 Funcionalidades

- Multiplayer em tempo real via WebSocket
- Sistema de bosses (9 círculos do Limbo + bosses clássicos)
- Leaderboard e ranking
- Deploy via Docker no Render

## 🚀 Deploy no Render

1. Conecte seu repositório GitHub ao Render
2. Crie um novo "Web Service"
3. Selecione "Docker" como ambiente
4. Adicione as variáveis de ambiente:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATABASE_URL` (URL do PostgreSQL do Render)
5. O deploy usará o `Dockerfile` na raiz

## 🐳 Executar com Docker localmente

```bash
docker-compose up --build
```

## 💻 Desenvolvimento local

```bash
cd server
npm install
npm run build
npm start
```

Acesse: `http://localhost:3000`

## 📦 Estrutura

- `server/` - Servidor Node.js/TypeScript + WebSocket
- `client/` - Cliente HTML/JS com Three.js
- `Dockerfile` - Configuração para deploy
- `docker-compose.yml` - Orquestração local
