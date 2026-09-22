// Agricultural Mapper v4.5 — Precise Crops, Pests, Diseases, Severity & Remedies

export type AgriCategory = 'crop' | 'pest' | 'disease' | 'ignore';

const CROP_CLASSES = new Set([
  'apple', 'orange', 'broccoli', 'carrot', 'potted plant', 'crop row', 'maize', 'paddy',
]);

const PEST_CLASSES = new Set([
  'aphid', 'beetle', 'caterpillar', 'mite', 'moth', 'armyworm', 'whitefly', 'grasshopper', 'bird', 'mouse',
]);

const DISEASE_CLASSES = new Set([
  'leaf blight', 'leaf spot', 'powdery mildew', 'rust', 'yellowing',
]);

const CROP_EMOJIS: Record<string, string> = {
  apple: '🍎', orange: '🍊', broccoli: '🥦', carrot: '🥕',
  'potted plant': '🌱', 'crop row': '🌾', maize: '🌽', paddy: '🌾',
};

const PEST_EMOJIS: Record<string, string> = {
  aphid: '🪲', beetle: '🪲', caterpillar: '🐛', mite: '🕷️',
  moth: '🦋', armyworm: '🐛', whitefly: '🪰', grasshopper: '🦗',
  bird: '🐦', mouse: '🐭',
};

const DISEASE_EMOJIS: Record<string, string> = {
  'leaf blight': '🍂', 'leaf spot': '🟤', 'powdery mildew': '⚪',
  rust: '🟠', yellowing: '🟡',
};

export interface AgriInfo {
  category: AgriCategory;
  label: string;
  emoji: string;
  hexColor: string;
}

export function getAgriInfo(className: string): AgriInfo {
  const cls = className.toLowerCase().trim();
  if (CROP_CLASSES.has(cls)) return {
    category: 'crop', label: cls, emoji: CROP_EMOJIS[cls] || '🌱',
    hexColor: '#16a34a',
  };
  if (PEST_CLASSES.has(cls)) return {
    category: 'pest', label: cls, emoji: PEST_EMOJIS[cls] || '🐛',
    hexColor: '#d97706',
  };
  if (DISEASE_CLASSES.has(cls)) return {
    category: 'disease', label: cls, emoji: DISEASE_EMOJIS[cls] || '🍂',
    hexColor: '#f43f5e',
  };
  return { category: 'ignore', label: cls, emoji: '⬛', hexColor: '#94a3b8' };
}

export const CROP_CLASS_LIST = Array.from(CROP_CLASSES);
export const PEST_CLASS_LIST = Array.from(PEST_CLASSES);
export const DISEASE_CLASS_LIST = Array.from(DISEASE_CLASSES);
export const IGNORED_CLASS_LIST = ['person', 'car', 'truck', 'bicycle', 'bus', 'laptop', 'chair', 'bottle', 'cell phone', 'cake', 'cow', 'cat', 'dog'];

// Confidence & Box Size Threshold Constants
export const MIN_CONFIDENCE_THRESHOLD = 0.58;
export const MIN_BBOX_AREA_PX = 1200; // Filter out tiny noise boxes < 1200 px²

export interface SeverityLevel {
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  color: string;
  bgColor: string;
  badge: string;
  pestDensity: number;
}

export function calculateSeverity(pestCount: number, diseaseCount: number, totalCrops: number): SeverityLevel {
  const threatScore = pestCount * 2.5 + diseaseCount * 3.5;
  const density = totalCrops > 0 ? (pestCount + diseaseCount) / totalCrops : pestCount + diseaseCount;

  if (threatScore === 0) return { level: 'Low', color: '#16a34a', bgColor: '#dcfce7', badge: '🟢 Low Severity', pestDensity: 0 };
  if (threatScore <= 4 && density < 0.4) return { level: 'Low', color: '#16a34a', bgColor: '#dcfce7', badge: '🟢 Low Severity', pestDensity: Number(density.toFixed(2)) };
  if (threatScore <= 10 || density < 0.8) return { level: 'Medium', color: '#d97706', bgColor: '#fef3c7', badge: '🟡 Medium Severity', pestDensity: Number(density.toFixed(2)) };
  if (threatScore <= 18 || density < 1.5) return { level: 'High', color: '#ea580c', bgColor: '#ffedd5', badge: '🟠 High Severity', pestDensity: Number(density.toFixed(2)) };
  return { level: 'Critical', color: '#dc2626', bgColor: '#fee2e2', badge: '🔴 Critical Outbreak', pestDensity: Number(density.toFixed(2)) };
}

export interface YieldRisk {
  riskScore: number; // 0-100%
  riskCategory: 'Low Yield Risk (<5%)' | 'Moderate Yield Risk (15-30%)' | 'Critical Yield Loss (>40%)';
  color: string;
  description: string;
}

export function calculateYieldRisk(pestCount: number, diseaseCount: number, cropCount: number): YieldRisk {
  const baseLoss = Math.min(95, Math.round(pestCount * 4.5 + diseaseCount * 7.5 - cropCount * 0.8));
  const score = Math.max(2, baseLoss);

  if (score < 12) {
    return {
      riskScore: score,
      riskCategory: 'Low Yield Risk (<5%)',
      color: '#16a34a',
      description: 'Crop health is optimal. Normal expected harvest yield.',
    };
  }
  if (score < 35) {
    return {
      riskScore: score,
      riskCategory: 'Moderate Yield Risk (15-30%)',
      color: '#d97706',
      description: 'Moderate pest/disease infestation detected. Early intervention advised.',
    };
  }
  return {
    riskScore: score,
    riskCategory: 'Critical Yield Loss (>40%)',
    color: '#dc2626',
    description: 'Severe infestation alert. Immediate localized chemical or biological treatment required.',
  };
}

