# 🗄️ Production Database Reset Guide
**Date**: November 16, 2025  
**Purpose**: Clear production database before new deployment

---

## ✅ **Database Status**

**Current Situation:**
- ✅ DNS points to Google Cloud Platform (34.111.179.208)
- ✅ Server: Google Frontend
- ✅ SSL verified and working
- ✅ www → non-www redirect working (301)
- ⚠️ Homepage returns 500 error (old database schema conflict)
- ✅ API endpoints work (`/api/packages` returns JSON correctly)

**Database Connection:**
- Provider: Neon PostgreSQL (AWS us-east-2)
- Environment: Development & Production share same DATABASE_URL
- Status: Connected and active

---

## 🎯 **How to Reset Production Database**

### **Option 1: Using Replit Database Tool (Recommended)**

1. **Open Database Tool:**
   - In Replit workspace, click **"Database"** icon in left sidebar
   - Or click **"Tools"** → **"Database"**

2. **Navigate to Settings:**
   - Click **"Settings"** tab at the top
   - Scroll down to find **"Remove database"** section

3. **Remove Existing Database:**
   - Click **"Remove database"** button
   - ⚠️ **WARNING**: This is **irreversible** - all data will be deleted
   - Type confirmation text if prompted
   - Wait for deletion to complete

4. **Create Fresh Database:**
   - After deletion, Replit will show "No database" message
   - Click **"Create database"** button
   - Select **PostgreSQL** as database type
   - Wait for provisioning (usually 30-60 seconds)
   - New DATABASE_URL will be automatically set

5. **Run Database Migrations:**
   ```bash
   npm run db:push
   ```

---

### **Option 2: Drop All Tables via SQL (Manual)**

If you prefer to keep the database instance but clear all data:

1. **Connect to Database:**
   - Open Replit Database tool
   - Click **"SQL Runner"** tab

2. **List All Tables:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE';
   ```

3. **Drop All Tables:**
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO neondb_owner;
   GRANT ALL ON SCHEMA public TO public;
   ```

4. **Run Database Migrations:**
   ```bash
   npm run db:push
   ```

---

### **Option 3: Using Drizzle Push (Force Reset)**

This method safely syncs your schema to match production:

1. **Backup Important Data (Optional):**
   ```bash
   # Export current data if needed
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

2. **Force Schema Sync:**
   ```bash
   npm run db:push -- --force
   ```

   This will:
   - ✅ Drop all mismatched tables
   - ✅ Create new tables matching `shared/schema.ts`
   - ✅ Apply all necessary migrations
   - ✅ Preserve data where possible

3. **Verify Tables Created:**
   ```bash
   # Check tables exist
   psql $DATABASE_URL -c "\dt"
   ```

---

## 🚨 **Important Notes Before Reset**

### **What Will Be Deleted:**

- ✅ All user accounts (Firebase Auth users will remain, but database records deleted)
- ✅ All bookings and transactions
- ✅ All loyalty points and credits
- ✅ All messages and conversations
- ✅ All station data and IoT records
- ✅ All KYC documents (Google Cloud Storage files remain, but database references deleted)
- ✅ All admin logs and audit trails

### **What Will NOT Be Deleted:**

- ✅ Firebase Authentication users (stored in Firebase, not Postgres)
- ✅ Biometric documents in Google Cloud Storage
- ✅ Email backups
- ✅ Code repository
- ✅ Environment variables

---

## ✅ **Post-Reset Checklist**

After database reset, you must:

1. **Run Database Migrations:**
   ```bash
   npm run db:push
   ```

2. **Verify Tables Created:**
   - Open Database tool → SQL Runner
   - Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
   - Should see all tables from `shared/schema.ts`

3. **Seed Initial Data:**
   ```bash
   # Run seed script if you have one
   npm run db:seed
   
   # Or manually insert critical data via SQL Runner
   ```

4. **Restart Application:**
   ```bash
   # Application will auto-restart after db:push
   # Or manually restart the workflow
   ```

5. **Test Core Features:**
   - [ ] Visit https://petwash.co.il
   - [ ] Homepage loads without 500 error
   - [ ] Sign up with new account
   - [ ] Test booking flow
   - [ ] Check API endpoints

---

## 🔧 **Complete Reset Process (Step-by-Step)**

Here's the **recommended complete reset workflow**:

```bash
# Step 1: Stop the application (if running)
# (Workflow will auto-stop when you reset database)

