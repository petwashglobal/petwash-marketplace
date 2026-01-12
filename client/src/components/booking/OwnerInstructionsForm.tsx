import { useState } from "react";
import { ChevronDown, ChevronUp, Key, Lock, Shield, Thermometer, Bowl, Droplets, AlertCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface OwnerInstructions {
  gateCode?: string;
  doorCode?: string;
  alarmCode?: string;
  alarmInstructions?: string;
  airconLocation?: string;
  foodLocation?: string;
  waterLocation?: string;
  medicationInstructions?: string;
  emergencyContact?: string;
  vetContact?: string;
  additionalNotes?: string;
  shareWithProvider: boolean;
}

interface OwnerInstructionsFormProps {
  value: OwnerInstructions;
  onChange: (instructions: OwnerInstructions) => void;
  className?: string;
}

export function OwnerInstructionsForm({ value, onChange, className = "" }: OwnerInstructionsFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = (field: keyof OwnerInstructions, fieldValue: string | boolean) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const hasAnyInstructions = value.gateCode || value.doorCode || value.alarmCode || 
    value.airconLocation || value.foodLocation || value.waterLocation || 
    value.medicationInstructions || value.additionalNotes;

  return (
    <div className={`luxury-glass-card p-4 ${className}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-right"
      >
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-amber-600" />
          <div>
            <h3 className="font-medium text-slate-900">הוראות לנותן השירות</h3>
            <p className="text-xs text-slate-500">קודים, מיקומים והנחיות מיוחדות</p>
          </div>
          {hasAnyInstructions && (
            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
              הוזן מידע
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5 text-slate-700">
                <Lock className="h-3.5 w-3.5" />
                קוד שער
              </Label>
              <Input
                type="password"
                placeholder="****"
                value={value.gateCode || ""}
                onChange={(e) => updateField("gateCode", e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5 text-slate-700">
                <Key className="h-3.5 w-3.5" />
                קוד דלת
              </Label>
              <Input
                type="password"
                placeholder="****"
                value={value.doorCode || ""}
                onChange={(e) => updateField("doorCode", e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5 text-slate-700">
                <Shield className="h-3.5 w-3.5" />
                קוד אזעקה
              </Label>
              <Input
                type="password"
                placeholder="****"
                value={value.alarmCode || ""}
                onChange={(e) => updateField("alarmCode", e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-1.5 text-slate-700">
              הוראות לאזעקה
            </Label>
            <Input
              placeholder="איך מפעילים ומכבים את האזעקה"
              value={value.alarmInstructions || ""}
              onChange={(e) => updateField("alarmInstructions", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5 text-slate-700">
                <Thermometer className="h-3.5 w-3.5" />
                מיקום מזגן
              </Label>
              <Input
                placeholder="בסלון, ליד הספה"
                value={value.airconLocation || ""}
                onChange={(e) => updateField("airconLocation", e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5 text-slate-700">
                <Bowl className="h-3.5 w-3.5" />
                מיקום אוכל
              </Label>
              <Input
                placeholder="במטבח, ארון תחתון"
                value={value.foodLocation || ""}
                onChange={(e) => updateField("foodLocation", e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5 text-slate-700">
                <Droplets className="h-3.5 w-3.5" />
                מיקום מים
              </Label>
              <Input
                placeholder="קערה במטבח"
                value={value.waterLocation || ""}
                onChange={(e) => updateField("waterLocation", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5 mb-1.5 text-slate-700">
              <AlertCircle className="h-3.5 w-3.5" />
              הוראות תרופות/טיפולים
            </Label>
            <Textarea
              placeholder="פירוט תרופות, מינון ושעות מתן"
              value={value.medicationInstructions || ""}
              onChange={(e) => updateField("medicationInstructions", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 text-slate-700">איש קשר לחירום</Label>
              <Input
                placeholder="שם וטלפון"
                value={value.emergencyContact || ""}
                onChange={(e) => updateField("emergencyContact", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 text-slate-700">וטרינר</Label>
              <Input
                placeholder="שם המרפאה וטלפון"
                value={value.vetContact || ""}
                onChange={(e) => updateField("vetContact", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 text-slate-700">הערות נוספות</Label>
            <Textarea
              placeholder="כל מידע חשוב נוסף..."
              value={value.additionalNotes || ""}
              onChange={(e) => updateField("additionalNotes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <Checkbox
              id="shareWithProvider"
              checked={value.shareWithProvider}
              onCheckedChange={(checked) => updateField("shareWithProvider", checked === true)}
            />
            <label htmlFor="shareWithProvider" className="text-sm text-amber-800 cursor-pointer">
              <span className="font-medium">אני מאשר/ת שיתוף המידע הזה</span>
              <span className="block text-xs text-amber-600 mt-0.5">
                המידע ישותף רק עם נותן השירות שאישרתי, ויימחק לאחר סיום השירות
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export function useOwnerInstructions() {
  const [instructions, setInstructions] = useState<OwnerInstructions>({
    shareWithProvider: false,
  });

  return { instructions, setInstructions };
}
