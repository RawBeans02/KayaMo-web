# Shared Mus architecture

```
             MUS TAB
          Full command center
                  │
       ┌──────────┼──────────┐
       │          │          │
 Dashboard AI   Todo AI    Gym AI
       │          │          │
 Calories AI   Foods AI   Verify AI
       │          │          │
       └──────────┼──────────┘
                  │
              SAME MUS
                  │
           Shared AI core
           (createCocoRouter)
                  │
             Action router     ← not arbitrary DB writes
                  │
        ┌─────────┼─────────┐
        ↓         ↓         ↓
      To-Do      Gym    Calories/Foods
```

Entry points change **focus**, not identity.

```
Where am I?
What is selected?
What is the user doing?
What other context am I allowed to read?
```

Conversations SHOULD eventually share one thread per user-day so “shorten it”
after “move gym” still resolves. v1 may open the same API with a new Dexie
conversation per pane; do not invent a second model personality.

## Pipeline

```
USER
  │
  ▼
REQUEST NORMALIZER
(text + attachment metadata — server knows if an image exists)
  │
  ▼
MUS ORCHESTRATOR
(existing system prompt + context JSON)
  │
  ├──── text ────────────────► reason / propose
  ├──── image ───────────────► vision worker → structured observations
  └──── app action ──────────► action router → Todo / Gym / Food services
  │
  ▼
USER (confirm / undo)
```

Do not pay an LLM to detect “there is an image.” The request already says so.

## Model env (aliases, not a rewrite)

Existing keys stay: `MODEL_SMALL`, `MODEL_VISION`, `MODEL_NANO`, `MODEL_COACH`.

Optional aliases (first match wins):

- `MUS_ORCHESTRATOR_MODEL` → small / chat
- `MUS_VISION_MODEL` → vision worker
- `MUS_FAST_MODEL` → nano / classification

Intended current aliases: orchestrator `gpt-5.6-luna`, vision `gpt-5.4-mini`.
Do not hard-code those names as the architecture.
