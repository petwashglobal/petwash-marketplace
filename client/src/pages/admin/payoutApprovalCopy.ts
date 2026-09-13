/** Hebrew copy for the provider payout approval queue (AdminPayoutApprovals). */
export const FINDING_HE: Record<string, string> = {
  SELF_BOOKING_SAME_ACCOUNT: "הספק הזמין מעצמו (אותו חשבון)",
  SELF_BOOKING_SAME_PHONE: "הספק והלקוח עם אותו מספר טלפון",
  OPEN_DISPUTE: "קיימת מחלוקת פתוחה",
  COMPLETED_BEFORE_START: "סומן כהושלם לפני מועד ההתחלה",
  COMPLETED_BEFORE_ACTUAL_START: "סיום לפני זמן ההתחלה שנרשם",
  NO_GPS_TRACK: "אין מסלול GPS להליכה",
  SPARSE_GPS_TRACK: "מעט מדי נקודות GPS",
  WALK_TOO_SHORT: "ההליכה קצרה מחצי מהזמן שהוזמן",
  WALK_SHORT: "ההליכה קצרה מהזמן שהוזמן",
  CHECK_IN_FAR_FROM_ADDRESS: "נקודת ההתחלה רחוקה מהכתובת (מעל ק״מ)",
  CHECK_IN_AWAY_FROM_ADDRESS: "נקודת ההתחלה רחוקה מהכתובת",
  CLAIMED_DISTANCE_INFLATED: "האפליקציה דיווחה מרחק גדול מה-GPS",
  CLAIMED_DURATION_INFLATED: "האפליקציה דיווחה זמן ארוך מה-GPS",
  IMPOSSIBLE_WALKING_SPEED: "מהירות של רכב בזמן ״הליכה״",
  PHOTO_OUTSIDE_JOB_WINDOW: "תמונות צולמו מחוץ לזמן העבודה",
  NO_CUSTOMER_CONFIRMATION: "הלקוח לא אישר את השירות",
};


export const VERDICT_HE = {
  clear: "נקי — הראיות תקינות",
  review: "לבדיקה — יש ממצאים",
  blocked: "חסום — הראיות אינן תומכות בתשלום",
  none: "אין רשומת עבודה לבדיקה",
} as const;