export interface TreatmentRecommendation {
  target: string;
  type: 'Organic' | 'Chemical' | 'Biological' | 'Preventative';
  remedyEn: string;
  remedyTa: string;
  dosage: string;
}

export const TREATMENT_DATABASE: Record<string, TreatmentRecommendation> = {
  aphid: {
    target: 'Aphids (🪲)',
    type: 'Organic',
    remedyEn: 'Apply 2% Neem Oil spray with mild potassium soap solution every 5 days.',
    remedyTa: 'வேப்பெண்ணெய் (2%) + சோப்பு நீர் கரைசலை 5 நாட்களுக்கு ஒருமுறை தெளிக்கவும்.',
    dosage: '15 ml Neem oil per litre of water',
  },
  caterpillar: {
    target: 'Caterpillars / Armyworms (🐛)',
    type: 'Biological',
    remedyEn: 'Spray Bacillus thuringiensis (Bt) or Emamectin benzoate 5% SG.',
    remedyTa: 'பேசில்லஸ் துரிஞ்சியென்சிஸ் (Bt) அல்லது எமாமெக்டின் பென்சோயேட் தெளிக்கவும்.',
    dosage: '1.5 g per litre of water',
  },
  whitefly: {
    target: 'Whiteflies / Thrips (🪰)',
    type: 'Organic',
    remedyEn: 'Install Yellow Sticky Traps (10 per acre) & spray Imidacloprid 17.8% SL.',
    remedyTa: 'மஞ்சள் ஒட்டு அட்டை அமைக்கவும் + இமிடாக்ளோப்ரிட் தெளிக்கவும்.',
    dosage: '0.5 ml per litre of water',
  },
  'leaf blight': {
    target: 'Leaf Blight (🍂)',
    type: 'Chemical',
    remedyEn: 'Spray Copper Oxychloride 50% WP or Mancozeb 75% WP immediately.',
    remedyTa: 'காப்பர் ஆக்சிகுளோரைடு அல்லது மேன்கோசெப் பூஞ்சான்கொல்லி தெளிக்கவும்.',
    dosage: '2.5 g per litre of water',
  },
  'leaf spot': {
    target: 'Leaf Spot / Cercospora (🟤)',
    type: 'Chemical',
    remedyEn: 'Spray Carbendazim 50% WP or Hexaconazole 5% EC at 7-day interval.',
    remedyTa: 'கார்பெண்டாசிம் அல்லது ஹெக்சாகோனசோல் தெளிக்கவும்.',
    dosage: '1.0 ml per litre of water',
  },
  'powdery mildew': {
    target: 'Powdery Mildew (⚪)',
    type: 'Organic',
    remedyEn: 'Apply Soluble Sulphur 80% WP or baking soda spray (5g/L).',
    remedyTa: 'நனைக்கும் கந்தகம் (Sulphur) அல்லது சமையல் சோடா தெளிக்கவும்.',
    dosage: '3.0 g per litre of water',
  },
  rust: {
    target: 'Leaf Rust (🟠)',
    type: 'Chemical',
    remedyEn: 'Spray Propiconazole 25% EC to halt rust spore propagation.',
    remedyTa: 'புரோபிகோனசோல் பூஞ்சான்கொல்லி மருந்தை தெளிக்கவும்.',
    dosage: '1.0 ml per litre of water',
  },
  yellowing: {
    target: 'Nitrogen / Micronutrient Deficiency (Yellowing 🟡)',
    type: 'Preventative',
    remedyEn: 'Apply Zinc Sulphate + Ferrous Sulphate foliar spray with 1% Urea.',
    remedyTa: 'துத்தநாக சல்பேட் + இரும்பு சல்பேட் மற்றும் 1% யூரியா தெளிக்கவும்.',
    dosage: '5.0 g per litre of water',
  },
};

export function getRemediesForDetections(detections: { cocoClass: string; category: string }[]): TreatmentRecommendation[] {
  const remedies: TreatmentRecommendation[] = [];
  const added = new Set<string>();

  for (const d of detections) {
    const key = d.cocoClass.toLowerCase();
    if (TREATMENT_DATABASE[key] && !added.has(key)) {
      added.add(key);
      remedies.push(TREATMENT_DATABASE[key]);
    }
  }

  if (remedies.length === 0) {
    remedies.push({
      target: 'General Crop Maintenance',
      type: 'Preventative',
      remedyEn: 'Maintain field weed hygiene, ensure proper drainage, and install light traps.',
      remedyTa: 'வயலில் களைகளை அகற்றி, சரியான வடிகால் வசதி மற்றும் ஒளி பொறிகளை அமைக்கவும்.',
      dosage: 'Standard preventative protocol',
    });
  }

  return remedies;
}

export function computeHealthScore(cropCount: number, pestCount: number, diseaseCount = 0): number {
  return Math.max(0, Math.min(100, 100 - pestCount * 4 - diseaseCount * 6 + cropCount * 1.5));
}

export function getHealthGrade(score: number): { grade: string; color: string; bgColor: string } {
  if (score >= 75) return { grade: '🟢 Healthy Field', color: '#16a34a', bgColor: '#dcfce7' };
  if (score >= 45) return { grade: '🟡 Moderate Risk', color: '#d97706', bgColor: '#fef3c7' };
  return { grade: '🔴 Critical Outbreak', color: '#dc2626', bgColor: '#fee2e2' };
}
