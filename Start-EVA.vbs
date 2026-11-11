Option Explicit

Dim fso, shell, root, ps1, driver, command
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = fso.BuildPath(root, "codex-skin\Start-EVA.ps1")
driver = "remember"
If WScript.Arguments.Count > 0 Then driver = LCase(Trim(WScript.Arguments(0)))
If driver <> "remember" And driver <> "asuka" And driver <> "rei" Then driver = "remember"

If Not fso.FileExists(ps1) Then
  MsgBox "找不到 EVA 启动器：" & ps1, 16, "EVA Codex"
  WScript.Quit 1
End If

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """ -Driver " & driver & " -PromptRestart -GuiPrompt"
shell.Run command, 0, False
