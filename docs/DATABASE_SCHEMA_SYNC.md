# Pet Wash™ - Database Schema Management

**Schema Approach:** Drizzle Push (Schema-First)

---

## 📋 **How This Project Manages Database Schema**

This project uses **Drizzle's push command** instead of traditional migrations. The schema is **version-controlled in code** and pushed to the database.

### **Schema Location:**
- **Source of Truth:** `shared/schema.ts`
- **Sync Command:** `npm run db:push --force`

---

## 🔄 **How It Works**

1. **Schema is defined in code** (`shared/schema.ts`)
2. **Drizzle compares** code schema with database schema
3. **Generates SQL** to sync database to match code
4. **Applies changes** automatically

### **Example:**
When `lastLogin` was added to `customers` table:

**Code (shared/schema.ts):**
```typescript
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  lastLogin: timestamp("last_login"),  // ← New field added
  ...
});
```

**Command:**
```bash
npm run db:push --force
```

**Result:**
```sql
ALTER TABLE customers ADD COLUMN last_login TIMESTAMP;
```

---

## 🚀 **Setup Instructions for New Environments**

### **Development:**
```bash
# 1. Clone repository
git clone ...

# 2. Install dependencies
npm install

# 3. Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://..."

# 4. Sync schema to database
npm run db:push --force
```

### **Production/Staging:**
```bash
# Same steps - the schema is always synced from code
npm run db:push --force
```

---

## ✅ **Advantages of Push Approach**

1. **Single Source of Truth:** Schema definition in code (`shared/schema.ts`)
2. **Version Controlled:** Schema changes tracked in git
3. **No Migration Files:** Simpler, less files to maintain
4. **Auto-Generated SQL:** Drizzle handles all SQL generation
5. **Fast Development:** Quick iteration on schema changes

---

## ⚠️ **Important Rules**

### **DO:**
- ✅ Define all schema changes in `shared/schema.ts`
- ✅ Run `npm run db:push --force` after schema changes
- ✅ Commit `shared/schema.ts` changes to git
- ✅ Document breaking changes in PR/commit messages

### **DON'T:**
- ❌ Manually write SQL migrations
- ❌ Directly ALTER tables in database
- ❌ Change primary key types (serial ↔ varchar)
- ❌ Skip running `db:push` after schema changes

---

## 🔐 **Safety Notes**

**From System Reminder:**
> CRITICAL: NEVER change primary key ID column types - This breaks existing data and causes migration failures.

**Safe Patterns:**
```typescript
// If ID is already serial, keep it serial
id: serial("id").primaryKey()

// If ID is already UUID varchar, keep it varchar
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`)
```

**Workflow:**
1. Check current database schema
2. Match your Drizzle schema to existing structure
3. Run `npm run db:push --force` to sync safely

---

## 📊 **Schema Verification**

### **Check Current Database Schema:**
```bash
psql $DATABASE_URL -c "\d customers"
```

### **Check Schema in Code:**
```typescript
// shared/schema.ts
export const customers = pgTable("customers", { ... });
```

### **Verify Sync:**
```bash
npm run db:push --force
# Should show: "No schema changes detected" if already synced
```

---

## 🐛 **Recent Schema Fix: lastLogin Column**

**Issue:** `lastLogin` field defined in code but missing in database

**Root Cause:** Database not synced after schema definition added

**Fix:**
1. Schema was already in `shared/schema.ts`
2. Ran `npm run db:push --force`
3. Column added automatically

**Prevention:** Always run `db:push` after modifying schema

---

## 📝 **Schema Change Workflow**

1. **Edit Schema:**
```typescript
// shared/schema.ts
export const customers = pgTable("customers", {
  // ... existing fields
  newField: varchar("new_field"),  // Add new field
});
```

2. **Sync to Database:**
```bash
npm run db:push --force
```

3. **Verify:**
```bash
psql $DATABASE_URL -c "\d customers"
# Check that new_field exists
```

4. **Commit:**
```bash
git add shared/schema.ts
git commit -m "Add newField to customers table"
```

---

## 🎯 **Key Takeaway**

**This project does NOT use migration files.**  
The schema is in `shared/schema.ts` and synced via `npm run db:push --force`.

Any new environment must run this command to get the latest schema.

---

**Last Updated:** October 25, 2025  
**Schema Version:** Defined in `shared/schema.ts`  
**Sync Method:** Drizzle Push