# Step 2: Backup current database (optional)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Step 3: Reset database via Replit UI
# - Open Database tool
# - Settings tab
# - "Remove database" button
# - Confirm deletion

# Step 4: Create fresh database
# - Click "Create database"
# - Select PostgreSQL
# - Wait for provisioning

# Step 5: Push schema to new database
npm run db:push

# Step 6: Seed initial data (if needed)
# Insert wash packages, default settings, etc.

# Step 7: Verify application starts
# Workflow should auto-restart

# Step 8: Test production deployment
curl https://petwash.co.il/
curl https://petwash.co.il/api/packages
```

---

## 📊 **Verify Clean Database**

After reset, verify everything is fresh:

### **Check Table Count:**
```sql
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
```

### **Check Row Counts:**
```sql
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

All tables should show `0` rows (except seed data).

### **Check Schema Version:**
```sql
SELECT * FROM drizzle.__drizzle_migrations;
```

Should show only recent migration(s) after reset.

---

## 🚀 **After Database Reset - Deploy Steps**

1. **Verify Local App Works:**
   ```bash
   # Should see homepage without errors
   curl http://localhost:5000/
   ```

2. **Build Production Bundle:**
   ```bash
   npm run build
   ```

3. **Deploy to Production:**
   - Click **"Publish"** button in Replit
   - Or use Deployments tab
   - Wait for deployment to complete

4. **Test Production:**
   ```bash
   # Should now return 200 OK (not 500)
   curl -I https://petwash.co.il/
   
   # Should show homepage HTML
   curl https://petwash.co.il/
   
   # Should return JSON packages
   curl https://petwash.co.il/api/packages
   ```

---

## 🎯 **Expected Results After Reset**

**Before Reset:**
- ❌ Homepage: 500 Internal Server Error
- ❌ Database: Old schema with conflicts
- ❌ Cannot deploy new code safely

**After Reset:**
- ✅ Homepage: 200 OK with full content
- ✅ Database: Fresh schema matching `shared/schema.ts`
- ✅ Can deploy new code safely
- ✅ All API endpoints work correctly

---

## 📞 **If Something Goes Wrong**

### **Issue 1: Database won't delete**

**Solution:**
- Close all database connections
- Stop the application workflow
- Wait 30 seconds
- Try removing database again

### **Issue 2: New database won't provision**

**Solution:**
- Refresh the page
- Check Replit status page
- Try creating database again after 5 minutes
- Contact Replit support if persists

### **Issue 3: `npm run db:push` fails**

**Error:** "Cannot connect to database"

**Solution:**
```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL

# Try force push
npm run db:push -- --force

# Check logs for specific error
```

### **Issue 4: Tables not created**

**Solution:**
```bash
# Check schema file is valid
cat shared/schema.ts

# Manually run Drizzle generate
npx drizzle-kit generate

# Push again
npm run db:push
```

---

## ⚠️ **Safety Reminder**

**This will delete ALL production data!**

Before proceeding:
- [ ] Confirm you want to start fresh
- [ ] Backup any critical data you need
- [ ] Understand all users will need to re-register
- [ ] Understand all bookings will be lost
- [ ] Verify backup was successful (if you made one)

**Only proceed when you're 100% certain!**

---

## ✅ **Summary**

**Recommended Path:**
1. Replit Database Tool → Settings → Remove database
2. Create new PostgreSQL database
3. Run `npm run db:push`
4. Restart application
5. Build and deploy to production
6. Test https://petwash.co.il/

**Result:**
- Clean database with correct schema
- No more 500 errors
- Ready for production use
- Fresh start for all users

---

**Last Updated**: November 16, 2025  
**Status**: Ready to execute when user confirms
