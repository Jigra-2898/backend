$uploadsPath = "d:\Project\backend\uploads\images"
$dbPath = "d:\Project\backend\db.json"

# Read the current db.json
$db = Get-Content $dbPath | ConvertFrom-Json

# Get all image files recursively
$files = Get-ChildItem -Path $uploadsPath -Recurse -Include "*.jpg", "*.png"

$renameCount = 0
$fileMapping = @{}

# First pass: gather all files to rename and create mapping
foreach ($file in $files) {
    if ($file.Name -match '^imgi_\d+_(.+)$') {
        $newName = $matches[1]
        $newPath = Join-Path $file.Directory.FullName $newName
        
        # Store the mapping from old to new
        $oldFullPath = $file.FullName
        $relativeOldPath = $oldFullPath.Replace("d:\Project\backend\", "")
        $relativeNewPath = $newPath.Replace("d:\Project\backend\", "")
        
        $fileMapping[$relativeOldPath] = $relativeNewPath
        
        # Rename the file
        Rename-Item -Path $file.FullName -NewName $newName -Force -ErrorAction SilentlyContinue
        $renameCount++
        Write-Host "Renamed: $($file.Name) -> $newName"
    }
}

# Second pass: update db.json with new paths
if ($db.items) {
    foreach ($item in $db.items) {
        if ($item.photos) {
            for ($i = 0; $i -lt $item.photos.Count; $i++) {
                $oldPath = $item.photos[$i].Replace("\", "/")
                
                # Check if this path needs to be updated
                foreach ($oldKey in $fileMapping.Keys) {
                    $oldKeyNormalized = $oldKey.Replace("\", "/")
                    if ($oldPath -like "*$($oldKeyNormalized)*" -or $oldKeyNormalized -like "*$oldPath*") {
                        $newValue = $fileMapping[$oldKey].Replace("\", "/")
                        $item.photos[$i] = $newValue
                        Write-Host "Updated photo path for item $($item.id)"
                        break
                    }
                }
            }
        }
    }
}

# Write updated db.json
$db | ConvertTo-Json -Depth 100 | Set-Content $dbPath

Write-Host "✓ Renamed $renameCount files"
Write-Host "✓ Updated db.json with new file paths"
