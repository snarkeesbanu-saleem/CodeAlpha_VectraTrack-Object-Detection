/**
 * Lightweight Multi-Task Joint Head (Pest + Disease)
 *
 * Implements a dual-head multi-task architecture evaluating both insect pests
 * and foliar plant pathology jointly per detected region.
 * Calculates the Joint Pathology Index (JPI) accounting for biological synergy
 * (e.g. whiteflies transmitting virus, aphid honeydew inducing fungal infection).
 */

export interface PestPrediction {
  detected: boolean;
  className: string;
  displayName: string;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
}

export interface DiseasePrediction {
  detected: boolean;
  diseaseName: string;
  displayName: string;
  lesionSeverity: number; // 0 to 100%
  pathologyType: "fungal" | "bacterial" | "viral" | "deficiency" | "none";
}

export interface MultiTaskTargetResult {
  pest: PestPrediction;
  disease: DiseasePrediction;
  jointPathologyIndex: number; // 0 to 100
  riskSummary: string;
  synergyDetected: boolean;
  synergyDescription?: string;
}

// Biological vector & secondary pathogen synergy relationships
const PEST_DISEASE_SYNERGIES: Record<
  string,
  { disease: string; reasonEn: string; reasonTa: string; weight: number }
> = {
  whitefly: {
    disease: "leaf curl",
    reasonEn: "Whiteflies act as biological vectors for Tomato / Cotton Leaf Curl Virus.",
    reasonTa: "வெள்ளை ஈக்கள் இலைச்சுருள் வைரஸ் நோயை வேகமாக பரப்புகின்றன.",
    weight: 1.35,
  },
  aphid: {
    disease: "powdery mildew",
    reasonEn: "Aphid honeydew excretions accelerate secondary sooty mold and fungal propagation.",
    reasonTa: "அசுவினி கழிவுகள் பூஞ்சான் மற்றும் கரும்பூஞ்சை பரவலை தூண்டுகின்றன.",
    weight: 1.25,
  },
  caterpillar: {
    disease: "leaf blight",
    reasonEn: "Chewing mouthparts create foliar open wounds permitting bacterial blight entry.",
    reasonTa: "புழுக்கள் இலைகளை கடிப்பதால் ஏற்படும் காயங்கள் மூலம் பாக்டீரியா கருகல் நோய் நுழைகிறது.",
    weight: 1.3,
  },
  thrips: {
    disease: "leaf spot",
    reasonEn: "Thrips cell-puncturing triggers necrotic leaf spotting and viral infection.",
    reasonTa: "இலைப்பேன் இலை திசுக்களை உறிஞ்சுவதால் இலைப்புள்ளி நோய் தீவிரமடைகிறது.",
    weight: 1.2,
  },
  "spider mite": {
    disease: "yellowing",
    reasonEn: "Mite chlorophyll extraction causes rapid leaf chlorosis and stunting.",
    reasonTa: "செம்பேன்கள் பச்சையத்தை உறிஞ்சுவதால் பயிர்கள் வேகமாக மஞ்சள் நிறமாக மாறுகின்றன.",
    weight: 1.25,
  },
};

/**
 * Multi-Task Joint Evaluation for a detected agricultural candidate region
 */
export function evaluateMultiTaskHead(
  cocoClass: string,
  rawConfidence: number,
  category: "crop" | "pest" | "disease"
): MultiTaskTargetResult {
  const cls = cocoClass.toLowerCase().trim();

  // Head 1: Pest Evaluation
  const isPest = category === "pest" || cls in PEST_DISEASE_SYNERGIES;
  const pestPred: PestPrediction = {
    detected: isPest,
    className: isPest ? cls : "none",
    displayName: isPest ? cls.toUpperCase() : "None",
    confidence: isPest ? rawConfidence : 0,
    severity: rawConfidence > 0.82 ? "critical" : rawConfidence > 0.65 ? "high" : "medium",
  };

  // Head 2: Disease Pathology Evaluation
  const isDisease = category === "disease";
  let diseaseName = isDisease ? cls : "none";
  let pathologyType: DiseasePrediction["pathologyType"] = "none";
  let lesionSeverity = 0;

  if (isDisease) {
    lesionSeverity = Math.round(rawConfidence * 100);
    if (cls.includes("blight")) pathologyType = "bacterial";
    else if (cls.includes("spot") || cls.includes("mildew") || cls.includes("rust")) pathologyType = "fungal";
    else if (cls.includes("curl")) pathologyType = "viral";
    else if (cls.includes("yellowing")) pathologyType = "deficiency";
  }

  // Cross-Task Synergy Check
  let synergyDetected = false;
  let synergyDescription: string | undefined;
  let synergyMultiplier = 1.0;

  if (isPest && cls in PEST_DISEASE_SYNERGIES) {
    const syn = PEST_DISEASE_SYNERGIES[cls]!;
    synergyDetected = true;
    synergyMultiplier = syn.weight;
    synergyDescription = syn.reasonEn;
    if (!isDisease) {
      diseaseName = syn.disease;
      pathologyType = "viral";
      lesionSeverity = Math.round(rawConfidence * 45); // latent infection likelihood
    }
  }

  const diseasePred: DiseasePrediction = {
    detected: isDisease || synergyDetected,
    diseaseName,
    displayName: diseaseName.toUpperCase(),
    lesionSeverity,
    pathologyType,
  };

  // Joint Pathology Index (JPI)
  const basePest = isPest ? rawConfidence * 45 : 0;
  const baseDisease = isDisease ? rawConfidence * 55 : (synergyDetected ? 25 : 0);
  const jpi = Math.min(100, Math.round((basePest + baseDisease) * synergyMultiplier));

  let riskSummary = "Optimal foliage condition.";
  if (jpi >= 75) riskSummary = "CRITICAL: Dual Pest + Secondary Disease Infection active!";
  else if (jpi >= 45) riskSummary = "MODERATE: Pest pressure with disease vector risk.";
  else if (jpi > 0) riskSummary = "LOW: Isolated target, manageable with standard protocols.";

  return {
    pest: pestPred,
    disease: diseasePred,
    jointPathologyIndex: jpi,
    riskSummary,
    synergyDetected,
    synergyDescription,
  };
}
