import { estimateSpeakingSeconds, countWords, durationRange } from "./duration";
import { fullTextOf, type ScriptOutput } from "./output-schema";

/**
 * المراجعة الداخلية الحتمية: قواعد واضحة تُطبَّق على النص قبل عرضه.
 * هي لا تحل محل حكم الإنسان، لكنها تلتقط الأخطاء الشائعة بشكل ثابت ومتكرر.
 */

export type Severity = "error" | "warning" | "info";

export interface QualityWarning {
  code: string;
  severity: Severity;
  message: string;
}

export interface QualityReport {
  score: number;
  warnings: QualityWarning[];
  estimatedSeconds: number;
}

const PENALTY: Record<Severity, number> = { error: 20, warning: 7, info: 2 };

const PROMISE_PATTERN = /هتتعافى|هتتشفى|هتنسيه خلاص|هتنساه تمامًا|هيرجع (?:بالتأكيد|100)|(?:نتيجة|علاج|حل|ضمان) مضمون|مضمون (?:100|١٠٠)|100\s?%|١٠٠\s?٪|هتتخلص من القلق (?:نهائيًا|خالص)/;
const GENERIC_OPENER_PATTERN = /^(?:في الفيديو (?:ده|دا|دي)|النهارده هنتكلم|هل تعلم)|هل تعلم/;
const DIAGNOSIS_PATTERN = /نرجسي|نرجسية|اضطراب|بايبولار|سيكوباث|سوسيوباث|مريض نفسي/;
const ABSOLUTE_PATTERN = /كل (?:الرجالة|الرجال|الستات|النساء|البنات)|مستحيل (?:يتغير|تتغير)|أكيد (?:بيعمل|بتعمل) كده/;
const SOURCE_CLAIM_PATTERN = /حسب (?:دراسة|الدراسات|الإحصائيات)|أثبتت (?:دراسة|الدراسات)|وفقًا لدراسة|وفقا لدراسة|\d+\s?%\s?من (?:الناس|الستات|الرجالة|الشباب)/;
const DRAMATIC_PATTERN = /كارثة|دمار|تدمير|انتحار/;
const HARD_SELL_PATTERN = /احجز (?:الآن|دلوقتي)|اضغط (?:الآن|دلوقتي)|عرض محدود|آخر فرصة/;

function containsAny(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function longSentences(text: string): number {
  return text
    .split(/[.!؟?\n]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => countWords(sentence) > 24).length;
}

export function runQualityChecks(output: ScriptOutput, targetSeconds: number): QualityReport {
  const warnings: QualityWarning[] = [];
  const fullText = fullTextOf(output);
  const estimatedSeconds = estimateSpeakingSeconds(fullText);
  const hook = output.hooks[output.recommendedHookIndex]?.text ?? "";
  const everything = [fullText, output.caption, output.cta ?? "", output.coverText].join("\n");

  if (containsAny(everything, PROMISE_PATTERN)) {
    warnings.push({
      code: "false_promise",
      severity: "error",
      message: "النص فيه وعد بالشفاء أو بنتيجة مضمونة. احذف الوعود وخلي الكلام عن الفهم والخطوات.",
    });
  }

  if (containsAny(hook, GENERIC_OPENER_PATTERN)) {
    warnings.push({
      code: "generic_opener",
      severity: "warning",
      message: "الافتتاحية عامة ومستهلكة (زي «هل تعلم» أو «في الفيديو ده»). ابدأ بموقف أو سؤال يخلي المشاهد يتعرف على نفسه.",
    });
  }

  if (containsAny(everything, DIAGNOSIS_PATTERN)) {
    warnings.push({
      code: "diagnostic_label",
      severity: "warning",
      message: "فيه مصطلح تشخيصي. تأكد إن الكلام عن سلوك معيّن مش تشخيص لشخص غايب عن الحوار.",
    });
  }

  if (containsAny(everything, ABSOLUTE_PATTERN)) {
    warnings.push({
      code: "absolute_generalization",
      severity: "warning",
      message: "فيه تعميم مطلق على فئة من الناس. خففه بصيغة مثل «ممكن» أو «أحيانًا».",
    });
  }

  if (containsAny(everything, SOURCE_CLAIM_PATTERN)) {
    warnings.push({
      code: "unverified_source",
      severity: "warning",
      message: "النص بيذكر دراسة أو نسبة. اتأكد من المصدر قبل النشر، أو احذف الرقم.",
    });
  }

  if (containsAny(everything, DRAMATIC_PATTERN)) {
    warnings.push({
      code: "dramatic_language",
      severity: "warning",
      message: "فيه لغة درامية أو حساسة. راجع النبرة واحذف التهويل.",
    });
  }

  if (containsAny(output.cta ?? "", HARD_SELL_PATTERN)) {
    warnings.push({
      code: "hard_sell_cta",
      severity: "warning",
      message: "دعوة الفعل فيها إلحاح تسويقي. خليها أهدى.",
    });
  }

  if (countWords(hook) > 20) {
    warnings.push({
      code: "long_hook",
      severity: "warning",
      message: "الافتتاحية طويلة. الأول 2 ثانية لازم تكون قصيرة وواضحة.",
    });
  }

  const longCount = longSentences(fullText);
  if (longCount > 0) {
    warnings.push({
      code: "long_sentences",
      severity: "info",
      message: `فيه ${longCount} جملة طويلة. قسّمها عشان الإلقاء يبقى أسهل في الفيديو العمودي.`,
    });
  }

  const range = durationRange(targetSeconds);
  if (estimatedSeconds > range.max) {
    warnings.push({
      code: "too_long_for_duration",
      severity: "warning",
      message: `المدة المتوقعة حوالي ${estimatedSeconds} ثانية، والهدف ${targetSeconds} ثانية. اختصر النص.`,
    });
  } else if (estimatedSeconds < range.min) {
    warnings.push({
      code: "too_short_for_duration",
      severity: "info",
      message: `المدة المتوقعة حوالي ${estimatedSeconds} ثانية، أقل من الهدف ${targetSeconds} ثانية.`,
    });
  }

  const review = output.selfReview;
  if (review.misleadingRisk === "high") {
    warnings.push({
      code: "model_flagged_misleading",
      severity: "error",
      message: "المراجعة الذاتية رصدت احتمال تضليل مرتفع. راجع النص قبل أي استخدام.",
    });
  }
  if (review.psychologicalAccuracy <= 3) {
    warnings.push({
      code: "model_low_accuracy",
      severity: "warning",
      message: "المراجعة الذاتية قيّمت الدقة النفسية بمستوى منخفض. راجع الفكرة قبل النشر.",
    });
  }

  const penalty = warnings.reduce((sum, warning) => sum + PENALTY[warning.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { score, warnings, estimatedSeconds };
}
