# Prompt composition

## Hard rule

**DO NOT OVERWRITE THE CURRENT SYSTEM PROMPT.**

The live companion instructions live in `packages/ai/src/openai-provider.ts`
(`createOpenAICocoProvider`). That string stays. Additive layers go in the
**request payload** already sent as JSON (`mode`, `message`, `context`).

## Allowed change

Append fields to `context` (optional `entry`, later `attachments`) and keep
using `createCocoRouter`. Module screens call `/api/mus/respond` with the same
contract.

## Forbidden change

```
OLD SYSTEM PROMPT
        ↓
DELETE
        ↓
NEW MUS PROMPT
```

Do not save a merged prompt back over the provider file.
Do not delete safety, confirmation, faith, or nutrition-authority lines.
