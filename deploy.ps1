param(
  [Parameter(Mandatory=$true)]
  [string]$GitHubToken,
  [string]$Repo = "pomo-focus-timer"
)

$ErrorActionPreference = "Stop"
$Headers = @{
  Authorization = "Bearer $GitHubToken"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$Me = Invoke-RestMethod -Method Get -Uri "https://api.github.com/user" -Headers $Headers
$Owner = $Me.login
Write-Host "GitHub user: $Owner"

try {
  $Existing = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$Owner/$Repo" -Headers $Headers
  Write-Host "Repo already exists: $Owner/$Repo"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
  $Body = @{
    name = $Repo
    description = "A Pomofocus-style Pomodoro timer website."
    private = $false
    auto_init = $false
    has_issues = $false
    has_projects = $false
    has_wiki = $false
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "https://api.github.com/user/repos" -Headers $Headers -Body $Body -ContentType "application/json" | Out-Null
  Write-Host "Created repo: $Owner/$Repo"
}

git config user.name $Owner
git config user.email "$Owner@users.noreply.github.com"
$ExistingOrigin = git remote 2>$null | Select-String -SimpleMatch "origin"
if ($ExistingOrigin) {
  git remote remove origin
}
git remote add origin "https://github.com/$Owner/$Repo.git"
git branch -M main

$Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$GitHubToken"))
git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $Auth" push -u origin main --force

try {
  $PagesBody = @{ source = @{ branch = "main"; path = "/" } } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$Owner/$Repo/pages" -Headers $Headers -Body $PagesBody -ContentType "application/json" | Out-Null
  Write-Host "Enabled GitHub Pages."
} catch {
  $Code = $_.Exception.Response.StatusCode.value__
  if ($Code -eq 409) {
    Write-Host "GitHub Pages already enabled."
  } else {
    throw
  }
}

$Url = "https://$Owner.github.io/$Repo/"
Write-Host "Website: $Url"
Write-Host "Shorten if wanted: https://tinyurl.com/create.php?url=$Url"
