# deploy.ps1 — Script de Deploy Automatizado para AWS EC2
# Execução: .\deploy.ps1

$ErrorActionPreference = "Stop"

# Configurações do AWS EC2
$EC2_IP = "18.231.110.109"
$EC2_USER = "ubuntu"
$SSH_KEY = "onlinerpg-key.pem"
$REMOTE_DIR = "/home/ubuntu/onlinerpg"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🚀 INICIANDO PIPELINE DE DEPLOY: Survival 3D RPG" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------
# Passo 1: Validação e compilação do TypeScript local
# -----------------------------------------------------------------
Write-Host "`n[1/5] Validando código TypeScript local..." -ForegroundColor Yellow

$ServerDir = Join-Path $PSScriptRoot "server"
Push-Location $ServerDir

try {
    Write-Host "Instalando dependências locais (se necessário)..." -ForegroundColor Gray
    npm install --no-audit --no-fund
    
    Write-Host "Compilando servidor..." -ForegroundColor Gray
    npm run build
}
catch {
    Write-Host "`n❌ FAIHA NA COMPILAÇÃO LOCAL! O deploy foi cancelado." -ForegroundColor Red
    Pop-Location
    Exit 1
}
Pop-Location
Write-Host "✅ Compilação local concluída com sucesso!" -ForegroundColor Green

# -----------------------------------------------------------------
# Passo 2: Atualização do Changelog a partir do Git log
# -----------------------------------------------------------------
Write-Host "`n[2/5] Atualizando changelog.json..." -ForegroundColor Yellow
try {
    node generate-changelog.js
}
catch {
    Write-Host "⚠️ Aviso: Falha ao gerar changelog.json automático. Continuando..." -ForegroundColor DarkYellow
}

# -----------------------------------------------------------------
# Passo 3: Criar pacote de arquivos (.tar.gz)
# -----------------------------------------------------------------
Write-Host "`n[3/5] Empacotando arquivos do projeto..." -ForegroundColor Yellow

$TarFile = "onlinerpg.tar.gz"
if (Test-Path $TarFile) {
    Remove-Item $TarFile
}

# Cria o tarball excluindo arquivos desnecessários de desenvolvimento
# Nota: tar.exe nativo do Windows 10/11 é usado aqui
tar -czf $TarFile --exclude=node_modules --exclude=.git --exclude=.idea --exclude=.aws --exclude=aws --exclude=*.csv --exclude=*.pem --exclude=server/node_modules --exclude=server/dist --exclude=myaac-main/node_modules --exclude=myaac-main/vendor --exclude=myaac-main/items --exclude=tools --exclude=desktop --exclude=onlinerpg.tar.gz .

if (-not (Test-Path $TarFile)) {
    Write-Host "❌ Erro ao criar o pacote de deploy!" -ForegroundColor Red
    Exit 1
}
Write-Host "✅ Pacote $TarFile criado com sucesso!" -ForegroundColor Green

# -----------------------------------------------------------------
# Passo 4: Upload do pacote via SCP
# -----------------------------------------------------------------
Write-Host "`n[4/5] Enviando pacote para o servidor EC2 ($EC2_IP)..." -ForegroundColor Yellow

try {
    scp -i $SSH_KEY -o StrictHostKeyChecking=no $TarFile "${EC2_USER}@${EC2_IP}:/home/ubuntu/"
    if ($LASTEXITCODE -ne 0) {
        throw "SCP retornou codigo de erro $LASTEXITCODE"
    }
    Write-Host "✅ Upload concluído com sucesso!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Falha ao enviar o pacote via SCP para o servidor!" -ForegroundColor Red
    Exit 1
}

# -----------------------------------------------------------------
# Passo 5: SSH no servidor - backup, extração e recarga no Docker
# -----------------------------------------------------------------
Write-Host "`n[5/5] Executando comandos de deploy no servidor remoto..." -ForegroundColor Yellow

