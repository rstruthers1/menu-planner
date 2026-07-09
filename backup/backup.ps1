$file = "$PSScriptRoot\menu_planner_backup_$(Get-Date -Format 'yyyy-MM-dd_HHmm').sql"
docker exec menu-planner-backend-postgres-1 pg_dump -U menu_user menu_planner | Set-Content -Encoding utf8 $file
Write-Host "Saved to $file"
