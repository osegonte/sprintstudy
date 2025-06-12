#!/bin/bash

API_URL="https://sprintstudy-production.up.railway.app"

echo "🧪 Testing SprintStudy API v2.0..."

# Test health endpoint
echo "🔍 Testing health endpoint..."
curl -s "$API_URL/health" | jq .

echo ""
echo "🎯 Testing new features requires authentication."
echo "💡 Use your JWT token from login to test protected endpoints:"
echo ""
echo "# Test sprint generation:"
echo "curl -X POST $API_URL/api/sprints/generate \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"document_id\": \"YOUR_DOC_ID\"}'"
echo ""
echo "# Test dashboard analytics:"
echo "curl $API_URL/api/analytics/dashboard \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\""
echo ""
echo "# Test real-time feedback:"
echo "curl -X POST $API_URL/api/progress/feedback \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"current_page_time\": 120, \"document_id\": \"YOUR_DOC_ID\"}'"
