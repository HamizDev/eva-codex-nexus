import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

test("PowerShell 启动器保留 Windows PowerShell 5.1 所需的 UTF-8 BOM", () => {
  for (const relative of [
    "codex-skin/Start-EVA.ps1",
    "codex-skin/Import-DSH-Boot.ps1",
    "codex-skin/Restore-EVA.ps1",
    "scripts/Install-EVA-DesktopShortcut.ps1",
  ]) {
    const bytes = fs.readFileSync(path.join(root, relative));
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], relative);
  }
});

test("启动器只通过已验证的官方 Appx 与回环 CDP 工作", () => {
  const source = read("codex-skin/Start-EVA.ps1");
  for (const fragment of [
    "Get-AppxPackage -Name 'OpenAI.Codex'",
    "Get-AuthenticodeSignature",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=",
    "--user-data-dir=",
    "Test-CdpEndpoint",
    "Test-ProcessDescendsFrom",
    "Get-CodexLaunchId",
    "CreationDate",
    "--boot-id",
    "--force-token",
    "[guid]::NewGuid().ToString('N')",
    "-ForceToken",
    "$runtime.driver",
    "$state.driver = $selectedDriver",
    "Stop-Codex",
  ]) {
    assert.ok(source.includes(fragment), `missing launcher contract: ${fragment}`);
  }
  assert.ok(!source.includes("app.asar"));
  assert.ok(!source.includes("WindowsApps\\OpenAI.Codex_") || source.includes("Capture"));
  assert.ok(source.includes("[switch]$GuiPrompt"));
  assert.ok(source.includes("System.Windows.Forms.MessageBox"));
  assert.ok(source.includes("Confirm-CodexRestart"));
});

test("CDP 目标列表兼容 Windows PowerShell 5.1 的数组返回", () => {
  const source = read("codex-skin/Start-EVA.ps1");
  assert.match(
    source,
    /Invoke-RestMethod -Uri "http:\/\/127\.0\.0\.1:\$CdpPort\/json\/list" -TimeoutSec 2 -MaximumRedirection 0 \| ForEach-Object \{ \$_ \}/,
  );
});

test("默认入口是官方 Codex 皮肤，工作台保留独立入口", () => {
  const skin = read("Start-EVA.cmd");
  const workbench = read("Start-EVA-Workbench.cmd");
  const vbs = read("Start-EVA.vbs");
  assert.match(skin, /Start-EVA\.vbs/);
  assert.match(vbs, /codex-skin\\Start-EVA\.ps1/);
  assert.match(vbs, /-PromptRestart/);
  assert.match(vbs, /-GuiPrompt/);
  assert.match(vbs, /shell\.Run command, 0, False/);
  assert.match(workbench, /workbench\\start\.ps1/);
  assert.match(read("Restore-EVA.cmd"), /Restore-EVA\.ps1/);
});

test("桌面快捷方式使用官方 Codex 图标并指向隐藏启动器", () => {
  const source = read("scripts/Install-EVA-DesktopShortcut.ps1");
  for (const fragment of [
    "Get-AppxPackage -Name 'OpenAI.Codex'",
    "Desktop",
    "TargetPath = $wscript",
    "IconLocation = $codex.Path + ',0'",
    "Start-EVA.vbs",
    "WindowStyle = 7",
  ]) {
    assert.ok(source.includes(fragment), `missing shortcut contract: ${fragment}`);
  }
});

test("DSH 启动包导入器只在本地复制并校验媒体", () => {
  const source = read("codex-skin/Import-DSH-Boot.ps1");
  for (const fragment of [
    "dsh-eva-theme",
    "assets\\manifest.json",
    "Get-FileHash",
    "sourceCommit",
    "PACK-NOTICE.txt",
    "local-only; original DSH media license applies",
  ]) {
    assert.ok(source.includes(fragment), `missing DSH importer contract: ${fragment}`);
  }
});

test("恢复脚本同时处理 CDP 清理和注入器进程", () => {
  const source = read("codex-skin/Restore-EVA.ps1");
  assert.ok(source.includes("Stop-Process -Id"));
  assert.ok(source.includes("--remove"));
  assert.ok(source.indexOf("--remove") >= 0);
  assert.ok(source.indexOf("Stop-Process -Id") >= 0);
});

test("package 版本与皮肤版本一致", () => {
  const pkg = JSON.parse(read("package.json"));
  const injector = read("codex-skin/injector.mjs");
  assert.equal(pkg.version, "0.3.1");
  assert.match(injector, /export const SKIN_VERSION = "0\.3\.1"/);
});

test("项目版权以 HamizDev 为主并保留必要上游声明", () => {
  const license = read("LICENSE");
  assert.match(license, /Copyright \(c\) 2026 HamizDev/);
  assert.ok(
    license.indexOf("Copyright (c) 2026 HamizDev") <
      license.indexOf("Copyright (c) 2026 Iris-change"),
  );
  const notices = read("THIRD_PARTY_NOTICES.md");
  assert.match(notices, /DSH EVA Theme/);
  assert.match(notices, /Dragon Codex Boot/);
  assert.deepEqual(
    fs.readdirSync(path.join(root, "licenses")).sort(),
    ["DSH-EVA-MIT.txt", "DragonCodexBoot-MIT.txt"],
  );
});
