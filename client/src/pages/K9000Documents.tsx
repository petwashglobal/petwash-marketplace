import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import {
  FileText,
  Download,
  Eye,
  Shield,
  Lock,
  Search,
  Filter,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileWarning,
  FolderOpen,
  FileCheck,
} from 'lucide-react';

interface Document {
  id: number;
  fileName: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  fileSize: number;
  mimeType: string;
  accessLevel: number;
  tags: string[];
  description?: string;
}

export default function K9000Documents() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  // Fetch document categories
  const { data: categoriesData } = useQuery<any>({
    queryKey: ['/api/documents/categories'],
  });

  // Fetch documents list
  const { data: documentsData, isLoading } = useQuery<{ documents: Document[] }>({
    queryKey: ['/api/documents', { search: searchQuery, category: categoryFilter !== 'all' ? categoryFilter : undefined }],
    refetchInterval: 30000,
  });

  // Fetch user access permissions
  const { data: accessData } = useQuery<any>({
    queryKey: ['/api/documents/access-summary'],
  });

  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: isHebrew ? 'הורדה הושלמה' : 'Download Complete',
        description: isHebrew ? `${doc.fileName} הורד בהצלחה` : `${doc.fileName} downloaded successfully`,
      });
    } catch (error) {
      toast({
        title: isHebrew ? 'שגיאה בהורדה' : 'Download Error',
        description: isHebrew ? 'נכשל להוריד מסמך' : 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const handleView = async (doc: Document) => {
    setSelectedDocument(doc);
    try {
      const response = await fetch(`/api/documents/${doc.id}/view`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('View failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: isHebrew ? 'שגיאה בצפייה' : 'View Error',
        description: isHebrew ? 'נכשל לפתוח מסמך' : 'Failed to open document',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'k9000_invoice':
        return <FileCheck className="w-5 h-5 text-green-600" />;
      case 'k9000_technical':
        return <FileWarning className="w-5 h-5 text-blue-600" />;
      case 'k9000_manual':
        return <FileText className="w-5 h-5 text-purple-600" />;
      case 'k9000_contract':
        return <Shield className="w-5 h-5 text-orange-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'k9000_invoice':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'k9000_technical':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'k9000_manual':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'k9000_contract':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const documents = documentsData?.documents || [];
  const categories = categoriesData?.categories || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white" data-testid="text-documents-title">
                {isHebrew ? 'מסמכי K9000' : 'K9000 Documents'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {isHebrew ? 'גישה מאובטחת למסמכים רגישים' : 'Secure access to sensitive documents'}
              </p>
            </div>
          </div>
        </div>

        {/* Access Summary */}
        {accessData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'מסמכים זמינים' : 'Available Documents'}
                    </p>
                    <p className="text-3xl font-bold text-blue-600" data-testid="text-available-docs">
                      {accessData.totalAccessible || 0}
                    </p>
                  </div>
                  <FolderOpen className="w-12 h-12 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-gray-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'רמת גישה' : 'Access Level'}
                    </p>
                    <p className="text-3xl font-bold text-green-600" data-testid="text-access-level">
                      L{accessData.userAccessLevel || 0}
                    </p>
                  </div>
                  <Shield className="w-12 h-12 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-gray-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'קטגוריות' : 'Categories'}
                    </p>
                    <p className="text-3xl font-bold text-purple-600" data-testid="text-categories">
                      {categories.length}
                    </p>
                  </div>
                  <Filter className="w-12 h-12 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              {isHebrew ? 'חיפוש וסינון' : 'Search & Filter'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  placeholder={isHebrew ? 'חפש מסמכים...' : 'Search documents...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-documents"
                  className="w-full"
                />
              </div>
              <div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger data-testid="select-category-filter">
                    <SelectValue placeholder={isHebrew ? 'כל הקטגוריות' : 'All Categories'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isHebrew ? 'כל הקטגוריות' : 'All Categories'}</SelectItem>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.code}>
                        {isHebrew ? cat.nameHe || cat.name : cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {isHebrew ? 'רשימת מסמכים' : 'Document List'}
            </CardTitle>
            <CardDescription>
              {isHebrew
                ? 'כל המסמכים מוצפנים ומוגנים עם יומני גישה מפורטים'
                : 'All documents are encrypted and protected with detailed access logs'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">{isHebrew ? 'טוען מסמכים...' : 'Loading documents...'}</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">{isHebrew ? 'לא נמצאו מסמכים' : 'No documents found'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    data-testid={`document-item-${doc.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {getCategoryIcon(doc.category)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{doc.fileName}</h3>
                          <Badge className={getCategoryColor(doc.category)} variant="outline">
                            {doc.category}
                          </Badge>
                          {doc.accessLevel >= 8 && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              {isHebrew ? 'סודי' : 'Confidential'}
                            </Badge>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{doc.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {doc.uploadedBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(doc.uploadedAt)}
                          </span>
                          <span>{formatFileSize(doc.fileSize)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleView(doc)}
                        data-testid={`button-view-${doc.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {isHebrew ? 'צפה' : 'View'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        data-testid={`button-download-${doc.id}`}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        {isHebrew ? 'הורד' : 'Download'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="mt-6 border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950 dark:to-gray-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  {isHebrew ? 'הודעת אבטחה' : 'Security Notice'}
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {isHebrew
                    ? 'כל הפעולות עם מסמכים רשומות ונשמרות ביומני גישה מפורטים. אנא הורד ושמור רק מסמכים הדרושים לך לעבודה.'
                    : 'All document actions are logged and recorded in detailed access logs. Please only download and save documents necessary for your work.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
