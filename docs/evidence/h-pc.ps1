$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3000'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$out = 'C:\Users\BALAJI\AppData\Local\Temp\opencode\phase1.6-positive-control.txt'
function Log($s) { Write-Output $s; Add-Content -Path $out -Value $s }

Set-Content -Path $out -Value "EA SYSTEM - PHASE 1.6B POSITIVE-CONTROL EVIDENCE (same-school replays, every N-guard)"
Add-Content -Path $out -Value "Run: 2026-08-02  Auth: schooladmin@easystem.dev (School A, seed_school_ea)  All rows created/updated by School A for School A"

function Invoke-Json($method, $path, $body = $null) {
  try {
    if ($null -eq $body) { $r = Invoke-WebRequest -Uri "$base$path" -Method $method -WebSession $session -UseBasicParsing -TimeoutSec 120 }
    else { $r = Invoke-WebRequest -Uri "$base$path" -Method $method -ContentType 'application/json' -Body $body -WebSession $session -UseBasicParsing -TimeoutSec 120 }
    return @{ status = $r.StatusCode; raw = $r.Content }
  } catch {
    $status = 0
    try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    $msg = $_.ErrorDetails.Message
    if (-not $msg) { try { $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream); $msg = $reader.ReadToEnd() } catch { $msg = '' } }
    return @{ status = $status; raw = $msg }
  }
}

function Section($title) {
  Log ""
  Log "========================================================"
  Log $title
  Log "========================================================"
}

function Req($label, $method, $path, $body = $null) {
  $r = Invoke-Json $method $path $body
  Log "[$label] REQUEST: $method $path body=$body"
  Log "[$label] RESPONSE: HTTP $($r.status) body=$($r.raw)"
  return $r
}

