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
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-8">
      <div className="luxury-container">
        {/* Header */}
        <div className="mb-8 luxury-animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl luxury-shadow-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="luxury-heading-xl luxury-animate-slide-up luxury-delay-1" data-testid="text-documents-title">
                {isHebrew ? 'מסמכי K9000' : 'K9000 Documents'}
              </h1>
              <p className="luxury-text-body luxury-animate-slide-up luxury-delay-2">
                {isHebrew ? 'גישה מאובטחת למסמכים רגישים' : 'Secure access to sensitive documents'}
              </p>
            </div>
          </div>
        </div>

        {/* Access Summary */}
        {accessData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="luxury-glass-card luxury-shadow-lg pt-6 luxury-animate-scale-in luxury-delay-3">
              <div className="flex items-center justify-between px-6 pb-6">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'מסמכים זמינים' : 'Available Documents'}
                  </p>
                  <p className="luxury-heading-lg luxury-text-gradient" data-testid="text-available-docs">
                    {accessData.totalAccessible || 0}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                  <FolderOpen className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg pt-6 luxury-animate-scale-in luxury-delay-4">
              <div className="flex items-center justify-between px-6 pb-6">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'רמת גישה' : 'Access Level'}
                  </p>
                  <p className="luxury-heading-lg luxury-text-gradient" data-testid="text-access-level">
                    L{accessData.userAccessLevel || 0}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                  <Shield className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            <div className="luxury-glass-card luxury-shadow-lg pt-6 luxury-animate-scale-in luxury-delay-5">
              <div className="flex items-center justify-between px-6 pb-6">
                <div>
                  <p className="luxury-text-small">
                    {isHebrew ? 'קטגוריות' : 'Categories'}
                  </p>
                  <p className="luxury-heading-lg luxury-text-gradient" data-testid="text-categories">
                    {categories.length}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Filter className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 luxury-glass-card luxury-hover-glow luxury-shadow-xl luxury-animate-fade-in luxury-delay-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="luxury-heading-md flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                <Search className="w-5 h-5 text-white" />
              </div>
              {isHebrew ? 'חיפוש וסינון' : 'Search & Filter'}
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  placeholder={isHebrew ? 'חפש מסמכים...' : 'Search documents...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-documents"
                  className="w-full luxury-glass-minimal"
                />
              </div>
              <div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger data-testid="select-category-filter" className="luxury-glass-minimal">
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
          </div>
        </div>

        {/* Documents List */}
        <div className="luxury-glass-card luxury-shadow-xl luxury-animate-fade-in luxury-delay-7">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="luxury-heading-md flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              {isHebrew ? 'רשימת מסמכים' : 'Document List'}
            </h3>
            <p className="luxury-text-small mt-2">
              {isHebrew
                ? 'כל המסמכים מוצפנים ומוגנים עם יומני גישה מפורטים'
                : 'All documents are encrypted and protected with detailed access logs'}
            </p>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="luxury-spinner w-12 h-12 mx-auto"></div>
                <p className="mt-4 luxury-text-body">{isHebrew ? 'טוען מסמכים...' : 'Loading documents...'}</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-2xl inline-block mb-4">
                  <FolderOpen className="w-16 h-16 text-gray-500 dark:text-gray-400" />
                </div>
                <p className="luxury-text-body">{isHebrew ? 'לא נמצאו מסמכים' : 'No documents found'}</p>
              </div>
            ) : (
              <div className="luxury-grid-3">
                {documents.map((doc, index) => (
                  <div
                    key={doc.id}
                    className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-6 luxury-animate-scale-in"
                    style={{ animationDelay: `${(index % 9) * 50}ms` }}
                    data-testid={`document-item-${doc.id}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                        {getCategoryIcon(doc.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="luxury-heading-sm line-clamp-1">{doc.fileName}</h3>
                        <span className="luxury-badge text-xs mt-1 inline-block">
                          {doc.category}
                        </span>
                      </div>
                    </div>

                    {doc.accessLevel >= 8 && (
                      <div className="luxury-badge-error flex items-center gap-1 mb-3 w-fit">
                        <Lock className="w-3 h-3" />
                        {isHebrew ? 'סודי' : 'Confidential'}
                      </div>
                    )}

                    {doc.description && (
                      <p className="luxury-text-small mb-4 line-clamp-2">{doc.description}</p>
                    )}

                    <div className="flex flex-col gap-2 luxury-text-small mb-4">
                      <span className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        {doc.uploadedBy}
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {formatDate(doc.uploadedAt)}
                      </span>
                      <span className="flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleView(doc)}
                        className="luxury-btn-secondary flex-1 text-sm py-2"
                        data-testid={`button-view-${doc.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {isHebrew ? 'צפה' : 'View'}
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="luxury-btn-primary flex-1 text-sm py-2"
                        data-testid={`button-download-${doc.id}`}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        {isHebrew ? 'הורד' : 'Download'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 luxury-glass-card luxury-shadow-lg bg-gradient-to-br from-amber-50/50 to-white/50 dark:from-amber-950/30 dark:to-gray-900/30 luxury-animate-fade-in luxury-delay-8">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="luxury-heading-sm mb-1">
                  {isHebrew ? 'הודעת אבטחה' : 'Security Notice'}
                </h4>
                <p className="luxury-text-small">
                  {isHebrew
                    ? 'כל הפעולות עם מסמכים רשומות ונשמרות ביומני גישה מפורטים. אנא הורד ושמור רק מסמכים הדרושים לך לעבודה.'
                    : 'All document actions are logged and recorded in detailed access logs. Please only download and save documents necessary for your work.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
