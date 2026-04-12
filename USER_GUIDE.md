# 📘 PipelinePulse - Complete Beginner's Guide

Welcome to **PipelinePulse**! This guide will walk you through everything you need to know to use the platform, even if you've never worked with data pipelines before.

---

## 🤔 What is PipelinePulse?

PipelinePulse is a **data pipeline monitoring and orchestration platform** that helps you:
- **Collect data** automatically from multiple sources (weather APIs, GitHub, mock e-commerce data)
- **Transform and clean** that data into useful analytics
- **Monitor everything** in real-time through a beautiful dashboard

Think of it as a "control center" for automated data workflows.

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Access the Dashboard
Open your browser and go to: **http://localhost:3000**

This is your main control panel where you can see everything happening in your data pipelines.

### Step 2: Access Airflow
Open another tab and go to: **http://localhost:8080**

**Login with:**
- Username: `admin`
- Password: `admin123`

This is where your data pipelines (called "DAGs") run automatically.

---

## 📊 Understanding the Dashboard (http://localhost:3000)

The dashboard has several sections:

### 🏠 **Home Page**
Shows an overview of:
- Pipeline status (how many are running, failed, or succeeded)
- Recent pipeline runs
- Real-time activity feed

### 🔄 **Pipelines Page** (`/pipelines`)
- View all your data pipelines
- Start/stop pipelines manually
- See when each pipeline last ran
- Check if pipelines are healthy

### 📦 **Data Sources Page** (`/sources`)
- See all the data sources you're collecting from
- Monitor connection health
- View data freshness

### ✅ **Data Quality Page** (`/quality`)
- See data quality scores
- Check for data anomalies
- View data validation tests

---

## 🔧 Understanding Your Data Pipelines

PipelinePulse comes with **3 pre-built data pipelines**:

### 1. 🌤️ **Weather Pipeline** (`weather_ingest_dag`)
**What it does:** Fetches current weather data from 5 major cities (London, New York, Tokyo, Sydney, Mumbai)

