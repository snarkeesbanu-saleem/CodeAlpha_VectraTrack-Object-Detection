// Agricultural Mapper v5.0 — Real Agricultural Crops, Pests, Leaf Diseases, Severity & Remedies
// Pure field agriculture classes (no domestic COCO classes like cake, dog, cat, bird, apple, orange)

export type AgriCategory = 'crop' | 'pest' | 'disease' | 'ignore';

// ── REAL FIELD CROPS ──────────────────────────────────────────────────────────
export const CROP_CLASSES = [
  'paddy',
  'tomato',
  'cotton',
  'maize',
  'chilli',
  'sugarcane',
  'crop row',
  'banana',
  'groundnut',
] as const;

export const CROP_DISPLAY: Record<string, { en: string; ta: string; emoji: string }> = {
  paddy: { en: 'Paddy / Rice', ta: 'நெல் பயிர்', emoji: '🌾' },
  tomato: { en: 'Tomato Crop', ta: 'தக்காளி பயிர்', emoji: '🍅' },
  cotton: { en: 'Cotton Crop', ta: 'பருத்தி பயிர்', emoji: '🌿' },
  maize: { en: 'Maize / Corn', ta: 'மக்காச்சோளம்', emoji: '🌽' },
  chilli: { en: 'Chilli Crop', ta: 'மிளகாய் பயிர்', emoji: '🌶️' },
  sugarcane: { en: 'Sugarcane', ta: 'கரும்பு', emoji: '🎋' },
  'crop row': { en: 'Crop Canopy Row', ta: 'பயிர் வரிசை', emoji: '🌾' },
  banana: { en: 'Banana Plant', ta: 'வாழை மரம்', emoji: '🍌' },
  groundnut: { en: 'Groundnut Crop', ta: 'நிலக்கடலை பயிர்', emoji: '🌱' },
};

// ── REAL AGRICULTURAL PESTS ──────────────────────────────────────────────────
export const PEST_CLASSES = [
  'aphid',
  'caterpillar',
  'stem borer',
  'whitefly',
  'leafhopper',
  'spider mite',
  'bollworm',
  'thrips',
  'mealybug',
  'grasshopper',
] as const;

export const PEST_DISPLAY: Record<string, { en: string; ta: string; emoji: string }> = {
  aphid: { en: 'Aphid (Plant Lice)', ta: 'அசுவினி பூச்சி', emoji: '🪲' },
  caterpillar: { en: 'Fall Armyworm / Caterpillar', ta: 'படைப்புழு', emoji: '🐛' },
  'stem borer': { en: 'Stem Borer Larva', ta: 'தண்டு துளைப்பான்', emoji: '🐛' },
  whitefly: { en: 'Whitefly (Bemisia tabaci)', ta: 'வெள்ளை ஈ', emoji: '🪰' },
  leafhopper: { en: 'Brown Planthopper (BPH)', ta: 'புகையான் பூச்சி', emoji: '🦗' },
  'spider mite': { en: 'Red Spider Mite', ta: 'செம்பேன்', emoji: '🕷️' },
  bollworm: { en: 'Helicoverpa Bollworm', ta: 'காய்ப்புழு', emoji: '🐛' },
  thrips: { en: 'Thrips', ta: 'இலைப்பேன்', emoji: '🪰' },
  mealybug: { en: 'Mealybug', ta: 'மாவுப்பூச்சி', emoji: '🪲' },
  grasshopper: { en: 'Field Grasshopper / Locust', ta: 'வெட்டுக்கிளி', emoji: '🦗' },
};

// ── REAL LEAF DISEASES ────────────────────────────────────────────────────────
export const DISEASE_CLASSES = [
  'leaf blight',
  'leaf spot',
  'powdery mildew',
  'rust',
  'leaf curl',
  'yellowing',
] as const;

