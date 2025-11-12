import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Search, 
  Download, 
  Eye, 
  Filter, 
  Calendar,
  User,
  Shield,
  FileCode,
  Building2,
  Tag
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/lib/languageStore';

interface Document {
  id: number;
  documentNumber: string;
  title: string;
  titleHe?: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  categoryId: number;
  gcsUrl: string;
  uploadedBy: string;
  uploadedByEmail: string;
  uploadedAt: string;
  isConfidential: boolean;
  accessLevel: number;
  status: string;
  tags?: string[];
}

interface Category {
  id: number;
  categoryCode: string;
  categoryName: string;
  categoryNameHe: string;
  department: string;
  isConfidential: boolean;
}

interface AccessLogEntry {
  id: number;
  documentId: number;
  userEmail: string;
  userName: string | null;
  accessType: string;
  accessGranted: boolean;
  denialReason: string | null;
  ipAddress: string | null;
  accessedAt: string;
}

export default function DocumentManagement() {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showAccessLog, setShowAccessLog] = useState(false);

  // Fetch document categories
  const { data: categoriesData } = useQuery<{ categories: Category[] }>({
    queryKey: ['/api/documents/categories'],
  });
  
  const categories = categoriesData?.categories ?? [];

  // Fetch documents with filters
  const { data: documentsData, isLoading: documentsLoading } = useQuery<{
    documents: Array<{ document: Document; category: Category }>;
    total: number;
  }>({
    queryKey: ['/api/documents', categoryFilter, typeFilter],
  });

  // Fetch access log for selected document
  const { data: accessLogData } = useQuery<{ logs: AccessLogEntry[] }>({
    queryKey: ['/api/documents', selectedDocument?.id, 'access-log'],
    enabled: !!selectedDocument && showAccessLog,
  });

  const documents = documentsData?.documents || [];
  
  // Filter documents by search query
  const filteredDocuments = documents.filter((item) => {
    const doc = item.document;
    const searchLower = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(searchLower) ||
      doc.titleHe?.toLowerCase().includes(searchLower) ||
      doc.fileName.toLowerCase().includes(searchLower) ||
      doc.documentNumber.toLowerCase().includes(searchLower) ||
      doc.documentType.toLowerCase().includes(searchLower)
    );
  });

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

  const getDocumentTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      invoice: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      contract: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      agreement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      specification: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      legal: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      trademark: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      certificate: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      const data = await response.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <CardTitle className="text-2xl">
                  {isHebrew ? 'מסמכים מאובטחים' : 'Document Management'}
                </CardTitle>
                <CardDescription className="text-blue-100">
                  {isHebrew 
                    ? 'גלה, צפה והורד מסמכים ארגוניים'
                    : 'Browse, view, and download organizational documents'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isHebrew ? 'חפש מסמכים...' : 'Search documents...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-documents"
                />
              </div>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={isHebrew ? 'כל הקטגוריות' : 'All Categories'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHebrew ? 'כל הקטגוריות' : 'All Categories'}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {isHebrew && cat.categoryNameHe ? cat.categoryNameHe : cat.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger data-testid="select-type-filter">
                  <FileCode className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={isHebrew ? 'כל הסוגים' : 'All Types'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isHebrew ? 'כל הסוגים' : 'All Types'}</SelectItem>
                  <SelectItem value="invoice">{isHebrew ? 'חשבוניות' : 'Invoices'}</SelectItem>
                  <SelectItem value="contract">{isHebrew ? 'חוזים' : 'Contracts'}</SelectItem>
                  <SelectItem value="agreement">{isHebrew ? 'הסכמים' : 'Agreements'}</SelectItem>
                  <SelectItem value="specification">{isHebrew ? 'מפרטים טכניים' : 'Specifications'}</SelectItem>
                  <SelectItem value="legal">{isHebrew ? 'משפטי' : 'Legal'}</SelectItem>
                  <SelectItem value="trademark">{isHebrew ? 'סימני מסחר' : 'Trademarks'}</SelectItem>
                  <SelectItem value="certificate">{isHebrew ? 'תעודות' : 'Certificates'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Count */}
            <div className="text-sm text-muted-foreground">
              {isHebrew 
                ? `${filteredDocuments.length} מסמכים מתוך ${documents.length}` 
                : `Showing ${filteredDocuments.length} of ${documents.length} documents`}
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        {documentsLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{isHebrew ? 'טוען...' : 'Loading...'}</p>
            </CardContent>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {isHebrew ? 'לא נמצאו מסמכים' : 'No documents found'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(({ document: doc, category }) => (
              <Card 
                key={doc.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedDocument(doc)}
                data-testid={`card-document-${doc.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base line-clamp-2">
                        {isHebrew && doc.titleHe ? doc.titleHe : doc.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.documentNumber}
                      </p>
                    </div>
                    {doc.isConfidential && (
                      <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getDocumentTypeColor(doc.documentType)}>
                      {doc.documentType}
                    </Badge>
                    <Badge variant="outline">
                      {formatFileSize(doc.fileSize)}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3 h-3" />
                      <span>{isHebrew && category.categoryNameHe ? category.categoryNameHe : category.categoryName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(doc.uploadedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span className="truncate">{doc.uploadedByEmail}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDocument(doc);
                      }}
                      data-testid={`button-view-${doc.id}`}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      {isHebrew ? 'צפה' : 'View'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc);
                      }}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      {isHebrew ? 'הורד' : 'Download'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Document Details Dialog */}
        <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedDocument && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {isHebrew && selectedDocument.titleHe ? selectedDocument.titleHe : selectedDocument.title}
                    {selectedDocument.isConfidential && (
                      <Shield className="w-4 h-4 text-red-500" />
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedDocument.documentNumber}
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">
                      {isHebrew ? 'פרטים' : 'Details'}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="access-log"
                      onClick={() => setShowAccessLog(true)}
                    >
                      {isHebrew ? 'יומן גישה' : 'Access Log'}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">{isHebrew ? 'שם קובץ' : 'File Name'}</p>
                        <p className="text-sm text-muted-foreground">{selectedDocument.fileName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{isHebrew ? 'גודל' : 'Size'}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(selectedDocument.fileSize)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{isHebrew ? 'סוג' : 'Type'}</p>
                        <Badge className={getDocumentTypeColor(selectedDocument.documentType)}>
                          {selectedDocument.documentType}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{isHebrew ? 'רמת גישה' : 'Access Level'}</p>
                        <p className="text-sm text-muted-foreground">{selectedDocument.accessLevel}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{isHebrew ? 'הועלה על ידי' : 'Uploaded By'}</p>
                        <p className="text-sm text-muted-foreground">{selectedDocument.uploadedByEmail}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{isHebrew ? 'תאריך העלאה' : 'Upload Date'}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(selectedDocument.uploadedAt)}</p>
                      </div>
                    </div>

                    {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">{isHebrew ? 'תגיות' : 'Tags'}</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedDocument.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button 
                      className="w-full"
                      onClick={() => handleDownload(selectedDocument)}
                      data-testid="button-download-modal"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isHebrew ? 'הורד מסמך' : 'Download Document'}
                    </Button>
                  </TabsContent>

                  <TabsContent value="access-log" className="space-y-4">
                    {accessLogData?.logs && accessLogData.logs.length > 0 ? (
                      <div className="space-y-2">
                        {accessLogData.logs.map((log) => (
                          <Card key={log.id}>
                            <CardContent className="py-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{log.userEmail}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {log.accessType} • {formatDate(log.accessedAt)}
                                  </p>
                                  {!log.accessGranted && log.denialReason && (
                                    <p className="text-xs text-red-600 mt-1">{log.denialReason}</p>
                                  )}
                                </div>
                                <Badge variant={log.accessGranted ? 'default' : 'destructive'}>
                                  {log.accessGranted 
                                    ? (isHebrew ? 'הותר' : 'Granted')
                                    : (isHebrew ? 'נדחה' : 'Denied')}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        {isHebrew ? 'אין רשומות גישה' : 'No access records'}
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
