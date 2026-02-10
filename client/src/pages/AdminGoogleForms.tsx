import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  FileText, Plus, Trash2, Save, ExternalLink, Loader2,
  ArrowLeft, CheckCircle, XCircle, Eye
} from 'lucide-react';
import { Link } from 'wouter';

const FORM_TYPES = [
  { value: 'contact', label: 'Contact Us', labelHe: 'צור קשר' },
  { value: 'feedback', label: 'Feedback & Reviews', labelHe: 'משוב וביקורות' },
  { value: 'newsletter', label: 'Newsletter Signup', labelHe: 'הרשמה לניוזלטר' },
  { value: 'franchise', label: 'Franchise Inquiry', labelHe: 'פנייה לזכיינות' },
  { value: 'provider_application', label: 'Provider Application', labelHe: 'בקשת ספק' },
  { value: 'careers', label: 'Career Application', labelHe: 'מועמדות לעבודה' },
  { value: 'event_registration', label: 'Event Registration', labelHe: 'הרשמה לאירוע' },
  { value: 'support', label: 'Support Request', labelHe: 'בקשת תמיכה' },
];

interface FormConfig {
  id: number;
  formType: string;
  formUrl: string;
  formTitle: string | null;
  formTitleHe: string | null;
  enabled: boolean;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminGoogleForms() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({
    formType: '',
    formUrl: '',
    formTitle: '',
    formTitleHe: '',
    height: 800,
  });

  const { data: configs = [], isLoading } = useQuery<FormConfig[]>({
    queryKey: ['/api/google-forms/config'],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/google-forms/config', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-forms/config'] });
      setShowAddForm(false);
      setNewForm({ formType: '', formUrl: '', formTitle: '', formTitleHe: '', height: 800 });
      toast({ title: 'Form configuration saved' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to save' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ formType, enabled, formUrl }: { formType: string; enabled: boolean; formUrl: string }) => {
      const res = await apiRequest('POST', '/api/google-forms/config', { formType, enabled, formUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-forms/config'] });
      toast({ title: 'Form status updated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (formType: string) => {
      const res = await apiRequest('DELETE', `/api/google-forms/config/${formType}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-forms/config'] });
      toast({ title: 'Form removed' });
    },
  });

  const getFormTypeLabel = (type: string) => {
    return FORM_TYPES.find(f => f.value === type)?.label || type;
  };

  const usedTypes = configs.map((c: FormConfig) => c.formType);
  const availableTypes = FORM_TYPES.filter(f => !usedTypes.includes(f.value));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/backend">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <FileText className="h-7 w-7 text-blue-600" />
              Google Forms Management
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Configure embedded Google Forms for user-facing pages
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Configured Forms ({configs.length})</CardTitle>
            {availableTypes.length > 0 && (
              <Button onClick={() => setShowAddForm(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Form
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No Google Forms configured yet</p>
                <p className="text-sm mt-1">Add a form to embed it on the corresponding page</p>
                <Button onClick={() => setShowAddForm(true)} className="mt-4 gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Add Your First Form
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {configs.map((config: FormConfig) => (
                  <div key={config.id} className="border rounded-lg p-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={config.enabled ? 'default' : 'secondary'} className="gap-1">
                          {config.enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {config.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <div>
                          <h3 className="font-medium">{getFormTypeLabel(config.formType)}</h3>
                          {config.formTitle && <p className="text-xs text-gray-500">{config.formTitle}</p>}
                          {config.formTitleHe && <p className="text-xs text-gray-400 font-hebrew">{config.formTitleHe}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewType(previewType === config.formType ? null : config.formType)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <a href={config.formUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={(checked) => toggleMutation.mutate({ 
                            formType: config.formType, 
                            enabled: checked, 
                            formUrl: config.formUrl 
                          })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm('Remove this form configuration?')) {
                              deleteMutation.mutate(config.formType);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 truncate">{config.formUrl}</p>
                    
                    {previewType === config.formType && (
                      <div className="mt-4 border-t pt-4">
                        <iframe
                          src={config.formUrl.includes('?') ? `${config.formUrl}&embedded=true` : `${config.formUrl}?embedded=true`}
                          width="100%"
                          height={config.height || 600}
                          frameBorder="0"
                          className="rounded-lg border"
                          title={`Preview: ${config.formType}`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Google Form</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Form Type</label>
                  <Select value={newForm.formType} onValueChange={(v) => setNewForm(prev => ({ ...prev, formType: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select form type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label} - {type.labelHe}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Google Form URL</label>
                  <Input
                    value={newForm.formUrl}
                    onChange={(e) => setNewForm(prev => ({ ...prev, formUrl: e.target.value }))}
                    placeholder="https://docs.google.com/forms/d/e/xxxxx/viewform"
                  />
                  <p className="text-xs text-gray-400 mt-1">Paste the full Google Form share URL</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title (English)</label>
                    <Input
                      value={newForm.formTitle}
                      onChange={(e) => setNewForm(prev => ({ ...prev, formTitle: e.target.value }))}
                      placeholder="Contact Us"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Title (Hebrew)</label>
                    <Input
                      value={newForm.formTitleHe}
                      onChange={(e) => setNewForm(prev => ({ ...prev, formTitleHe: e.target.value }))}
                      placeholder="צור קשר"
                      dir="rtl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Form Height (px)</label>
                  <Input
                    type="number"
                    value={newForm.height}
                    onChange={(e) => setNewForm(prev => ({ ...prev, height: parseInt(e.target.value) || 800 }))}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => saveMutation.mutate(newForm)}
                    disabled={!newForm.formType || !newForm.formUrl || saveMutation.isPending}
                    className="gap-2"
                  >
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Form
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>1. Create a Google Form at <a href="https://forms.google.com" target="_blank" className="text-blue-600 underline">forms.google.com</a></p>
            <p>2. Copy the form's share URL and paste it above</p>
            <p>3. The form will be embedded on the corresponding page automatically</p>
            <p>4. Responses will appear in your Google Form responses and linked Google Sheets</p>
            <p>5. Use the toggle to enable/disable forms without deleting them</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
