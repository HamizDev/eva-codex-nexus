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
    "codex-skin/Import-EVA-Theme.ps1",
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
    "Stop-StaleInjectors",
    "Get-ProcessRows",
    "--watch",
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

test("注入器与 CDP 等待并行启动，避免聊天页先出现", () => {
  const source = read("codex-skin/Start-EVA.ps1");
  const processWaitIndex = source.indexOf("$launchedProcess = Wait-CodexProcess");
  const injectorIndex = source.indexOf("$injector = Start-Injector");
  const waitIndex = source.indexOf(
    "if (-not (Wait-CdpEndpoint",
    injectorIndex,
  );
  assert.ok(processWaitIndex > 0);
  assert.ok(injectorIndex > 0);
  assert.ok(processWaitIndex < injectorIndex);
  assert.ok(waitIndex > injectorIndex);
  assert.match(source, /\$bootId = Get-CodexLaunchId -Install \$install/);
});

test("默认入口只启动官方 Codex 皮肤", () => {
  const skin = read("Start-EVA.cmd");
  const vbs = read("Start-EVA.vbs");
  assert.match(skin, /Start-EVA\.vbs/);
  assert.match(vbs, /codex-skin\\Start-EVA\.ps1/);
  assert.match(vbs, /-PromptRestart/);
  assert.match(vbs, /-GuiPrompt/);
  assert.match(vbs, /shell\.Run command, 0, False/);
  assert.equal(fs.existsSync(path.join(root, "Start-EVA-Workbench.cmd")), false);
  assert.equal(fs.existsSync(path.join(root, "workbench", "start.ps1")), false);
  assert.match(read("Restore-EVA.cmd"), /Restore-EVA\.ps1/);
});

test("桌面快捷方式使用官方 Codex 图标并指向隐藏启动器", () => {
  const source = read("scripts/Install-EVA-DesktopShortcut.ps1");
  for (const fragment of [
    "Get-AppxPackage -Name 'OpenAI.Codex'",
    "Import-EVA-Theme.ps1",
    "ThemeDestination",
    "Desktop",
    "TargetPath = $wscript",
    "IconLocation = $codex.Path + ',0'",
    "Start-EVA.vbs",
    "WindowStyle = 7",
  ]) {
    assert.ok(source.includes(fragment), `missing shortcut contract: ${fragment}`);
  }
});

test("默认启动和桌面安装都会准备内置 EVA 素材包", () => {
  const launcher = read("codex-skin/Start-EVA.ps1");
  for (const fragment of [
    "BundledThemeRoot",
    "Ensure-BundledTheme",
    "Import-EVA-Theme.ps1",
    "assetCount -lt 20",
  ]) {
    assert.ok(launcher.includes(fragment), `missing automatic theme import contract: ${fragment}`);
  }
  assert.ok(launcher.indexOf("Ensure-BundledTheme") < launcher.indexOf("$saved = Read-SavedState"));
});

test("EVA 主题素材导入器只在本地复制并校验媒体", () => {
  const source = read("codex-skin/Import-EVA-Theme.ps1");
  for (const fragment of [
    "EVA_THEME_SOURCE_ROOT",
    "eva-theme",
    "assets\\manifest.json",
    "MEDIA-LICENSE.md",
    "asukaPortrait",
    "reiPortrait",
    "asukaPickVoice",
    "reiPickVoice",
    "asukaWelcome",
    "reiWelcome",
    "asukaApproval",
    "reiApproval",
    "asukaComplete",
    "reiComplete",
    "typing",
    "Get-FileHash",
    "sourceCommit",
    "sourceVersion",
    "PACK-NOTICE.txt",
    "no redistribution without written permission",
  ]) {
    assert.ok(source.includes(fragment), `missing EVA theme importer contract: ${fragment}`);
  }
});

test("仓库内置 EVA 素材包保留独立媒体许可和校验清单", () => {
  const pack = JSON.parse(read("eva-theme/assets/manifest.json"));
  assert.equal(pack.package, "eva-theme-pack");
  assert.equal(pack.sourceVersion, "0.51.2");
  assert.equal(Object.keys(pack.assets).length, 20);
  assert.match(read("eva-theme/MEDIA-LICENSE.md"), /All rights reserved/i);
  assert.match(read("eva-theme/MEDIA-LICENSE.md"), /prior written permission/i);
  assert.match(read("eva-theme/NOTICE.md"), /MEDIA-LICENSE\.md/);
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
  const launcher = read("codex-skin/Start-EVA.ps1");
  assert.equal(pkg.version, "0.4.3");
  assert.match(injector, /export const SKIN_VERSION = "0\.4\.3"/);
  assert.match(launcher, /\$SkinVersion = '0\.4\.3'/);
});

test("项目版权以 HamizDev 为主且不保留旧上游声明", () => {
  const license = read("LICENSE");
  assert.match(license, /Copyright \(c\) 2026 HamizDev/);
  assert.ok(!license.includes("Iris-change"));
  const notices = read("THIRD_PARTY_NOTICES.md");
  assert.match(notices, /EVA\/NERV visual identity/);
  assert.ok(!notices.includes("Dragon Codex Boot"));
  const licenseDir = path.join(root, "licenses");
  assert.deepEqual(fs.existsSync(licenseDir) ? fs.readdirSync(licenseDir).sort() : [], []);
});

test("来源说明只描述当前官方 Codex 换肤层", () => {
  const provenance = read("PROVENANCE.md");
  assert.match(provenance, /官方 Codex 桌面客户端换肤层/);
  assert.ok(!/HACKCLAW|骇爪|Dragon Codex Boot|Iris-change|codex app-server/i.test(provenance));
});
