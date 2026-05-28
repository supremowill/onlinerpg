# 🚀 Guia de Deploy para AWS EC2 — Online RPG

Este guia documenta o processo de deploy automatizado e as regras para o servidor de produção na AWS. O deploy foi padronizado para mitigar erros, realizando testes e compilação locais antes de atualizar o servidor.

---

## 📋 Regras de Deploy

Para manter a integridade da produção, o fluxo de deploy **sempre** segue esta ordem:
1. **Verificação de Compilação Local**: O código TypeScript do `./server` é compilado locally (`npm run build`). Se houver algum erro de tipo ou sintaxe, o deploy é cancelado.
2. **Atualização do Changelog**: O script `generate-changelog.js` é executado na máquina local para compilar as mensagens do Git em `client/changelog.json`.
3. **Salvamento de Configurações**: Durante a extração no servidor remoto, os arquivos críticos `.env` (banco de dados e segredos), `server/game_data.json` (balanceamento customizado do jogo) e `client/updates.json` (anúncios do cron job de vencedor semanal) são guardados em backup e restaurados automaticamente.
4. **Atualização sem Downtime**: O Docker Compose reconstrói e reinicia apenas os containers cujas imagens mudaram, minimizando o impacto no gameplay.

---

## 🔑 Pré-requisitos para o Deploy

Certifique-se de que a máquina local possui os itens abaixo configurados:
1. **Credenciais AWS**: Suas credenciais devem estar ativas no arquivo de perfil padrão da AWS (`C:\Users\William\.aws\credentials`), contendo chaves válidas.
2. **Chave Privada SSH**: O arquivo `onlinerpg-key.pem` deve estar na raiz deste projeto.
3. **OpenSSH Client**: O comando `ssh` e `scp` devem estar disponíveis no PowerShell/CMD.
4. **Node.js**: Instalado localmente para execução do build e scripts.

---

## 🛠️ Deploy Automatizado (Recomendado)

Na raiz do projeto no seu terminal PowerShell, execute o script:
```powershell
.\deploy.ps1
```

O script fará de forma automática:
- O build TypeScript local do servidor.
- O empacotamento dos arquivos relevantes em `onlinerpg.tar.gz` (excluindo pastas pesadas como `node_modules`).
- O envio do pacote via SCP para a instância EC2 (`18.231.110.109`).
- O backup das configurações anteriores no EC2.
- A extração do pacote.
- A reconstrução (`docker compose up --build -d`) de todos os serviços.

---

## 📝 Comandos Úteis no Servidor EC2

Caso precise depurar problemas no servidor de produção, conecte-se via SSH:
```powershell
ssh -i onlinerpg-key.pem ubuntu@18.231.110.109
```

### Verificar Status dos Containers:
```bash
cd onlinerpg
sudo docker compose ps
```

### Visualizar Logs em Tempo Real:
*   **Servidor do jogo (TypeScript/WebSocket)**:
    ```bash
    sudo docker compose logs -f app
    ```
*   **Portal Web (MyAAC/PHP)**:
    ```bash
    sudo docker compose logs -f website
    ```
*   **Banco de Dados (PostgreSQL)**:
    ```bash
    sudo docker compose logs -f db
    ```

### Reiniciar Serviços:
```bash
sudo docker compose restart app website
```
