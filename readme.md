git clone <repository-url>
cd insurance-system
npm install

# Create database indexes for optimal performance
npm run create-indexes

# POST /api/v1/upload

Upload CSV/XLSX files for bulk processing
Supports up to 50MB files
Processes data in background using worker threads
Policy Search

# GET /api/v1/policies/search?username=John&page=1&limit=10

Search policies by username (case-insensitive partial match)
Paginated results
Returns populated policy data
Policy Aggregation

# GET /api/v1/policies/aggregated?page=1&limit=10

Get policies aggregated by user
Includes total policies, premiums, and active policy counts
Paginated results
Message Scheduling

# POST /api/v1/schedule-message
{
  "message": "Policy renewal reminder",
  "day": 1,
  "time": "14:30",
  "createdBy": "admin"
}

# Sample env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/insurance_db
CPU_THRESHOLD=70
UPLOAD_LIMIT=50mb
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100