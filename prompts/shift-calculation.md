# Shift Calculation Prompts

## The Challenge

**Prompt:** How do I calculate end date for a work order that spans multiple shifts?

Example: 120-min order starts Mon 4PM, shift ends 5PM (Mon-Fri 8AM-5PM)
- Works 60 min Mon (4PM-5PM)
- Pauses overnight
- Resumes Tue 8AM
- Completes Tue 9AM

## Solution Approach

**Key Insight:** Track "working minutes" separately from "elapsed time"

```typescript
function calculateEndDateWithShifts(startDate, durationMinutes, shifts) {
  let remaining = durationMinutes;
  let current = startDate;

  while (remaining > 0) {
    // Find today's shift
    const shift = getShiftForDay(current.weekday, shifts);

    if (!shift || current.hour >= shift.endHour) {
      // Outside shift - skip to next day's shift start
      current = moveToNextShiftStart(current, shifts);
      continue;
    }

    // Calculate available minutes in current shift
    const available = (shift.endHour - current.hour) * 60 - current.minute;
    const worked = Math.min(remaining, available);

    remaining -= worked;
    current = current.plus({ minutes: worked });
  }

  return current;
}
```

## Edge Cases Handled

1. **Weekend skipping**: If no shift defined, skip to next valid day
2. **Start before shift**: Align to shift start time
3. **Start after shift end**: Skip to next day
4. **Multi-day spanning**: Loop handles naturally
5. **Maintenance windows**: Additional check to skip blocked time

## Luxon Weekday Conversion

Luxon uses 1=Monday...7=Sunday
Spec uses 0=Sunday...6=Saturday

```typescript
const specDayOfWeek = luxonWeekday % 7;
// Luxon 1 (Mon) -> 1
// Luxon 7 (Sun) -> 0
```
