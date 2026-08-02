$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3000'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$out = 'C:\Users\BALAJI\AppData\Local\Temp\opencode\phase1.6-before.txt'
function Log($s) { Write-Output $s; Add-Content -Path $out -Value $s }

Set-Content -Path $out -Value "EA SYSTEM - PHASE 1.6 AUDIT EVIDENCE - N1-N13 BEFORE FIX (pre-fix exploit)"
Add-Content -Path $out -Value "Run: 2026-08-02  Auth: schooladmin@easystem.dev (School A)  Target: School B ids"

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

$login = Invoke-Json 'POST' '/api/auth/sign-in/email' (@{ email = 'schooladmin@easystem.dev'; password = 'password123' } | ConvertTo-Json)
Log "login: HTTP $($login.status)"

Section "N1a PATCH /api/terms?id=fixture_term_b1 (foreign term rename)"
Req 'N1a' 'PATCH' '/api/terms?id=fixture_term_b1' (@{ name = 'Evidence Renamed' } | ConvertTo-Json)

Section "N1b DELETE /api/terms?id=fixture_term_b1 (foreign term archive)"
Req 'N1b' 'DELETE' '/api/terms?id=fixture_term_b1'

Section "N2a PATCH /api/classes?id=fixture_cls_b_g01 (foreign class rename)"
Req 'N2a' 'PATCH' '/api/classes?id=fixture_cls_b_g01' (@{ name = 'Evidence Renamed' } | ConvertTo-Json)

Section "N2b DELETE /api/classes?id=fixture_cls_b_g01 (foreign class archive)"
Req 'N2b' 'DELETE' '/api/classes?id=fixture_cls_b_g01'

Section "N3a PATCH /api/classes/fixture_cls_b_g01 (foreign class rename path)"
Req 'N3a' 'PATCH' '/api/classes/fixture_cls_b_g01' (@{ name = 'Evidence Renamed' } | ConvertTo-Json)

Section "N3b DELETE /api/classes/fixture_cls_b_g02 (foreign empty class archive)"
Req 'N3b' 'DELETE' '/api/classes/fixture_cls_b_g02'

Section "N4a PATCH /api/sections?id=fixture_sec_b_g01_a (foreign section rename)"
Req 'N4a' 'PATCH' '/api/sections?id=fixture_sec_b_g01_a' (@{ name = 'Evidence Renamed' } | ConvertTo-Json)

Section "N4b DELETE /api/sections?id=fixture_sec_b_g01_a (foreign section archive)"
Req 'N4b' 'DELETE' '/api/sections?id=fixture_sec_b_g01_a'

Section "N5a PATCH /api/subjects?id=fixture_sub_b_math (foreign subject rename)"
Req 'N5a' 'PATCH' '/api/subjects?id=fixture_sub_b_math' (@{ name = 'Evidence Renamed' } | ConvertTo-Json)

Section "N5b DELETE /api/subjects?id=fixture_sub_b_math (foreign subject archive)"
Req 'N5b' 'DELETE' '/api/subjects?id=fixture_sub_b_math'

Section "N6a PATCH /api/academic-years?id=fixture_ay_b (foreign year rename)"
Req 'N6a' 'PATCH' '/api/academic-years?id=fixture_ay_b' (@{ name = 'Evidence Renamed' } | ConvertTo-Json)

Section "N6b DELETE /api/academic-years?id=fixture_ay_b (foreign year archive)"
Req 'N6b' 'DELETE' '/api/academic-years?id=fixture_ay_b'

Section "N7a PATCH /api/academic-years/fixture_ay_b (foreign year rename path)"
Req 'N7a' 'PATCH' '/api/academic-years/fixture_ay_b' (@{ name = 'Evidence Renamed' } | ConvertTo-Json)

Section "N7b DELETE /api/academic-years/fixture_ay_b2 (foreign empty year archive)"
Req 'N7b' 'DELETE' '/api/academic-years/fixture_ay_b2'

Section "N8 DELETE /api/students/fixture_stu_b1 (foreign student archive)"
Req 'N8' 'DELETE' '/api/students/fixture_stu_b1'

Section "N9 DELETE /api/crud-demo?id=fixture_crud_b1 (foreign crud demo archive)"
Req 'N9' 'DELETE' '/api/crud-demo?id=fixture_crud_b1'

Section "N10a POST /api/classes (class referencing foreign academic year)"
$n10a = Req 'N10a' 'POST' '/api/classes' (@{ name = 'Evidence N10'; academicYearId = 'fixture_ay_b' } | ConvertTo-Json)

Section "N10b POST /api/terms (term referencing foreign academic year)"
Req 'N10b' 'POST' '/api/terms' (@{ name = 'Evidence N10'; academicYearId = 'fixture_ay_b'; startDate = '2026-06-01'; endDate = '2026-12-31' } | ConvertTo-Json)

Section "N11 POST /api/sections (section referencing foreign class)"
Req 'N11' 'POST' '/api/sections' (@{ name = 'Evidence N11'; classId = 'fixture_cls_b_g01' } | ConvertTo-Json)

Section "N12a POST /api/students (student enrollment with foreign refs)"
$n12a = Req 'N12a' 'POST' '/api/students' (@{ firstName = 'Evidence'; lastName = 'N12'; admissionNumber = 'EVIDENCE-N12A'; academicYearId = 'fixture_ay_b'; classId = 'fixture_cls_b_g01'; sectionId = 'fixture_sec_b_g01_a' } | ConvertTo-Json)

$sid = ''
if ($n12a.raw -match '"id":"([^"]+)"') { $sid = $matches[1] }
Log "Captured student id: $sid"

Section "N12b PATCH /api/students/$sid (enrollment update with foreign refs)"
Req 'N12b' 'PATCH' "/api/students/$sid" (@{ academicYearId = 'fixture_ay_b'; classId = 'fixture_cls_b_g01'; sectionId = 'fixture_sec_b_g01_a'; rollNumber = '99' } | ConvertTo-Json)

Section "N13 PATCH /api/subjects/seed_sub_mat action=assign (assignment with foreign refs)"
Req 'N13' 'PATCH' '/api/subjects/seed_sub_mat' (@{ action = 'assign'; academicYearId = 'fixture_ay_b'; classId = 'fixture_cls_b_g01'; sectionId = 'fixture_sec_b_g01_a'; teacherMembershipId = 'seed_mem_admin' } | ConvertTo-Json)

Log ""
Log "DONE"
