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
  for (const relative of ["codex-skin/Start-EVA.ps1", "codex-skin/Restore-EVA.ps1"]) {
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
    "Stop-Codex",
  ]) {
    assert.ok(source.includes(fragment), `missing launcher contract: ${fragment}`);
  }
  assert.ok(!source.includes("app.asar"));
  assert.ok(!source.includes("WindowsApps\\OpenAI.Codex_") || source.includes("Capture"));
});

test("默认入口是官方 Codex 皮肤，工作台保留独立入口", () => {
  const skin = read("Start-EVA.cmd");
  const workbench = read("Start-EVA-Workbench.cmd");
  assert.match(skin, /codex-skin\\Start-EVA\.ps1/);
  assert.match(skin, /-PromptRestart/);
  assert.match(workbench, /workbench\\start\.ps1/);
  assert.match(read("Restore-EVA.cmd"), /Restore-EVA\.ps1/);
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
  assert.equal(pkg.version, "0.1.0");
  assert.match(injector, /export const SKIN_VERSION = "0\.1\.0"/);
});
