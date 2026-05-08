import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { onClickBecomeProvider } from "@/lib/becomeProvider";
import { Clock, CheckCircle, XCircle, RefreshCw, Upload, FileCheck, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

const isHebrew = () => {
  try {
    return localStorage.getItem("i18nextLng")?.startsWith("he") ?? true;
  } catch {
    return true;
  }
};

interface ApplicationData {
  id: number;
  stage: string;
  status: string;
  membershipNumber?: string;
  documents: Array<{
    id: number;
    documentType: string;
    fileName?: string;
    verificationStatus: string;
    uploadedAt?: string;
  }>;
  tasks: Array<{
    id: number;
    taskKey: string;
    taskName: string;
    taskNameHe?: string;
    stage: string;
    status: string;
    isRequired: boolean;
  }>;
  requiredDocuments: string[];
}

const DOC_LABELS: Record<string, { en: string; he: string }> = {
  national_id: { en: "National ID (Teudat Zehut)", he: "תעודת זהות" },
  drivers_license: { en: "Driver's License", he: "רישיון נהיגה" },
  criminal_background: { en: "Police Clearance Certificate", he: "אישור משטרה (ללא עבר פלילי)" },
  pet_first_aid_cert: { en: "Pet First Aid Certificate", he: "תעודת עזרה ראשונה לחיות" },
  grooming_cert: { en: "Grooming Certification", he: "תעודת טיפוח" },
  veterinary_cert: { en: "Veterinary License", he: "רישיון וטרינרי" },
  insurance_policy: { en: "Insurance Policy", he: "פוליסת ביטוח" },
  vehicle_registration: { en: "Vehicle Registration", he: "רישיון רכב" },
  vehicle_insurance: { en: "Vehicle Insurance", he: "ביטוח רכב" },
  home_photos: { en: "Home / Premises Photos", he: "תמונות הבית / המתקן" },
  tax_registration: { en: "Business / Tax Registration", he: "רישום עסק / מס" },
  bank_details: { en: "Bank Account Details", he: "פרטי חשבון בנק" },
  references: { en: "Professional References", he: "המלצות מקצועיות" },
};

const STAGE_ORDER = [
  "application_submitted",
  "documents_pending",
  "documents_under_review",
  "background_check_pending",
  "interview_scheduled",
  "approved",
  "rejected",
];

export default function ProviderPending() {
  const [, setLocation] = useLocation();
  const he = isHebrew();
  const { user } = useFirebaseAuth();
  const { toast } = useToast();
  const [appData, setAppData] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchApplication = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/provider-applications/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAppData(data);
        if (data.status === "approved" || data.stage === "approved") {
          setLocation("/provider/dashboard");
        }
      } else if (res.status === 404) {
        setLocation("/become-provider");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const token = await user.getIdToken(true);
      const decodedToken = await user.getIdTokenResult(true);
      const claims = decodedToken.claims as any;
      if (claims?.role === "provider" || claims?.accountType === "provider") {
        setLocation("/provider/dashboard");
        return;
      }
      await fetchApplication();
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (user) fetchApplication();
  }, [user]);

  const handleFileUpload = async (documentType: string, file: File) => {
    if (!user) return;
    setUploading(documentType);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);
      const res = await fetch("/api/provider-applications/my/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: he ? "המסמך הועלה בהצלחה" : "Document Uploaded",
          description: data.allDocumentsUploaded
            ? (he ? "כל המסמכים הועלו! הבקשה שלך עוברת לבדיקה." : "All documents uploaded! Your application is now under review.")
            : (he ? `${DOC_LABELS[documentType]?.he || documentType} הועלה.` : `${DOC_LABELS[documentType]?.en || documentType} uploaded.`),
        });
        await fetchApplication();
      } else {
        toast({
          title: he ? "שגיאה בהעלאה" : "Upload Failed",
          description: data.message || (he ? "נסה שוב" : "Please try again"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: he ? "שגיאה" : "Error",
        description: he ? "בעיית רשת, נסה שוב" : "Network error, please try again",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!appData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <Card className="max-w-md w-full mx-auto bg-white">
          <CardContent className="text-center py-8 space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
            <p className="text-muted-foreground text-sm">
              {he ? "לא נמצאה בקשה. אנא מלא את טופס ההרשמה." : "No application found. Please complete the registration form."}
            </p>
            <Button onClick={() => onClickBecomeProvider(setLocation)} className="w-full">
              {he ? "הגש בקשה" : "Apply Now"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (appData.status === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <Card className="max-w-md w-full mx-auto bg-white">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-xl">{he ? "הבקשה לא אושרה" : "Application Not Approved"}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {he
                ? "לצערנו בקשתך לא אושרה בשלב זה. ניתן לפנות לתמיכה לקבלת פרטים נוספים."
                : "Unfortunately your application was not approved at this time. Please contact support for more information."}
            </p>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
              {he ? "חזרה לדף הבית" : "Back to Home"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stageIndex = STAGE_ORDER.indexOf(appData.stage);
  const isDocumentsPending = appData.stage === "documents_pending";
  const uploadedTypes = new Set(
    appData.documents
      .filter(d => d.verificationStatus !== "rejected")
      .map(d => d.documentType)
  );
  const requiredDocs = appData.requiredDocuments || [];
  const pendingDocs = requiredDocs.filter(dt => !uploadedTypes.has(dt));
  const allDocsUploaded = pendingDocs.length === 0;

  return (
    <div className="min-h-screen bg-white py-8 px-4" dir={he ? "rtl" : "ltr"}>
      <div className="max-w-lg mx-auto space-y-4">

        {/* Status Card */}
        <Card className="bg-white">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isDocumentsPending && !allDocsUploaded ? "bg-amber-50" : "bg-green-50"
              }`}>
                {isDocumentsPending && !allDocsUploaded
                  ? <AlertCircle className="w-8 h-8 text-amber-500" />
                  : <CheckCircle className="w-8 h-8 text-green-500" />
                }
              </div>
            </div>
            <CardTitle className="text-xl">
              {isDocumentsPending && !allDocsUploaded
                ? (he ? "נדרשים מסמכים נוספים" : "Documents Required")
                : (he ? "הבקשה התקבלה ✓" : "Application Received ✓")
              }
            </CardTitle>
            {appData.membershipNumber && (
              <p className="text-xs text-muted-foreground mt-1">
                {he ? "מספר בקשה:" : "Application #:"} <span className="font-mono font-medium">{appData.membershipNumber}</span>
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isDocumentsPending && !allDocsUploaded ? (
              <p className="text-muted-foreground text-sm text-center leading-relaxed">
                {he
                  ? "יש להעלות את המסמכים הנדרשים להשלמת תהליך הרשמה."
                  : "Please upload the required documents below to complete your registration."}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                  <Clock className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      {he ? "זמן בדיקה משוער: עד 24 שעות עסקיות" : "Estimated review time: up to 24 business hours"}
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {he ? "בדרך כלל מהר יותר" : "Usually faster"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-900">
                    {he
                      ? "תקבל הודעת אימייל ו-SMS ברגע שהבקשה תאושר"
                      : "You will receive an email and SMS the moment your application is approved"}
                  </p>
                </div>
              </div>
            )}

            {/* Progress steps */}
            <div className="py-1">
              <div className="flex items-center justify-between mb-2">
                {["documents_pending", "documents_under_review", "background_check_pending", "approved"].map((stage, i) => {
                  const active = stageIndex >= STAGE_ORDER.indexOf(stage);
                  const labels = {
                    he: ["מסמכים", "בדיקה", "רקע", "אושר"],
                    en: ["Docs", "Review", "Background", "Approved"],
                  };
                  return (
                    <div key={stage} className="flex flex-col items-center gap-1 flex-1">
                      <div className={`w-3 h-3 rounded-full ${active ? "bg-amber-500" : "bg-white"}`} />
                      <span className={`text-xs ${active ? "text-amber-700 font-medium" : "text-gray-400"}`}>
                        {he ? labels.he[i] : labels.en[i]}
                      </span>
                      {i < 3 && (
                        <div className="absolute" style={{ display: "none" }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 justify-center">
                {["documents_pending", "documents_under_review", "background_check_pending", "approved"].map((stage, i) => (
                  <div key={stage} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${stageIndex >= STAGE_ORDER.indexOf(stage) ? "bg-amber-500" : "bg-white"}`} />
                    {i < 3 && <div className={`w-8 h-0.5 ${stageIndex > STAGE_ORDER.indexOf(stage) ? "bg-amber-500" : "bg-white"}`} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-sm" onClick={checkStatus} disabled={checking}>
                {checking
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
                <span className={he ? "mr-2" : "ml-2"}>{he ? "רענן סטטוס" : "Refresh Status"}</span>
              </Button>
              <Button variant="ghost" className="flex-1 text-sm text-muted-foreground" onClick={() => setLocation("/")}>
                {he ? "דף הבית" : "Home"}
              </Button>
            </div>

            {/* Support contact — prominent */}
            <div className="border-t pt-3 text-center space-y-1">
              <p className="text-sm font-medium text-gray-700">
                {he ? "יש שאלות?" : "Have questions?"}
              </p>
              <a
                href="mailto:support@petwash.co.il"
                className="text-sm text-amber-600 font-medium underline underline-offset-2"
              >
                support@petwash.co.il
              </a>
              <p className="text-xs text-muted-foreground">
                {he ? "נענה תוך שעה בשעות פעילות" : "We reply within 1 hour during business hours"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Document Upload Section */}
        {requiredDocs.length > 0 && (
          <Card className="bg-white">
            <CardHeader
              className="pb-2 cursor-pointer"
              onClick={() => setExpandedDocs(!expandedDocs)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-amber-600" />
                  {he ? "מסמכים נדרשים" : "Required Documents"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={allDocsUploaded ? "default" : "secondary"} className={allDocsUploaded ? "bg-green-500" : ""}>
                    {uploadedTypes.size}/{requiredDocs.length}
                  </Badge>
                  {expandedDocs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </CardHeader>

            {expandedDocs && (
              <CardContent className="space-y-3 pt-0">
                <p className="text-xs text-muted-foreground">
                  {he
                    ? "העלה תמונות ברורות או קובצי PDF של המסמכים. גודל מקסימלי: 10MB."
                    : "Upload clear photos or PDF files of your documents. Max size: 10MB."}
                </p>
                {requiredDocs.map(docType => {
                  const label = DOC_LABELS[docType] || { en: docType, he: docType };
                  const uploaded = uploadedTypes.has(docType);
                  const uploadedDoc = appData.documents.find(d => d.documentType === docType);
                  const isUploading = uploading === docType;

                  return (
                    <div
                      key={docType}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        uploaded ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        uploaded ? "bg-green-100" : "bg-white border border-gray-200"
                      }`}>
                        {uploaded
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <Upload className="w-4 h-4 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${uploaded ? "text-green-800" : "text-gray-800"}`}>
                          {he ? label.he : label.en}
                        </p>
                        {uploaded && uploadedDoc?.fileName && (
                          <p className="text-xs text-green-600 truncate">{uploadedDoc.fileName}</p>
                        )}
                        {!uploaded && (
                          <p className="text-xs text-gray-500">
                            {he ? "נדרש • תמונה או PDF" : "Required • Image or PDF"}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <input
                          ref={el => { fileInputRefs.current[docType] = el; }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(docType, file);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          size="sm"
                          variant={uploaded ? "outline" : "default"}
                          className={`text-xs ${uploaded ? "border-green-300 text-green-700" : "bg-amber-600 hover:bg-amber-700 text-white"}`}
                          disabled={isUploading || (!!uploading && !isUploading)}
                          onClick={() => fileInputRefs.current[docType]?.click()}
                        >
                          {isUploading
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : uploaded
                              ? (he ? "החלף" : "Replace")
                              : (he ? "העלה" : "Upload")
                          }
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {allDocsUploaded && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-800 font-medium">
                      {he ? "כל המסמכים הועלו. הצוות שלנו יבדוק אותם תוך 48 שעות." : "All documents uploaded. Our team will review them within 48 hours."}
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

      </div>
    </div>
  );
}