**Setup required:**
- Get a free API key from [OpenWeatherMap](https://openweathermap.org/api)
- Add it to Airflow (instructions below)

**Schedule:** Runs every 30 minutes

**Use case:** Real-time weather monitoring and historical weather analysis

---

### 2. 🛒 **Orders Pipeline** (`orders_ingest_dag`)
**What it does:** Generates mock e-commerce data (users and orders) for testing and demos

**Setup required:** None! Works out of the box

**Schedule:** Runs daily at midnight

**Use case:**
- Testing your analytics dashboard
- Learning how data pipelines work
- Simulating a real e-commerce business

**Data generated:**
- 200 users from different countries (US, UK, India, Germany, Brazil)
- 500 orders with varying amounts and statuses
- Realistic subscription plans (free, pro, enterprise)

---

### 3. 💻 **GitHub Pipeline** (`github_ingest_dag`)
**What it does:** Fetches recent commit activity from any GitHub repository

**Setup required (optional):**
- Add your GitHub personal access token for higher API limits
- Specify which repository to track (defaults to `apache/airflow`)

**Schedule:** Runs every hour

**Use case:**
- Monitor development team activity
- Track commit frequency
- Analyze code contribution patterns

---

## 🎯 How to Use PipelinePulse (Step-by-Step)

### **Scenario 1: I want to monitor weather data**

1. **Get an API key** from OpenWeatherMap (free account)
2. **Add the API key to Airflow:**
   - Go to http://localhost:8080
   - Click **Admin** → **Variables**
   - Click the **+** button
   - Key: `OPENWEATHER_API_KEY`
   - Value: `your-api-key-here`
   - Click **Save**

3. **Enable the pipeline:**
   - Go to **DAGs** page
   - Find `weather_ingest_dag`
   - Toggle the switch to **ON** (it will turn blue/green)

4. **Trigger it manually (optional):**
   - Click on the DAG name
   - Click the **Play** button (▶️) at the top right
   - Select "Trigger DAG"

5. **Watch it run:**
   - You'll see colored boxes appear (tasks)
   - Green = success, Red = failed, Yellow = running
   - Wait about 1-2 minutes

6. **View your data:**
   - Go back to http://localhost:3000
   - Navigate to the **Data Sources** page
   - You should see weather data appearing!

---

### **Scenario 2: I want to generate demo e-commerce data**

1. **Enable the orders pipeline:**
   - Go to http://localhost:8080
   - Find `orders_ingest_dag`
   - Toggle it **ON**

2. **Run it immediately:**
   - Click on the DAG name
   - Click **Trigger DAG** (▶️ button)

3. **What happens:**
   - 200 fake users are created
   - 500 fake orders are generated
   - Data is stored in your database

4. **View the data:**
   - Option A: Check the dashboard at http://localhost:3000
   - Option B: Use a database tool to connect to PostgreSQL:
     - Host: `localhost`
     - Port: `5432`
     - Database: `pipelinepulse`
     - Username: `pp_user`
     - Password: `pipelinepulse123`

5. **Run transformations:**
   ```bash
   docker compose run --rm dbt-runner run
   ```
   This cleans and aggregates your raw data into analytics-ready tables.

---

### **Scenario 3: I want to track GitHub activity**

1. **(Optional) Get a GitHub token:**
   - Go to GitHub.com → Settings → Developer Settings → Personal Access Tokens
   - Generate a token with `repo` access
   - Copy the token

2. **Configure the pipeline:**
   - Go to http://localhost:8080 → Admin → Variables
   - Add `GITHUB_TOKEN`: `your-token-here` (optional, for higher limits)
   - Add `GITHUB_REPO`: `owner/repo-name` (e.g., `facebook/react`)

3. **Enable and run:**
   - Toggle `github_ingest_dag` to ON
   - Trigger it manually to test

4. **Monitor commits:**
   - The pipeline will fetch the last 24 hours of commits
   - Data appears in your dashboard

---

## 🏗️ Understanding the Data Architecture

PipelinePulse uses a **Medallion Architecture** (Bronze → Silver → Gold):

```
┌─────────────┐
│   SOURCES   │  Weather API, GitHub API, Generated Data
└──────┬──────┘
       ↓
┌─────────────┐
│   BRONZE    │  Raw data (exactly as received from sources)
│  (Raw Data) │  Tables: raw_weather, raw_commits, raw_users, raw_orders
└──────┬──────┘
       ↓
┌─────────────┐
│   SILVER    │  Cleaned & standardized data (dbt transformations)
│  (Cleaned)  │  Tables: stg_weather, stg_orders, etc.
└──────┬──────┘
       ↓
┌─────────────┐
│    GOLD     │  Analytics-ready aggregations
│ (Analytics) │  Tables: fact_sales, dim_users, weather_summary
└─────────────┘
```

### How data flows:

1. **Airflow DAGs** pull data from sources → Bronze layer
2. **dbt models** transform Bronze → Silver → Gold
3. **FastAPI backend** reads from Gold layer
4. **Dashboard** displays analytics in real-time

---

## 🛠️ Common Tasks

### ✅ Enable/Disable a Pipeline
1. Go to Airflow (http://localhost:8080)
2. Find your DAG in the list
3. Toggle the switch on the left

### ✅ Run a Pipeline Manually
1. Go to Airflow
2. Click on the DAG name
3. Click the **Play** button (▶️)
4. Click "Trigger DAG"

### ✅ View Pipeline Logs
1. Click on the DAG name
2. Click on a task (colored box)
3. Click "Log" button
4. Read what happened during execution

### ✅ Check if Data was Collected
1. Go to Airflow
2. Click on the DAG
3. Look at the **Graph** view
4. Green tasks = data was collected successfully

### ✅ Run Data Transformations (dbt)
```bash
# Clean and transform all data
docker compose run --rm dbt-runner run

# Run data quality tests
docker compose run --rm dbt-runner test

# Check dbt documentation
docker compose run --rm dbt-runner docs generate
```

### ✅ View Real-time Logs in Dashboard
1. Go to http://localhost:3000
2. Watch the activity feed for real-time updates
3. Pipeline events appear automatically (via WebSockets)

---

## 🔍 Exploring the API (Advanced)

Visit **http://localhost:8000/docs** to see:
- All available API endpoints
- Try out API calls directly in your browser
- View request/response formats

**Popular endpoints:**
- `/health` - Check if the backend is running
- `/api/pipelines` - List all pipelines
- `/api/pipelines/{id}/runs` - Get pipeline execution history
- `/ws` - WebSocket for real-time updates

---

## 📈 Sample Workflows

### **Workflow A: Daily Analytics Review**
1. Check the dashboard (http://localhost:3000)
2. Review pipeline health on the **Pipelines** page
3. Check data quality scores on the **Quality** page
4. Review any failed pipelines in Airflow
5. Fix issues and re-run failed pipelines

### **Workflow B: Adding a New Data Source**
1. Create a new DAG file in `airflow/dags/`
2. Define what data to fetch and how
3. Store raw data in a Bronze table
4. Create dbt models to transform the data
5. Add visualizations to the dashboard

### **Workflow C: Weekly Data Quality Check**
```bash
# Run all dbt tests
docker compose run --rm dbt-runner test

# Review failed tests in the output
# Fix data quality issues
# Re-run transformations
docker compose run --rm dbt-runner run
```

---

## 🐛 Troubleshooting

### Pipeline shows as "failed" (red)
1. Click on the pipeline in Airflow
2. Click the failed task (red box)
3. Click "Log"
4. Look for the error message
5. Common fixes:
   - Missing API key → Add it in Variables
   - API rate limit → Wait or add authentication token
   - Database connection → Check if Postgres is running

### Dashboard shows no data
1. Ensure pipelines have run at least once
2. Check Airflow to see if DAGs are enabled
3. Trigger a pipeline manually
4. Wait 1-2 minutes for completion
5. Refresh the dashboard

### Can't access http://localhost:8080
1. Check if containers are running: `docker compose ps`
2. Check Airflow logs: `docker compose logs airflow-webserver`
3. Wait 1-2 minutes (Airflow takes time to start)
4. Restart if needed: `docker compose restart airflow-webserver`

### WebSocket connection lost
1. Check if backend is running: `docker compose ps backend`
2. Refresh the dashboard page
3. Check backend logs: `docker compose logs backend`

---

## 📚 Next Steps

Once you're comfortable with the basics:

1. **Learn dbt:** Modify transformations in the `dbt/models/` folder
2. **Customize the Dashboard:** Edit React components in `frontend/app/`
3. **Add New Pipelines:** Create new DAG files in `airflow/dags/`
4. **Connect Real Data Sources:** Replace mock data with your actual APIs
5. **Deploy to Production:** Use the included Kubernetes configs

---

## 🎓 Learning Resources

- **Airflow Docs:** https://airflow.apache.org/docs/
- **dbt Docs:** https://docs.getdbt.com/
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Next.js Docs:** https://nextjs.org/docs

---

## 💡 Pro Tips

1. **Start Simple:** Begin with the Orders pipeline (no setup needed)
2. **Check Logs Often:** Logs tell you exactly what's happening
3. **Use Variables:** Store API keys in Airflow Variables, not in code
4. **Monitor Schedules:** DAGs run automatically on their schedule
5. **Test Before Production:** Always test manually before relying on schedules

---

## 🆘 Need Help?

- Check the logs: `docker compose logs [service-name]`
- View all running services: `docker compose ps`
- Restart everything: `bash start.sh`
- Stop everything: `docker compose down`

---

**Happy Data Pipeline Building! 🚀**
