import {
  foodParseSchema,
  parseFoodMessageHeuristic,
  type FoodParse,
  type FoodParseContext,
} from '@kayamo/food';
import { completeObject, type CompleteObjectDeps } from './router';

export const FOOD_PARSE_SYSTEM = `When the user discusses food logging, convert conversational language into structured food-log operations.

Rules:
- Never calculate authoritative daily calorie totals yourself.
- Never invent exact restaurant nutrition.
- Never silently add a food not clearly mentioned.
- Preserve the distinction between addition and correction.
- When the user says "actually", "make it", "change", "remove", or similar, strongly consider UPDATE/DELETE instead of ADD.
- Use prior structured food-log context to resolve phrases such as "that", "the rice", "same breakfast", and "another Coke".
- Taglish and casual Philippine English are normal.
- Preserve brands when provided.
- Preserve exact quantities when provided.
- If quantity is vague, represent the uncertainty.
- If ambiguity could materially alter calories/protein, ask via clarifications.
- If the user says "new day", emit START_NEW_DAY; never delete prior-day history.
- Do not change calorie/macro targets.
- For image input, observation is not confirmation.
- Output only operations and clarifications. No nutrition numbers.`;

export async function parseFoodMessage(
  input: { message: string; context: FoodParseContext; userId: string },
  deps?: CompleteObjectDeps,
): Promise<FoodParse> {
  const heuristic = parseFoodMessageHeuristic(input.message, input.context);
  if (!deps?.generateObject && !process.env.OPENAI_API_KEY?.trim()) {
    return heuristic;
  }
  try {
    const ledger = input.context.entries
      .map((row) => `${row.displayName} (${row.mealSlot}, qty ${row.quantity})`)
      .join('; ');
    const aliases = Object.entries(input.context.aliases ?? {})
      .map(([from, to]) => `${from} → ${to}`)
      .join('; ');
    const object = await completeObject(
      {
        tier: 'small',
        schema: foodParseSchema,
        system: FOOD_PARSE_SYSTEM,
        userId: input.userId,
        messages: [
          {
            role: 'user',
            content: `Logical date: ${input.context.logicalDate}\nLedger: ${ledger || '(empty)'}\nAliases: ${aliases || '(none)'}\nMessage: ${input.message}`,
          },
        ],
      },
      deps,
    );
    return foodParseSchema.parse(object);
  } catch {
    return heuristic;
  }
}
