function Get-FarineMsBuildPath {
  $vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vswhere) {
    $path = & $vswhere -latest -products * -requires Microsoft.Component.MSBuild -find "MSBuild\Current\Bin\MSBuild.exe" | Select-Object -First 1
    if ($path -and (Test-Path $path)) {
      return $path
    }
  }

  $fallback = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe"
  if (Test-Path $fallback) {
    return $fallback
  }

  throw "MSBuild.exe introuvable. Installe Visual Studio Build Tools avec .\win-app\scripts\install-native-prereqs.ps1"
}
