type Job = {
  url: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  timestamp: number;
};

const KEY = "pw_offline_jobs";
const MAX_QUEUE_SIZE = 100;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const enqueue = (job: Omit<Job, "timestamp">) => {
  try {
    const q: Job[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    
    // Add timestamp
    const jobWithTimestamp: Job = { ...job, timestamp: Date.now() };
    
    // Add to queue
    q.push(jobWithTimestamp);
    
    // Trim old jobs
    const now = Date.now();
    const filtered = q
      .filter(j => now - j.timestamp < MAX_AGE_MS)
      .slice(-MAX_QUEUE_SIZE);
    
    localStorage.setItem(KEY, JSON.stringify(filtered));
    
    // Try to flush immediately if online
    if (navigator.onLine) {
      flush();
    }
  } catch (err) {
    console.error("[offlineQueue] Failed to enqueue:", err);
  }
};

export const flush = async () => {
  try {
    const q: Job[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (q.length === 0) return;
    
    const remaining: Job[] = [];
    let successCount = 0;
    
    for (const j of q) {
      try {
        const response = await fetch(j.url, {
          method: j.method || "POST",
          body: j.body ? JSON.stringify(j.body) : undefined,
          headers: {
            "content-type": "application/json",
            ...(j.headers || {}),
          },
        });
        
        if (response.ok) {
          successCount++;
        } else {
          remaining.push(j);
        }
      } catch {
        // Keep in queue if failed
        remaining.push(j);
      }
    }
    
    localStorage.setItem(KEY, JSON.stringify(remaining));
    
    if (successCount > 0) {
      console.log(`[offlineQueue] Flushed ${successCount} jobs, ${remaining.length} remaining`);
    }
  } catch (err) {
    console.error("[offlineQueue] Failed to flush:", err);
  }
};

export const getQueueSize = (): number => {
  try {
    const q: Job[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    return q.length;
  } catch {
    return 0;
  }
};

export const clearQueue = () => {
  localStorage.removeItem(KEY);
};

// Auto-flush when coming back online
window.addEventListener("online", flush);

// Periodic flush attempt every 5 minutes
setInterval(() => {
  if (navigator.onLine) {
    flush();
  }
}, 5 * 60 * 1000);