# Comandos shell a serem executados remotamente no Ubuntu
$RemoteCommands = @"
set -e
cd /home/ubuntu
echo "--> Criando backups das configurações atuais..."
if [ -d onlinerpg ]; then
    if [ -f onlinerpg/.env ]; then cp onlinerpg/.env onlinerpg-env-backup; fi
    if [ -f onlinerpg/server/game_data.json ]; then cp onlinerpg/server/game_data.json onlinerpg-gamedata-backup; fi
    if [ -f onlinerpg/client/updates.json ]; then cp onlinerpg/client/updates.json onlinerpg-updates-backup; fi
    if [ -f onlinerpg/client/item_images.json ]; then cp onlinerpg/client/item_images.json onlinerpg-itemimages-backup; fi
    if [ -f onlinerpg/client/item_names.json ]; then cp onlinerpg/client/item_names.json onlinerpg-itemnames-backup; fi
    if [ -f onlinerpg/client/item_drop_rates.json ]; then cp onlinerpg/client/item_drop_rates.json onlinerpg-itemdroprates-backup; fi
    if [ -d onlinerpg/client/items ]; then
        mkdir -p onlinerpg-items-backup
        cp -r onlinerpg/client/items/* onlinerpg-items-backup/ 2>/dev/null || true
    fi
else
    mkdir -p onlinerpg
fi

echo "--> Extraindo novo pacote..."
tar --warning=no-unknown-keyword --no-same-owner --no-same-permissions --touch -xzf onlinerpg.tar.gz -C onlinerpg/

echo "--> Restaurando backups de configuração..."
if [ -f onlinerpg-env-backup ]; then cp onlinerpg-env-backup onlinerpg/.env; fi
if [ -f onlinerpg-gamedata-backup ]; then cp onlinerpg-gamedata-backup onlinerpg/server/game_data.json; fi
if [ -f onlinerpg-updates-backup ]; then cp onlinerpg-updates-backup onlinerpg/client/updates.json; fi
if [ -f onlinerpg-itemimages-backup ]; then cp onlinerpg-itemimages-backup onlinerpg/client/item_images.json; fi
if [ -f onlinerpg-itemnames-backup ]; then cp onlinerpg-itemnames-backup onlinerpg/client/item_names.json; fi
if [ -f onlinerpg-itemdroprates-backup ]; then cp onlinerpg-itemdroprates-backup onlinerpg/client/item_drop_rates.json; fi
if [ -d onlinerpg-items-backup ]; then
    mkdir -p onlinerpg/client/items
    cp -r onlinerpg-items-backup/* onlinerpg/client/items/ 2>/dev/null || true
fi

echo "--> Garantindo permissões de escrita para json de configuração..."
chmod 666 onlinerpg/client/updates.json onlinerpg/server/game_data.json onlinerpg/client/item_images.json onlinerpg/client/item_names.json onlinerpg/client/item_drop_rates.json 2>/dev/null || true

echo "--> Atualizando containers no Docker Compose..."
cd onlinerpg
sudo docker compose build && sudo docker compose up -d

echo "--> Limpando pacotes antigos..."
rm -f /home/ubuntu/onlinerpg.tar.gz

echo "--> Status dos containers:"
sudo docker compose ps
"@

try {
    ssh -i $SSH_KEY -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" $RemoteCommands
    if ($LASTEXITCODE -ne 0) {
        throw "SSH retornou codigo de erro $LASTEXITCODE"
    }
}
catch {
    Write-Host "❌ Falha ao executar os comandos de deploy no servidor remoto!" -ForegroundColor Red
    Exit 1
}

# -----------------------------------------------------------------
# Finalização
# -----------------------------------------------------------------
Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "🎉 DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "Acesse o jogo em: http://$EC2_IP" -ForegroundColor Green
Write-Host "Acesse o painel web em: http://${EC2_IP}:8080" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
