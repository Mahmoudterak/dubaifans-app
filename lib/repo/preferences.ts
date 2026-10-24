import { queryOne, query } from "../db/client";
import type { StyleProfile } from "../script/prompt";
import { AppError } from "../errors";

export interface Preferences extends StyleProfile {
  defaultDurationSeconds: number;
  defaultCtaType: "none" | "soft" | "consult";
}

interface PreferenceRow {
  dialect: StyleProfile["dialect"];
  tone: StyleProfile["tone"];
  default_duration_seconds: number;
  default_cta_type: Preferences["defaultCtaType"];
  signature_phrases: string;
  avoid_phrases: string;
  style_samples: string;
}

function toPreferences(row: PreferenceRow): Preferences {
  return {
    dialect: row.dialect,
    tone: row.tone,
    defaultDurationSeconds: row.default_duration_seconds,
    defaultCtaType: row.default_cta_type,
    signaturePhrases: row.signature_phrases,
    avoidPhrases: row.avoid_phrases,
    styleSamples: row.style_samples,
  };
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const row = await queryOne<PreferenceRow>(
    `SELECT dialect, tone, default_duration_seconds, default_cta_type,
            signature_phrases, avoid_phrases, style_samples
       FROM user_preferences WHERE user_id = $1`,
    [userId],
  );
  return row
    ? toPreferences(row)
    : {
        dialect: "egyptian",
        tone: "direct",
        defaultDurationSeconds: 45,
        defaultCtaType: "soft",
        signaturePhrases: "",
        avoidPhrases: "",
        styleSamples: "",
      };
}

export async function savePreferences(userId: string, input: Preferences): Promise<Preferences> {
  const rows = await query<PreferenceRow>(
    `INSERT INTO user_preferences
       (user_id, dialect, tone, default_duration_seconds, default_cta_type,
        signature_phrases, avoid_phrases, style_samples, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (user_id) DO UPDATE SET
       dialect = EXCLUDED.dialect,
       tone = EXCLUDED.tone,
       default_duration_seconds = EXCLUDED.default_duration_seconds,
       default_cta_type = EXCLUDED.default_cta_type,
       signature_phrases = EXCLUDED.signature_phrases,
       avoid_phrases = EXCLUDED.avoid_phrases,
       style_samples = EXCLUDED.style_samples,
       updated_at = now()
     RETURNING dialect, tone, default_duration_seconds, default_cta_type,
               signature_phrases, avoid_phrases, style_samples`,
    [
      userId,
      input.dialect,
      input.tone,
      input.defaultDurationSeconds,
      input.defaultCtaType,
      input.signaturePhrases,
      input.avoidPhrases,
      input.styleSamples,
    ],
  );
  const row = rows[0];
  if (!row) throw new AppError("INTERNAL", "تعذر حفظ التفضيلات");
  return toPreferences(row);
}