export const DISEASE_DISPLAY: Record<string, { en: string; ta: string; emoji: string }> = {
  'leaf blight': { en: 'Bacterial Leaf Blight', ta: 'இலை கருகல் நோய்', emoji: '🍂' },
  'leaf spot': { en: 'Cercospora Leaf Spot', ta: 'இலைப்புள்ளி நோய்', emoji: '🟤' },
  'powdery mildew': { en: 'Powdery Mildew', ta: 'சாம்பல் நோய்', emoji: '⚪' },
  rust: { en: 'Leaf Rust Fungus', ta: 'துரு நோய்', emoji: '🟠' },
  'leaf curl': { en: 'Leaf Curl Virus', ta: 'இலைச்சுருள் நோய்', emoji: '🍃' },
  yellowing: { en: 'Chlorosis (Nutrient Deficiency)', ta: 'மஞ்சள் நோய் / சத்துக்குறைபாடு', emoji: '🟡' },
};

export interface AgriInfo {
  category: AgriCategory;
  label: string;
  displayName: string;
  emoji: string;
  hexColor: string;
}

export function getAgriInfo(className: string, lang: 'en' | 'ta' = 'en'): AgriInfo {
  const cls = className.toLowerCase().trim();

  if (cls in CROP_DISPLAY) {
    const info = CROP_DISPLAY[cls]!;
    return {
      category: 'crop',
      label: cls,
      displayName: lang === 'ta' ? info.ta : info.en,
      emoji: info.emoji,
      hexColor: '#16a34a',
    };
  }

  if (cls in PEST_DISPLAY) {
    const info = PEST_DISPLAY[cls]!;
    return {
      category: 'pest',
      label: cls,
      displayName: lang === 'ta' ? info.ta : info.en,
      emoji: info.emoji,
      hexColor: '#d97706',
    };
  }

  if (cls in DISEASE_DISPLAY) {
    const info = DISEASE_DISPLAY[cls]!;
    return {
      category: 'disease',
      label: cls,
      displayName: lang === 'ta' ? info.ta : info.en,
      emoji: info.emoji,
      hexColor: '#f43f5e',
    };
  }

  return {
    category: 'ignore',
    label: cls,
    displayName: cls,
    emoji: '⬛',
    hexColor: '#94a3b8',
  };
}

export const CROP_CLASS_LIST = [...CROP_CLASSES];
export const PEST_CLASS_LIST = [...PEST_CLASSES];
export const DISEASE_CLASS_LIST = [...DISEASE_CLASSES];
export const IGNORED_CLASS_LIST = [
  'person', 'car', 'truck', 'bicycle', 'bus', 'laptop', 'chair', 'bottle',
  'cell phone', 'cake', 'cow', 'cat', 'dog', 'apple', 'orange', 'broccoli',
  'carrot', 'potted plant', 'bird', 'mouse',
];