function Grab($resp, $key) {
  if ($resp.raw -match "`"$key`":`"([^`"]+)`"") { return $matches[1] }
  return ''
}

$login = Invoke-Json 'POST' '/api/auth/sign-in/email' (@{ email = 'schooladmin@easystem.dev'; password = 'password123' } | ConvertTo-Json)
Log "login: HTTP $($login.status)"

Section "PC-Y Create own academic year (basis for N6a/N6b/N10a/N10b/N12/N13)"
$r = Req 'PC-Y' 'POST' '/api/academic-years' (@{ name = 'Evidence PC Y1'; startDate = '2026-08-01'; endDate = '2027-03-31'; isActive = $false } | ConvertTo-Json)
$Y1 = Grab $r 'id'; Log "Y1=$Y1"

Section "N10a POST /api/classes own year (positive)"
$r = Req 'N10a-PC' 'POST' '/api/classes' (@{ name = 'Evidence PC C1'; academicYearId = $Y1 } | ConvertTo-Json)
$C1 = Grab $r 'id'; Log "C1=$C1"

Section "N10b POST /api/terms own year (positive)"
$r = Req 'N10b-PC' 'POST' '/api/terms' (@{ name = 'Evidence PC T1'; academicYearId = $Y1; startDate = '2026-08-01'; endDate = '2026-12-31' } | ConvertTo-Json)
$T1 = Grab $r 'id'; Log "T1=$T1"

Section "N11 POST /api/sections own class (positive)"
$r = Req 'N11-PC' 'POST' '/api/sections' (@{ name = 'Evidence PC S1'; classId = $C1 } | ConvertTo-Json)
$S1 = Grab $r 'id'; Log "S1=$S1"

Section "N12a POST /api/students own refs (positive)"
$r = Req 'N12a-PC' 'POST' '/api/students' (@{ firstName = 'Evidence'; lastName = 'PC'; admissionNumber = 'EVID-PC-0001'; academicYearId = $Y1; classId = $C1; sectionId = $S1 } | ConvertTo-Json)
$ST1 = Grab $r 'id'; Log "ST1=$ST1"

Section "N12b PATCH /api/students own refs (positive)"
Req 'N12b-PC' 'PATCH' "/api/students/$ST1" (@{ academicYearId = $Y1; classId = $C1; sectionId = $S1; rollNumber = '7' } | ConvertTo-Json)

Section "N8 DELETE /api/students own student (positive archive)"
Req 'N8-PC' 'DELETE' "/api/students/$ST1"

Section "N1a PATCH /api/terms own term (positive)"
Req 'N1a-PC' 'PATCH' "/api/terms?id=$T1" (@{ name = 'Evidence PC T1 Renamed' } | ConvertTo-Json)

Section "N1b DELETE /api/terms own term (positive archive)"
Req 'N1b-PC' 'DELETE' "/api/terms?id=$T1"

Section "N4a PATCH /api/sections own section (positive)"
Req 'N4a-PC' 'PATCH' "/api/sections?id=$S1" (@{ name = 'Evidence PC S1 Renamed' } | ConvertTo-Json)

Section "N4b DELETE /api/sections own section (positive archive)"
Req 'N4b-PC' 'DELETE' "/api/sections?id=$S1"

Section "N2a PATCH /api/classes own class (positive)"
Req 'N2a-PC' 'PATCH' "/api/classes?id=$C1" (@{ name = 'Evidence PC C1 Renamed' } | ConvertTo-Json)

Section "N2b DELETE /api/classes own class (positive archive)"
Req 'N2b-PC' 'DELETE' "/api/classes?id=$C1"

Section "PC-C2 Create second own class (for N3 [id] path)"
$r = Req 'PC-C2' 'POST' '/api/classes' (@{ name = 'Evidence PC C2'; academicYearId = $Y1 } | ConvertTo-Json)
$C2 = Grab $r 'id'; Log "C2=$C2"

Section "N3a PATCH /api/classes/[id] own class (positive)"
Req 'N3a-PC' 'PATCH' "/api/classes/$C2" (@{ name = 'Evidence PC C2 Renamed' } | ConvertTo-Json)

Section "N3b DELETE /api/classes/[id] own empty class (positive archive)"
Req 'N3b-PC' 'DELETE' "/api/classes/$C2"

Section "PC-Y2 Create second own empty year (for N7 [id] path)"
$r = Req 'PC-Y2' 'POST' '/api/academic-years' (@{ name = 'Evidence PC Y2'; startDate = '2027-06-01'; endDate = '2028-03-31'; isActive = $false } | ConvertTo-Json)
$Y2 = Grab $r 'id'; Log "Y2=$Y2"

Section "N6a PATCH /api/academic-years own year (positive)"
Req 'N6a-PC' 'PATCH' "/api/academic-years?id=$Y1" (@{ name = 'Evidence PC Y1 Renamed' } | ConvertTo-Json)

Section "N6b DELETE /api/academic-years own year (positive archive)"
Req 'N6b-PC' 'DELETE' "/api/academic-years?id=$Y1"

Section "N7a PATCH /api/academic-years/[id] own year (positive)"
Req 'N7a-PC' 'PATCH' "/api/academic-years/$Y2" (@{ name = 'Evidence PC Y2 Renamed' } | ConvertTo-Json)

Section "N7b DELETE /api/academic-years/[id] own empty year (positive archive)"
Req 'N7b-PC' 'DELETE' "/api/academic-years/$Y2"

Section "PC-SUB Create own subject (for N5)"
$r = Req 'PC-SUB' 'POST' '/api/subjects' (@{ name = 'Evidence PC Subject'; code = 'EVIDPC' } | ConvertTo-Json)
$SUB1 = Grab $r 'id'; Log "SUB1=$SUB1"

Section "N5a PATCH /api/subjects own subject (positive)"
Req 'N5a-PC' 'PATCH' "/api/subjects?id=$SUB1" (@{ name = 'Evidence PC Subject Renamed' } | ConvertTo-Json)

Section "N5b DELETE /api/subjects own subject (positive archive)"
Req 'N5b-PC' 'DELETE' "/api/subjects?id=$SUB1"

Section "N13 PATCH /api/subjects/[id] assign with own refs (positive)"
Req 'N13-PC' 'PATCH' '/api/subjects/seed_sub_mat' (@{ action = 'assign'; academicYearId = $Y1; classId = $C1; sectionId = $S1; teacherMembershipId = 'seed_mem_admin' } | ConvertTo-Json)

Section "N9 NOTE"
Log "N9 (crud-demo DELETE) has no positive control: SCHOOL_ADMIN is not granted schools:delete, so the permission gate blocks every tenant role before the (now school-scoped) archive closure is reached. The hardened guard is dead code for tenant roles; verified by code inspection only."

Log ""
Log "DONE"
