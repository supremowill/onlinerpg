#define AppName "Sobrevivencia 3D"
#define AppVersion "1.0.0"
#define AppPublisher "Survival 3D"
#define LauncherExe "Survival3DLauncher.exe"

[Setup]
AppId={{5A8C8255-406F-4B30-A362-AC7E9F7C13B2}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Sobrevivencia 3D
DefaultGroupName={#AppName}
DisableProgramGroupPage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\myaac-main\downloads
OutputBaseFilename=Sobrevivencia3D_Setup
SetupIconFile=..\launcher\Survival3DLauncher\Assets\Survival3DLauncher.ico
UninstallDisplayIcon={app}\{#LauncherExe}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
DisableDirPage=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Area de Trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked

[Files]
Source: "..\launcher\Survival3DLauncher\bin\Release\net9.0-windows\win-x64\publish\Survival3DLauncher.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\launcher\Survival3DLauncher\bin\Release\net9.0-windows\win-x64\publish\launcher-config.json"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Sobrevivencia 3D Launcher"; Filename: "{app}\{#LauncherExe}"; WorkingDir: "{app}"
Name: "{autodesktop}\Sobrevivencia 3D Launcher"; Filename: "{app}\{#LauncherExe}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#LauncherExe}"; Description: "Abrir o Launcher agora"; Flags: nowait postinstall skipifsilent
