Get-ChildItem -Path 'c:\Users\admin\Downloads\luminostech-lumohub\frontend-web\src' -Recurse -Include '*.tsx','*.ts' | ForEach-Object {
  $content = [System.IO.File]::ReadAllText($_.FullName)
  if ($content -match 'purple-600') {
    $content = $content -replace 'purple-600','primary-700' -replace 'purple-500','primary-600' -replace 'purple-100','primary-100'
    [System.IO.File]::WriteAllText($_.FullName, $content)
    Write-Host ('Updated purple: ' + $_.Name)
  }
}
