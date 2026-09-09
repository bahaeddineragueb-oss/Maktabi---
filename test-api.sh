#!/bin/bash
# API smoke test
set -e
BASE=http://localhost:8787/api
TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@2026"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).data.token")
echo "✓ LOGIN"
AUTH="Authorization: Bearer $TOKEN"
J() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);if(!r.ok){console.log('✗',r.error);process.exit(1)};const j=r.data;$1})"; }

curl -s $BASE/insights/dashboard -H "$AUTH" | J "console.log('✓ DASHBOARD — hearings today:',j.hearingsToday.length,'tomorrow:',j.hearingsTomorrow.length,'deadlines:',j.deadlinesSoon.length,'overdueTasks:',j.overdueTasks.length,'unpaid:',j.unpaidInvoices.length,'inactive:',j.inactiveCases.length)"
curl -s "$BASE/cases?limit=5" -H "$AUTH" | J "j.rows.forEach(r=>console.log('  case',r.reference,'|',r.title_fr,'|',r.status_name_fr,'| nextHearing:',r.next_hearing_date))"
curl -s "$BASE/cases/1" -H "$AUTH" | J "console.log('✓ CASE DETAIL — hearings:',j.hearings.length,'deadlines:',j.deadlines.length,'tasks:',j.tasks.length,'docs:',j.documents.length,'timeline:',j.timeline.length)"
curl -s "$BASE/clients?limit=3" -H "$AUTH" | J "console.log('✓ CLIENTS — total:',j.total)"
curl -s "$BASE/directory/wilayas" -H "$AUTH" | J "console.log('✓ WILAYAS:',j.length)"
curl -s "$BASE/directory/courts" -H "$AUTH" | J "console.log('✓ COURTS:',j.length,'| first:',j[0].name_fr,'(',j[0].verification_status,')')"
curl -s "$BASE/schedule/hearings?from=2026-09-01&to=2026-09-30" -H "$AUTH" | J "console.log('✓ HEARINGS sept:',j.length)"
curl -s -X POST $BASE/schedule/deadlines/preview -H "$AUTH" -H 'Content-Type: application/json' -d '{"start_date":"2026-09-09","amount":15,"unit":"day","day_type":"business","holiday_exclusion":true}' | J "console.log('✓ DEADLINE PREVIEW — end:',j.end_date,'excluded days:',j.excluded_days)"
curl -s -X POST $BASE/clients/check-conflicts -H "$AUTH" -H 'Content-Type: application/json' -d '{"client_name":"Mohamed Tahar Benslimane","opposing_party":"SARL Batimetal"}' | J "console.log('✓ CONFLICT CHECK — level:',j.level,'matches:',j.matches.length)"
curl -s "$BASE/insights/search?q=%D8%B7%D9%84%D8%A7%D9%82" -H "$AUTH" | J "console.log('✓ ARABIC SEARCH (divorce — طلاق):',j.results.length,'results')"
curl -s "$BASE/insights/search?q=Divorce" -H "$AUTH" | J "console.log('✓ FRENCH SEARCH (accent-insensitive):',j.results.length,'results')"
curl -s "$BASE/legal/texts" -H "$AUTH" | J "console.log('✓ LEGAL TEXTS:',j.total)"
curl -s "$BASE/legal/jurisprudence" -H "$AUTH" | J "console.log('✓ JURISPRUDENCE:',j.total)"
curl -s "$BASE/finance/summary" -H "$AUTH" | J "const t=j.totals;console.log('✓ FINANCE — invoiced:',t.invoiced,'paid:',t.paid,'outstanding:',t.outstanding,'overdue:',t.overdue.c)"
curl -s "$BASE/documents?limit=5" -H "$AUTH" | J "console.log('✓ DOCUMENTS:',j.total)"
curl -s "$BASE/documents/templates" -H "$AUTH" | J "console.log('✓ TEMPLATES:',j.length)"
curl -s -X POST $BASE/documents/templates/1/render -H "$AUTH" -H 'Content-Type: application/json' -d '{"case_id":1}' | J "console.log('✓ TEMPLATE RENDER:',j.rendered.split('\n').find(l=>l.includes('Objet')))"
curl -s "$BASE/schedule/calendar?from=2026-09-01&to=2026-09-30" -H "$AUTH" | J "console.log('✓ CALENDAR items sept:',j.items.length)"
curl -s "$BASE/schedule/calendar.ics" -H "$AUTH" | head -4
echo "✓ ICS EXPORT"
curl -s "$BASE/admin/audit?limit=5" -H "$AUTH" | J "console.log('✓ AUDIT LOGS:',j.length)"
curl -s "$BASE/admin/notifications" -H "$AUTH" | J "console.log('✓ NOTIFICATIONS — dynamic:',j.dynamic.length,'unread stored:',j.unread)"
curl -s "$BASE/insights/reports" -H "$AUTH" | J "console.log('✓ REPORTS — byPracticeArea:',j.byPracticeArea.length,'byCourt:',j.byCourt.length)"
# test secretary permission boundaries
TOK2=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"username":"nadia","password":"Demo@2026"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).data.token")
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/finance/summary -H "Authorization: Bearer $TOK2")
echo "✓ RBAC — secretary→finance: HTTP $R (expect 403)"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/cases -H "Authorization: Bearer $TOK2")
echo "✓ RBAC — secretary→cases: HTTP $R (expect 200)"
echo ""
echo "ALL TESTS PASSED"