// Confidence & Box Size Threshold Constants
export const MIN_CONFIDENCE_THRESHOLD = 0.58;
export const MIN_BBOX_AREA_PX = 1200;

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
  riskScore: number;
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
    target: 'Aphids / Plant Lice (🪲)',
    type: 'Organic',
    remedyEn: 'Apply 2% Neem Oil spray with mild soap solution (5ml/L) or Dimethoate 30% EC.',
    remedyTa: 'வேப்பெண்ணெய் கரைசல் (2%) அல்லது டைமெத்தோயேட் 30% EC மருந்து தெளிக்கவும்.',
    dosage: '15 ml Neem oil or 1.5 ml Dimethoate per litre of water',
  },
  caterpillar: {
    target: 'Fall Armyworm / Caterpillar (🐛)',
    type: 'Biological',
    remedyEn: 'Spray Bacillus thuringiensis (Bt) kurstaki or Emamectin benzoate 5% SG.',
    remedyTa: 'பேசில்லஸ் துரிஞ்சியென்சிஸ் (Bt) அல்லது எமாமெக்டின் பென்சோயேட் தெளிக்கவும்.',
    dosage: '1.5 g per litre of water',
  },
  'stem borer': {
    target: 'Stem Borer (தண்டு துளைப்பான் 🐛)',
    type: 'Chemical',
    remedyEn: 'Apply Cartap Hydrochloride 4G granules in root zone or Chlorantraniliprole 18.5% SC.',
    remedyTa: 'கார்டாப் ஹைட்ரோகுளோரைடு குருணை மருந்து அல்லது கோரஜென் தெளிக்கவும்.',
    dosage: '0.3 ml Chlorantraniliprole per litre of water or 10kg Cartap/acre',
  },
  whitefly: {
    target: 'Whitefly / Thrips (🪰)',
    type: 'Organic',
    remedyEn: 'Install Yellow Sticky Traps (10/acre) & spray Imidacloprid 17.8% SL or Neem oil.',
    remedyTa: 'மஞ்சள் ஒட்டு பொறிகள் (10/ஏக்கர்) அமைக்கவும் + இமிடாக்ளோப்ரிட் தெளிக்கவும்.',
    dosage: '0.5 ml per litre of water',
  },
  leafhopper: {
    target: 'Brown Planthopper / BPH (🦗)',
    type: 'Chemical',
    remedyEn: 'Drain standing water for 3 days; spray Pymetrozine 50% WDG or Dinotefuran 20% SG.',
    remedyTa: 'வயலில் நீரை 3 நாட்களுக்கு வடிக்கவும்; பைமெட்ரோசின் அல்லது டைனோடேபியூரான் தெளிக்கவும்.',
    dosage: '0.6 g Pymetrozine per litre of water directed at plant base',
  },
  'spider mite': {
    target: 'Red Spider Mite (🕷️)',
    type: 'Chemical',
    remedyEn: 'Spray Propargite 57% EC or Wettable Sulphur 80% WP across underside of leaves.',
    remedyTa: 'புரோபார்கைட் அல்லது நனையும் கந்தகம் இலைகளின் அடிப்பகுதியில் படுமாறு தெளிக்கவும்.',
    dosage: '2.0 ml Propargite or 3g Sulphur per litre of water',
  },
  bollworm: {
    target: 'Bollworm / Fruit Borer (🐛)',
    type: 'Biological',
    remedyEn: 'Install Pheromone traps (5/acre) and spray Spinosad 45% SC or HaNPV 250 LE.',
    remedyTa: 'இனக்கவர்ச்சி பொறி (5/ஏக்கர்) அமைக்கவும் + ஸ்பினோசாட் 45% SC மருந்து தெளிக்கவும்.',
    dosage: '0.3 ml Spinosad per litre of water',
  },
  thrips: {
    target: 'Thrips (இலைப்பேன் 🪰)',
    type: 'Organic',
    remedyEn: 'Install Blue sticky traps (10/acre) and spray Fipronil 5% SC.',
    remedyTa: 'நீல நிற ஒட்டு அட்டை அமைக்கவும் + பிப்ரோனில் 5% SC தெளிக்கவும்.',
    dosage: '1.5 ml per litre of water',
  },
  mealybug: {
    target: 'Mealybug (மாவுப்பூச்சி 🪲)',
    type: 'Organic',
    remedyEn: 'Spray Verticillium lecanii entomopathogenic fungus or Chlorpyrifos 20% EC.',
    remedyTa: 'வெர்ட்டிசீலியம் லெக்கானி பூஞ்சை அல்லது குளோர்பைரிபாஸ் தெளிக்கவும்.',
    dosage: '5 g Verticillium or 2.5 ml Chlorpyrifos per litre of water',
  },
  grasshopper: {
    target: 'Grasshopper / Locust (🦗)',
    type: 'Chemical',
    remedyEn: 'Dig boundary trenches and spray Malathion 50% EC or Quinalphos 25% EC.',
    remedyTa: 'வயல் வரப்புகளில் மாலத்தியான் அல்லது குயினால்பாஸ் தெளிக்கவும்.',
    dosage: '2.0 ml per litre of water',
  },
  'leaf blight': {
    target: 'Bacterial Leaf Blight (🍂)',
    type: 'Chemical',
    remedyEn: 'Spray Copper Oxychloride 50% WP (2.5g/L) + Streptocycline (1g/10L) immediately.',
    remedyTa: 'காப்பர் ஆக்சிகுளோரைடு + ஸ்ட்ரெப்டோமைசின் பாக்டீரியா எதிர்ப்பு மருந்து தெளிக்கவும்.',
    dosage: '2.5 g Copper Oxychloride + 0.1 g Streptocycline per litre',
  },
  'leaf spot': {
    target: 'Cercospora Leaf Spot (🟤)',
    type: 'Chemical',
    remedyEn: 'Spray Carbendazim 50% WP or Mancozeb 75% WP at 10-day interval.',
    remedyTa: 'கார்பெண்டாசிம் அல்லது மேன்கோசெப் பூஞ்சான்கொல்லி மருந்தை தெளிக்கவும்.',
    dosage: '1.0 g Carbendazim or 2.0 g Mancozeb per litre',
  },
  'powdery mildew': {
    target: 'Powdery Mildew (⚪)',
    type: 'Organic',
    remedyEn: 'Apply Soluble Sulphur 80% WP or Hexaconazole 5% EC early morning.',
    remedyTa: 'நனைக்கும் கந்தகம் (Sulphur) அல்லது ஹெக்சாகோனசோல் தெளிக்கவும்.',
    dosage: '3.0 g Sulphur or 1.0 ml Hexaconazole per litre',
  },
  rust: {
    target: 'Leaf Rust Fungus (🟠)',
    type: 'Chemical',
    remedyEn: 'Spray Propiconazole 25% EC or Tebuconazole 25.9% EC to halt rust spore propagation.',
    remedyTa: 'புரோபிகோனசோல் அல்லது டெபுகோனசோல் பூஞ்சான்கொல்லி மருந்தை தெளிக்கவும்.',
    dosage: '1.0 ml per litre of water',
  },
  'leaf curl': {
    target: 'Leaf Curl Virus (🍃)',
    type: 'Preventative',
    remedyEn: 'Vector control: spray Acephate 75% SP or Imidacloprid against whitefly vectors.',
    remedyTa: 'வெள்ளை ஈயை கட்டுப்படுத்த அசிபேட் அல்லது இமிடாக்ளோப்ரிட் தெளிக்கவும்.',
    dosage: '1.5 g Acephate per litre of water',
  },
  yellowing: {
    target: 'Chlorosis / Micronutrient Deficiency (🟡)',
    type: 'Preventative',
    remedyEn: 'Apply Zinc Sulphate (0.5%) + Ferrous Sulphate (0.5%) + Urea (1%) foliar spray.',
    remedyTa: 'துத்தநாக சல்பேட் (0.5%) + இரும்பு சல்பேட் (0.5%) + யூரியா (1%) தெளிக்கவும்.',
    dosage: '5.0 g each per litre of water',
  },
};

export function getRemediesForDetections(detections: { cocoClass: string; category: string }[]): TreatmentRecommendation[] {
  const remedies: TreatmentRecommendation[] = [];
  const added = new Set<string>();

  for (const d of detections) {
    const key = d.cocoClass.toLowerCase().trim();
    if (TREATMENT_DATABASE[key] && !added.has(key)) {
      added.add(key);
      remedies.push(TREATMENT_DATABASE[key]);
    }
  }

  if (remedies.length === 0) {
    remedies.push({
      target: 'General Crop Maintenance',
      type: 'Preventative',
      remedyEn: 'Maintain field weed hygiene, ensure proper drainage, and inspect regularly.',
      remedyTa: 'வயலில் களைகளை அகற்றி, சரியான வடிகால் வசதியை உறுதிப்படுத்தவும்.',
      dosage: 'Standard agricultural protocol',
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
