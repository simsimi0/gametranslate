$ErrorActionPreference = "Stop"

$BundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (Test-Path $BundledNode) {
  & $BundledNode --test tests/localizer.test.mjs
  exit $LASTEXITCODE
}

node --test tests/localizer.test.mjs
