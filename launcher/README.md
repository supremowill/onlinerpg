# Survival 3D Launcher

Launcher desktop em C#/.NET para Windows.

Fluxo implementado:

- baixa `manifest.json` da AWS;
- compara versao local com versao online;
- baixa ZIP versionado;
- mostra progresso;
- valida SHA-256;
- extrai em pasta temporaria;
- faz backup da pasta `Game/`;
- substitui a pasta `Game/`;
- salva `LauncherData/version.json`;
- gera ticket temporario antes de abrir o jogo;
- inicia `Game/Survival3D.exe`.

Estrutura final no PC do jogador:

```text
MeuJogo/
  Survival3DLauncher.exe
  LauncherData/
    launcher-config.json
    version.json
    logs/
    temp/
    downloads/
    backups/
  Game/
    Survival3D.exe
    Survival3D.pck
```

Publicar launcher:

```powershell
dotnet publish launcher/Survival3DLauncher/Survival3DLauncher.csproj -c Release -r win-x64 --self-contained true
```

Antes de distribuir, edite `LauncherData/launcher-config.json` ou o `launcher-config.json` junto ao `.exe` com a URL real:

```json
{
  "manifestUrl": "https://SEU_CLOUDFRONT_DOMAIN/manifest.json"
}
```

Observacao: o bloqueio dentro do jogo Godot ainda precisa ser implementado depois. Este launcher ja gera o ticket em:

```text
LauncherData/temp/launch-ticket.json
```

E inicia o jogo com:

```text
--launcher-ticket <caminho>
```

Tambem envia variaveis de ambiente:

- `SURVIVAL3D_LAUNCHER=1`
- `SURVIVAL3D_LAUNCHER_VERSION=1.0.0`
- `SURVIVAL3D_GAME_VERSION=<versao>`
- `SURVIVAL3D_LAUNCH_TICKET=<caminho>`
